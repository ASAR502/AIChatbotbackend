// import express from 'express';
// import dotenv from 'dotenv';
// import fs from 'fs';
// import { ChatPromptTemplate } from '@langchain/core/prompts';
// import { StringOutputParser } from '@langchain/core/output_parsers';
// import { Chroma } from '@langchain/community/vectorstores/chroma';
// import { CharacterTextSplitter } from 'langchain/text_splitter';
// import { GoogleGenerativeAI } from '@google/generative-ai';
// import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
// import { HumanMessage, AIMessage } from '@langchain/core/messages';
// import cors from 'cors';
// import bodyParser from 'body-parser';
// import cookieParser from 'cookie-parser';
// import { log } from 'console';
// const chromaHost = process.env.CHROMA_HOST || "localhost";

// dotenv.config();
// const app = express();
// app.use(express.json());

// const corsOptions = {
//   origin: "*",
//   methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
//   preflightContinue: false,
//   optionsSuccessStatus: 204,
// };

// app.use(cors(corsOptions));
// app.options('*', cors(corsOptions)); 
// app.use(cookieParser());
// app.use(bodyParser.json({ extended: true }));
// app.use(bodyParser.urlencoded({ extended: true }));

// const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// const PORT = process.env.PORT || 5009;
// console.log(process.env.PORT, "port number");

// const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// // Initialize Google embeddings for LangChain
// const embeddings = new GoogleGenerativeAIEmbeddings({
//   apiKey: GEMINI_API_KEY,
//   modelName: "embedding-001",
//   maxOutputTokens: 2048,
//   maxInputValue: 30000,
// });

// class Document {
//   constructor(pageContent, metadata = {}) {
//     this.pageContent = pageContent;
//     this.metadata = metadata;
//   }
// }

// // Load and split data from a text file
// const loadAndSplitData = async () => {
//   const filePath = './newData.txt';
//   const rawText = fs.readFileSync(filePath, 'utf-8');
  
//   // Use a smaller chunk size to avoid embedding API limits
//   const splitter = new CharacterTextSplitter({ 
//     chunkSize: 1000,     // Much smaller, well below the limit
//     chunkOverlap: 50     // Reduced overlap for less duplication
//   });
  
//   console.log(`Splitting raw text of ${Buffer.byteLength(rawText, 'utf8')} bytes`);
//   const textChunks = await splitter.splitText(rawText);
//   console.log(`Split into ${textChunks.length} chunks`);
  
//   return textChunks.map(chunk => new Document(chunk));
// };

// // Enhanced prompt template with recommendation section
// const promptTemplate = `You are a kind and helpful assistant focused on mental health support.

// Use the provided context to answer the user's question as accurately as possible.

// - If the answer is not found in the context, respond using your general knowledge **in the field of mental health** within 10–20 words.
// - If the user says hello, introduces themselves, or sends a greeting (like "hi", "hello", "my name is..."), respond warmly and encourage them to ask their mental health-related query.
// - If the question is unrelated to mental health and not a greeting, respond in **one short polite line** stating that the topic is outside the scope of mental health support.

// Your response should be in two sections, clearly separated:
// 1. <answer>Your helpful response to the user's current question</answer>
// 2. <recommendations>Provide 2-3 suggested follow-up questions or topics the user might want to explore next, related to their current query or mental health in general. Format these as bullet points.
// Like this Best relaxation techniques?,Find your calming techniques in 4 to 5 word</recommendations>

// Context:
// {context}

// Chat History:
// {chat_history}

// User Question:
// {question}`;

// // Format documents into context string
// const formatDocs = (docs) => docs.map((doc) => doc.pageContent).join('\n\n');

// // Updated Gemini API call function using the chat-based approach
// const callGemini = async (prompt) => {
//   try {
//     // Get the Gemini model
//     const model = genAI.getGenerativeModel({
//       model: "gemini-2.0-flash"
//     });
    
//     // Create a chat session
//     const chat = model.startChat({
//       history: [
//         {
//           role: "user",
//           parts: [{ text: "Hello" }],
//         },
//         {
//           role: "model",
//           parts: [{ text: "Great to meet you. What would you like to know?" }],
//         },
//       ],
//     });
    
//     // Send the prompt as a single message
//     const result = await chat.sendMessage(prompt);
//     console.log("Gemini response:", result);
    
//     return result;
//   } catch (error) {
//     console.error("Error calling Gemini API:", error);
//     throw error;
//   }
// };

// // Create a custom chain with ChromaDB retriever
// const createCustomChain = (vectorStore) => {
//   const retriever = vectorStore.asRetriever(3); // Get top 3 most relevant docs
  
//   return async ({ question, chat_history }) => {
//     const relevantDocs = await retriever.getRelevantDocuments(question);
//     const context = formatDocs(relevantDocs);
    
//     // Format chat history
//     let formattedHistory = "";
//     if (chat_history && chat_history.length > 0) {
//       formattedHistory = chat_history.map(msg => {
//         if (msg instanceof HumanMessage) {
//           return `Human: ${msg.content}`;
//         } else if (msg instanceof AIMessage) {
//           return `AI: ${msg.content}`;
//         }
//         return "";
//       }).join("\n");
//     }
    
//     // Fill prompt template
//     const filledPrompt = promptTemplate
//       .replace("{context}", context)
//       .replace("{chat_history}", formattedHistory)
//       .replace("{question}", question);
    
//     // Call Gemini with updated function
//     return await callGemini(filledPrompt);
//   };
// };

// // Function to parse response and separate answer from recommendations
// const parseResponse = (rawResponse) => {
//   // Default structure if parsing fails
//   let result = {
//     answer: rawResponse,
//     recommendations: []
//   };
  
//   try {
//     // Extract the answer section
//     const answerMatch = rawResponse.match(/<answer>(.*?)<\/answer>/s);
//     // Extract the recommendations section
//     const recommendationsMatch = rawResponse.match(/<recommendations>(.*?)<\/recommendations>/s);
    
//     if (answerMatch && recommendationsMatch) {
//       const answer = answerMatch[1].trim();
      
//       // Parse recommendations as bullet points
//       const recommendationsText = recommendationsMatch[1].trim();
//       const recommendations = recommendationsText
//         .split(/\n\s*[-•]\s*/)
//         .filter(item => item.trim().length > 0)
//         .map(item => item.trim());
      
//       result = {
//         answer: answer,
//         recommendations: recommendations
//       };
//     }
//   } catch (error) {
//     console.error("Error parsing response:", error);
//   }
  
//   return result;
// };

// let customChain;

// // Initialize ChromaDB, load documents, and build chain
// (async () => {
//   try {
//     console.log("Loading documents...");
//     const documents = await loadAndSplitData();
    
//     console.log("Initializing ChromaDB...");
//     // Connect to existing ChromaDB instance
//     const vectorStore = await Chroma.fromDocuments(
//         documents,
//         embeddings,
//         {
//           url: `http://${chromaHost}:8000`,
//           collectionName: "data",
//         }
//       );
    
//     console.log("Creating chain with ChromaDB retriever...");
//     customChain = createCustomChain(vectorStore);
//     console.log("Chain initialized successfully");
//   } catch (error) {
//     console.error("Error initializing chain:", error);
//   }
// })();

// // Enhanced route with recommendations
// app.post('/chat', async (req, res) => {
//   console.log(req.body, "req.body");
  
//   const { query, chat_history = [] } = req.body;
//   console.log(query, chat_history);
  
//   if (!query) return res.status(400).json({ error: 'Query is required' });

//   try {
//     const formattedHistory = chat_history.flatMap((msg) => [
//       new HumanMessage(msg.question),
//       new AIMessage(msg.answer),
//     ]);

//     const rawResponse = await customChain({
//       question: query,
//       chat_history: formattedHistory,
//     });

//     // Parse the response to separate answer from recommendations
//     const { answer, recommendations } = parseResponse(rawResponse);

//     res.json({ 
//       response: answer,
//       recommendations: recommendations 
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Something went wrong', details: error.message });
//   }
// });

// app.listen(PORT, '0.0.0.0', () => {
//   console.log('Server listening on port 5006');
// });


console.log("ghjghfghfghfh")

