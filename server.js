import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import { CharacterTextSplitter } from "langchain/text_splitter";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import cors from "cors";
import moment from "moment";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { ObjectId } from "mongodb";
import connectToDatabase from "./database.js";
import {
  analyzeSensitiveContent,
  trackKeyWords,
} from "./tracksensetiveword.js";
import AIchatbot from "./Model/chathistory.js";
import Content from "./Model/ContentSchema.js";
import recommendContentByKeywords from "./Recommendation.js";
import { translateWithAWS } from "./TranslateAWS.js";
import counter from "./Model/counter.js";

function isValidObjectId(id) {
  try {
    return ObjectId.isValid(id);
  } catch (error) {
    return false;
  }
}

dotenv.config();

const app = express();
app.use(express.json());

connectToDatabase();
const corsOptions = {
  origin: "*",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(cookieParser());
app.use(bodyParser.json({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PORT = process.env.PORT_TO_USE || 5001;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

// Save chat to user history array

async function saveChatToHistory(
  userId,
  query,
  sessionId,
  response,
  recommendations = [],
  sessionType = "default"
) {
  // Note: Fixed parameter order - sessionId should come before response
  if (!isValidObjectId(userId)) {
    console.log("Invalid userId, skipping chat history save");
    return null;
  }

  if (!sessionId) {
    console.log("Session id not provided");
    return null;
  }

  try {
    const objectId = new ObjectId(userId);

    const chatMessage = {
      timestamp: new Date(),
      query,
      response,
      recommendations,
    };

    // First, try to add message to existing session
    const updateResult = await AIchatbot.updateOne(
      {
        userId: objectId,
        "chat_history.sessionId": sessionId,
      },
      {
        $push: {
          "chat_history.$.chatMessages": chatMessage,
        },
        $set: {
          "chat_history.$.updatedAt": new Date(),
        },
      }
    );

    if (updateResult.matchedCount > 0) {
      // Process sensitive words
      const sensitiveWordsFound = await analyzeSensitiveContent(userId, query);

      return updateResult;
    }

    // If no existing session found, create new session
    const upsertResult = await AIchatbot.findOneAndUpdate(
      { userId: objectId },
      {
        $push: {
          chat_history: {
            sessionId,
            sessionType,
            chatMessages: [chatMessage],
          },
        },
        $setOnInsert: {
          sensitiveWords: [],
          keyWords: [],
        },
      },
      {
        upsert: true,
        new: true,
      }
    );

    // Process sensitive words
    const sensitiveWordsFound = await analyzeSensitiveContent(userId, query);

    return upsertResult;
  } catch (error) {
    console.error("Error saving chat to history:", error);
    return null;
  }
}

// Get user chat history
async function getUserChatHistory(userId, sessionId) {
  if (!isValidObjectId(userId)) {
    return null;
  }

  if (!sessionId) {
    console.error("SessionId is required");
    return null;
  }

  try {
    const objectId = new ObjectId(userId);

    const result = await AIchatbot.aggregate([
      {
        $match: {
          userId: objectId,
          "chat_history.sessionId": sessionId,
        },
      },
      {
        $unwind: "$chat_history",
      },
      {
        $match: {
          "chat_history.sessionId": sessionId,
        },
      },
      {
        $project: {
          sessionId: "$chat_history.sessionId",
          sessionType: "$chat_history.sessionType",
          createdAt: "$chat_history.createdAt",
          updatedAt: "$chat_history.updatedAt",
          messages: {
            $map: {
              input: "$chat_history.chatMessages",
              as: "message",
              in: {
                timestamp: "$$message.timestamp",
                question: "$$message.query",
                answer: "$$message.response",
                recommendations: {
                  $ifNull: ["$$message.recommendations", []],
                },
              },
            },
          },
        },
      },
    ]);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("Error fetching session chat history (optimized):", error);
    return null;
  }
}

// Safe embedding function with improved size checking
const embedText = async (text) => {
  try {
    // Get byte length of text in UTF-8
    const byteLength = Buffer.byteLength(text, "utf8");

    // Hard limit of 32000 bytes to be safe (below Google's 36000 byte limit)
    const MAX_BYTES = 32000;

    // If text is too large, truncate it
    if (byteLength > MAX_BYTES) {
      console.warn(
        `Text too large for embedding (${byteLength} bytes), truncating`
      );

      // Truncate characters gradually until we're under the byte limit
      let truncatedText = text;
      while (Buffer.byteLength(truncatedText, "utf8") > MAX_BYTES) {
        truncatedText = truncatedText.slice(0, truncatedText.length * 0.9); // Reduce by 10% each time
      }
      text = truncatedText;
    }

    const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error(`Embedding error: ${error.message}`);
    throw error;
  }
};

class Document {
  constructor(pageContent, metadata = {}) {
    this.pageContent = pageContent;
    this.metadata = metadata;
  }
}

// Load and split data from a text file
const loadAndSplitData = async () => {
  const filePath = "./newData.txt";
  const rawText = fs.readFileSync(filePath, "utf-8");

  // Use a significantly smaller chunk size to avoid embedding API limits
  const splitter = new CharacterTextSplitter({
    chunkSize: 1000, // Much smaller, well below the limit
    chunkOverlap: 50, // Reduced overlap for less duplication
  });

  const textChunks = await splitter.splitText(rawText);

  // Double-check chunk sizes
  const largeChunks = textChunks.filter(
    (chunk) => Buffer.byteLength(chunk, "utf8") > 32000
  );

  if (largeChunks.length > 0) {
    console.warn(
      `Warning: ${largeChunks.length} chunks are still over 32KB after splitting`
    );
    // You could implement further splitting here if needed
  }

  return textChunks.map((chunk) => new Document(chunk));
};

// Simple vector similarity function
const cosineSimilarity = (vecA, vecB) => {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magA * magB);
};

// Custom retriever implementation
class CustomRetriever {
  constructor(documents, embedFn) {
    this.documents = documents;
    this.embedFn = embedFn;
    this.embeddings = [];
  }

  async initialize() {
    let successCount = 0;
    let errorCount = 0;

    for (const doc of this.documents) {
      try {
        // Make sure document isn't too large before embedding
        const pageContent = doc.pageContent;
        const byteLength = Buffer.byteLength(pageContent, "utf8");

        if (byteLength > 32000) {
          console.warn(
            `Document too large (${byteLength} bytes), further chunking needed`
          );

          // Split the document into smaller chunks
          const splitter = new CharacterTextSplitter({
            chunkSize: 1000, // Much smaller chunks
            chunkOverlap: 50,
          });

          const subChunks = await splitter.splitText(pageContent);

          // Process each sub-chunk individually
          for (const chunk of subChunks) {
            try {
              const embedding = await this.embedFn(chunk);
              this.embeddings.push({
                doc: new Document(chunk, doc.metadata),
                embedding,
              });
              successCount++;
            } catch (subError) {
              console.error(`Failed to embed sub-chunk: ${subError.message}`);
              errorCount++;
            }
          }
        } else {
          // Process normal-sized document
          const embedding = await this.embedFn(pageContent);
          this.embeddings.push({ doc, embedding });
          successCount++;
        }

        // Log progress periodically
        // if ((successCount + errorCount) % 10 === 0) {
        //   console.log(
        //     `Processed ${successCount + errorCount}/${
        //       this.documents.length
        //     } documents. Success: ${successCount}, Errors: ${errorCount}`
        //   );
        // }
      } catch (error) {
        console.error(`Failed to embed document: ${error.message}`);
        errorCount++;
      }
    }

    console.log(
      `Embedding complete. Success: ${successCount}, Errors: ${errorCount}`
    );
  }

  async getRelevantDocuments(query, k = 3) {
    const queryEmbedding = await this.embedFn(query);

    // Compute similarities
    const similarities = this.embeddings.map((item) => ({
      doc: item.doc,
      score: cosineSimilarity(queryEmbedding, item.embedding),
    }));

    // Sort by similarity score (descending)
    similarities.sort((a, b) => b.score - a.score);

    // Return top k documents
    return similarities.slice(0, k).map((item) => item.doc);
  }
}

// Prompt template (customizable)
const promptTemplate = `You are an empathetic, non-judgemental mental-health companion for youth (15-24).

Use the given context to respond to the user's question accurately and compassionately.

* Guidelines:* 
• Offer warm, friendly, conversational support.  
• Validate feelings, share simple psycho-education, reflect back insights.  
• Use tentative language (“you could try…”, “perhaps…”).  
• Never diagnose, prescribe, or refer to a counsellor / therapist / psychiatrist.

Use only the provided context when available. 
• If *context* is relevant → answer in **20–40 words**.  
• If *context* is absent/unrelated respond using general mental health knowledger in *10–20 words*.  

- Do *not* include any external contact numbers.
- *Only mention the Tele-MANAS helpline (1-800-891-4416)* strictly in *extreme cases*, such as: suicide, self-harm, panic attack, "kill myself", "end my life", "final goodbye", or similar crisis phrases

If the user greets you (e.g., "hi", "hello", "my name is..."), respond warmly and invite them to share a mental health–related question 
If the message is *unrelated to mental health or general life concerns, and **not a greeting*, reply briefly:
  *"I'm sorry, I didn't understand that. Could you please rephrase or share a bit more? I'm here to help!"*

RECOMMENDATIONS  
• Generate **2–3 tap-worthy suggestions** the user can choose next.  
• Each: **4–5 words**, sentence-case, *no* punctuation except the final period.  
• Must be *directly relevant* to the user’s current issue, using their keywords.  
  – Example: if the chat is about “exam stress”, output items like  
    “Quick exam-stress tip”, “Breathing to calm nerves”.  
  – Avoid generic prompts like “How are you feeling”.  
• If a crisis response is given, skip recommendations (leave the array empty).

OUTPUT  
Return JSON only:

\`json
{
  "answer": "Your concise, supportive response.",
  "recommendations": [
    "Tap option one",
    "Tap option two",
    "Tap option three"
  ]
}
\`

Context:
{context}

Chat History:
{chat_history}

User Question:
{question}`;
// Format documents into context string
const formatDocs = (docs) => docs.map((doc) => doc.pageContent).join("\n\n");

// Direct Gemini API call function
const callGemini = async (prompt) => {
  try {
    const result = await geminiModel.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
};

// Create a custom chain
const createCustomChain = (retriever) => {
  return async ({ question, chat_history }) => {
    const context = formatDocs(await retriever.getRelevantDocuments(question));

    // Format chat history
    let formattedHistory = "";
    if (chat_history && chat_history.length > 0) {
      formattedHistory = chat_history
        .map((msg) => {
          if (msg instanceof HumanMessage) {
            return `Human: ${msg.content}`;
          } else if (msg instanceof AIMessage) {
            return `AI: ${msg.content}`;
          }
          return "";
        })
        .join("\n");
    }

    // Fill prompt template
    const filledPrompt = promptTemplate
      .replace("{context}", context)
      .replace("{chat_history}", formattedHistory)
      .replace("{question}", question);

    // Call Gemini directly
    return await callGemini(filledPrompt);
  };
};

function parseResponse(raw) {
  const output = {
    answer: "No answer found.",
    recommendations: [],
  };

  if (!raw) return output;

  try {
    // If it's already an object (e.g., from Gemini API)
    if (typeof raw === "object" && raw.answer) {
      output.answer = raw.answer;
      output.recommendations = Array.isArray(raw.recommendations)
        ? raw.recommendations
        : [];
      return output;
    }

    // If it's a string, clean up and parse
    if (typeof raw === "string") {
      raw = raw.trim();

      // Remove markdown wrappers like ```json
      if (raw.startsWith("```json") || raw.startsWith("```")) {
        raw = raw
          .replace(/^```(?:json)?\n?/, "")
          .replace(/```$/, "")
          .trim();
      }

      // Parse JSON
      const parsed = JSON.parse(raw);

      // Validate keys
      if (parsed.answer) {
        output.answer = parsed.answer;
        if (Array.isArray(parsed.recommendations)) {
          output.recommendations = parsed.recommendations;
        }
      }

      return output;
    }
  } catch (err) {
    console.error("Failed to parse Gemini response:", err.message);
  }

  return output;
}

let customChain;

// Load documents, initialize retriever and build chain
(async () => {
  try {
    const documents = await loadAndSplitData();
    const retriever = new CustomRetriever(documents, embedText);
    await retriever.initialize();
    customChain = createCustomChain(retriever);
    console.log("Chain initialized successfully");
  } catch (error) {
    console.error("Error initializing chain:", error);
  }
})();

// Routes
app.post("/chat/:userId", async (req, res) => {
  const { userId } = req.params;
  const { query, chat_history = [], sessionId } = req.body;

  if (!query) return res.status(400).json({ error: "Query is required" });
  if (!sessionId)
    return res.status(400).json({ error: "Session ID is required" });

  try {
    // Get chat history from database if userId is provided and valid
    let formattedHistory = [];

    if (userId && isValidObjectId(userId)) {
      // If chat_history is not provided in request, fetch from database
      if (!chat_history || chat_history.length === 0) {
        const dbHistory = await getUserChatHistory(userId, sessionId);
        if (dbHistory && dbHistory.messages) {
          formattedHistory = dbHistory.messages.flatMap((msg) => [
            new HumanMessage({ content: msg.question }),
            new AIMessage({ content: msg.answer }),
          ]);
        }
      } else {
        formattedHistory = chat_history.flatMap((msg) => [
          new HumanMessage({ content: msg.question }),
          new AIMessage({ content: msg.answer }),
        ]);
      }
    } else {
      // Use chat history from request if userId is not valid
      formattedHistory = chat_history.flatMap((msg) => [
        new HumanMessage({ content: msg.question }),
        new AIMessage({ content: msg.answer }),
      ]);
    }

    const response = await customChain({
      question: query,
      chat_history: formattedHistory,
    });

    const keywords = await trackKeyWords(query);
    const { answer, recommendations } = parseResponse(response);

    // Save to database if userId is valid
    if (userId && isValidObjectId(userId)) {
      await saveChatToHistory(
        userId,
        query,
        sessionId,
        answer,
        recommendations
      );
    }

    await counter.findOneAndUpdate(
      { entity: "Success" },
      { $inc: { count: 1 } },
      { new: true, upsert: true }
    );
    res.json({
      response: answer,
      recommendations: recommendations,
      keywords: keywords.map((item) => item._id) || [],
    });
  } catch (error) {
    await counter.findOneAndUpdate(
      { entity: "Failure" },
      { $inc: { count: 1 } },
      { new: true, upsert: true }
    );
    console.error(error);
    res
      .status(500)
      .json({ error: "Something went wrong", details: error.message });
  }
});

app.post("/content/recommendation", async (req, res) => {
  const { userId, keywords } = req.body;

  if (!userId || !isValidObjectId(userId)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ error: "Keywords are required" });
  }

  try {
    // Call your logic and await the Promise to get recommendations back
    const recommendations = await recommendContentByKeywords(keywords, 3);

    res.json({
      recommendations: recommendations.map((doc) => ({
        id: doc._id,
        title: doc.title,
        contentType: doc.contentType,
        linkURL: doc.linkURL,
        fileUrl: doc.fileUrl,
        thumbnailUrl: doc.thumbnailUrl,
        intro: doc.intro,
        keywords: doc.keywords,
        // Add other fields as needed based on your Content schema
      })),
    });
  } catch (error) {
    console.error("Error getting recommendations:", error);
    res.status(500).json({ error: "Failed to get recommendations" });
  }
});

app.post("/translate", async (req, res) => {
  try {
    const { type, text } = req.body;

    // Validation
    if (!type || !text) {
      return res.status(400).json({
        success: false,
        error: "Both 'type' and 'text' are required",
        supportedTypes: [
          "hindi",
          "kannada",
          "english-to-hindi",
          "english-to-kannada",
        ],
      });
    }

    if (typeof text !== "string" || text.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Text must be a non-empty string",
      });
    }

    let translatedText;
    let sourceLanguage;
    let targetLanguage;

    // Handle different translation types
    switch (type.toLowerCase()) {
      case "hindi":
      case "english-to-hindi":
        sourceLanguage = "en";
        targetLanguage = "hi";
        translatedText = await translateWithAWS(
          text,
          sourceLanguage,
          targetLanguage
        );
        break;

      case "kannada":
      case "english-to-kannada":
        sourceLanguage = "en";
        targetLanguage = "kn";
        translatedText = await translateWithAWS(
          text,
          sourceLanguage,
          targetLanguage
        );
        break;

      case "hindi-to-english":
        sourceLanguage = "hi";
        targetLanguage = "en";
        translatedText = await translateWithAWS(
          text,
          sourceLanguage,
          targetLanguage
        );
        break;

      case "kannada-to-english":
        sourceLanguage = "kn";
        targetLanguage = "en";
        translatedText = await translateWithAWS(
          text,
          sourceLanguage,
          targetLanguage
        );
        break;

      default:
        return res.status(400).json({
          success: false,
          error: "Invalid translation type",
          supportedTypes: [
            "hindi",
            "kannada",
            "english-to-hindi",
            "english-to-kannada",
            "hindi-to-english",
            "kannada-to-english",
          ],
        });
    }

    // Success response
    res.status(200).json({
      success: true,
      data: {
        originalText: text,
        translatedText: translatedText,
        translationType: type,
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage,
      },
    });
  } catch (error) {
    console.error("Translation API Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error during translation",
      message: error.message,
    });
  }
});

app.get("/sensitvecount", async (req, res) => {
  try {
    const { start, end, granularity } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        response: "failed",
        message: "Missing required params: start, end",
      });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffDays = Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));

    const cleanGranularity = granularity?.trim();
    const validGranularities = ["hour", "day", "week", "month", "year"];
    let bucket = validGranularities.includes(cleanGranularity)
      ? cleanGranularity
      : null;

    if (!bucket) {
      if (diffDays <= 30) bucket = "day";
      else if (diffDays <= 120) bucket = "week";
      else if (diffDays <= 730) bucket = "month";
      else bucket = "year";
    }

    const bucketFormat = {
      hour: "YYYY-MM-DD HH:00",
      day: "YYYY-MM-DD",
      week: "GGGG-ww",
      month: "YYYY-MM",
      year: "YYYY",
    }[bucket];

    const allDocs = await AIchatbot.find({
      "sensitiveWords.occurrences": { $exists: true, $ne: [] },
    });

    const bucketCounts = {};

    for (const doc of allDocs) {
      for (const sw of doc.sensitiveWords || []) {
        for (const ts of sw.occurrences || []) {
          const tsDate = new Date(ts);
          if (tsDate >= startDate && tsDate < endDate) {
            const key = moment(tsDate).format(bucketFormat);
            bucketCounts[key] = (bucketCounts[key] || 0) + 1;
          }
        }
      }
    }

    const labels = [];
    const endMoment = moment(endDate);
    let cur = moment(startDate);
    while (cur.isBefore(endMoment)) {
      let label;
      if (bucket === "hour") {
        label = cur.format("YYYY-MM-DD HH:00");
        cur.add(1, "hour");
      } else if (bucket === "day") {
        label = cur.format("YYYY-MM-DD");
        cur.add(1, "day");
      } else if (bucket === "week") {
        label = cur.format("GGGG-ww");
        cur.add(1, "week");
      } else if (bucket === "month") {
        label = cur.format("YYYY-MM");
        cur.add(1, "month");
      } else {
        label = cur.format("YYYY");
        cur.add(1, "year");
      }
      labels.push(label);
    }

    const chartData = labels.map((label) => bucketCounts[label] || 0);

    return res.status(200).json({
      response: "success",
      granularity: bucket,
      labels,
      series: [{ name: "Total Sensitive Word Occurrences", data: chartData }],
    });
  } catch (err) {
    console.error("Error fetching total sensitive word occurrences:", err);
    return res.status(500).json({
      response: "failed",
      message: "Internal server error while fetching sensitive word data",
      err: err.message,
    });
  }
});

const PORT_TO_USE = 5001;
app.listen(PORT_TO_USE, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT_TO_USE}`);
});
