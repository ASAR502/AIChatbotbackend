// import express from 'express';
// import dotenv from 'dotenv';
// import fs from 'fs';
// import { ChatPromptTemplate } from '@langchain/core/prompts';
// import { StringOutputParser } from '@langchain/core/output_parsers';
// import { Chroma } from '@langchain/community/vectorstores/chroma';
// import { CharacterTextSplitter } from 'langchain/text_splitter';
// import { GoogleGenerativeAI } from '@google/generative-ai';
// import { HumanMessage, AIMessage } from '@langchain/core/messages';
// import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
// import cors from 'cors';
// import bodyParser from 'body-parser';   
// import cookieParser from 'cookie-parser';
// import path from 'path';
// import trackSensitiveWords from './tracksensetiveword';


// // Load environment variables
// dotenv.config();
// const app = express();
// const corsOptions = {
//   origin: "*",
//   methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
//   preflightContinue: false,
//   optionsSuccessStatus: 204,
// };

// app.use(cors(corsOptions));
// app.options('*', cors(corsOptions)); 
// app.use(cookieParser());
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));
// const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// const PORT = process.env.PORT || 5006;
// console.log(`Using port number: ${PORT}`);
// const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

// // Document class definition
// class Document {
//   constructor(pageContent, metadata = {}) {
//     this.pageContent = pageContent;
//     this.metadata = metadata;
//   }
// }

// // Load and split data from a text file
// const loadAndSplitData = async () => {
//   const filePath = './newData.txt';
  
//   // Check if file exists
//   if (!fs.existsSync(filePath)) {
//     throw new Error(`Data file not found: ${filePath}`);
//   }
  
//   const rawText = fs.readFileSync(filePath, 'utf-8');
  
//   // Use a significantly smaller chunk size to avoid embedding API limits
//   const splitter = new CharacterTextSplitter({ 
//     chunkSize: 1000,
//     chunkOverlap: 50
//   });
  
//   console.log(`Splitting raw text of ${Buffer.byteLength(rawText, 'utf8')} bytes`);
//   const textChunks = await splitter.splitText(rawText);
//   console.log(`Split into ${textChunks.length} chunks`);
  
//   return textChunks.map(chunk => new Document(chunk));
// };

// // Prompt template
// const promptTemplate = `You are a kind and helpful assistant focused on mental health support.

// Use the provided context to answer the user's question as accurately as possible.

// - If the answer is not found in the context, respond using your general knowledge **in the field of mental health** within 10–20 words.
// - If the user says hello, introduces themselves, or sends a greeting (like "hi", "hello", "my name is..."), respond warmly and encourage them to ask their mental health-related query.
// - If the question is unrelated to mental health and not a greeting, respond in **one short polite line** stating that the topic is outside the scope of mental health support.

// Context:
// {context}

// Chat History:
// {chat_history}

// User Question:
// {question}`;

// // Format documents into context string
// const formatDocs = (docs) => docs.map((doc) => doc.pageContent).join('\n\n');

// // Direct Gemini API call function
// const callGemini = async (prompt) => {
//   try {
//     const result = await geminiModel.generateContent(prompt);
//     return result.response.text();
//   } catch (error) {
//     console.error("Error calling Gemini API:", error);
//     throw error;
//   }
// };

// // Initialize the embedding function
// const embeddings = new GoogleGenerativeAIEmbeddings({
//   apiKey: GEMINI_API_KEY,
//   modelName: "embedding-001",
// });

// // Initialize and load data into Chroma with connection to server
// const initializeVectorStore = async () => {
//   try {
//     const documents = await loadAndSplitData();
//     console.log(`Loaded ${documents.length} documents`);
    
//     // Connect to the ChromaDB server running in Docker
//     const vectorStore = await Chroma.fromDocuments(
//         documents,
//         embeddings,
//         {
//           collectionName: "mental_health_data",
//           url: "http://localhost:8000",
//           collectionMetadata: {
//             "hnsw:space": "cosine"
//           },
//           apiPath: "/api/v2" // Explicitly specify the API version
//         }
//       );
      
//     console.log("Vector database initialized successfully");
//     return vectorStore;
//   } catch (error) {
//     console.error("Error initializing vector store:", error);
//     throw error;
//   }
// };

// // Create chain with vector store retriever
// const createChainWithVectorStore = (vectorStore) => {
//   const retriever = vectorStore.asRetriever({
//     k: 3, // Number of documents to retrieve
//   });
  
//   return async ({ question, chat_history }) => {
//     const context = formatDocs(await retriever.getRelevantDocuments(question));
    
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
    
//     // Call Gemini directly
//     return await callGemini(filledPrompt);
//   };
// };

// // Initialize the vector store and chain on startup
// let customChain;

// // Health check endpoint
// app.get('/health', (req, res) => {
//   res.status(200).json({ status: 'ok', message: 'Server is running' });
// });

// // Routes
// // app.post('/chat', async (req, res) => {
// //   console.log("Request body:", req.body);
// //   const userId = req.cookies.userId || req.body.userId||req.params.userId;
// //   console.log("User ID:", userId);
// //   if (!userId) {
// //     console.log("User ID not found in cookies or request body");
// //     }
// //     else{
// //       const sensitiveWordsFound = await trackSensitiveWords(userId, question);
// //     }
    
    
// //   const { query, chat_history = [] } = req.body;
// //   console.log("Query:", query);
// //   console.log("Chat history length:", chat_history.length);
  
// //   if (!query) {
// //     return res.status(400).json({ error: 'Query is required' });
// //   }

// //   if (!customChain) {
// //     return res.status(503).json({ error: 'Service unavailable', details: 'Vector database not initialized yet' });
// //   }

// //   try {
// //     const formattedHistory = chat_history.flatMap((msg) => [
// //       new HumanMessage(msg.question),
// //       new AIMessage(msg.answer),
// //     ]);

// //     const response = await customChain({
// //       question: query,
// //       chat_history: formattedHistory,
// //     });

// //     res.json({ response ,
// //       sensitiveWordsDetected: Object.keys(result.sensitiveWordsFound).length > 0
// //     });
// //   } catch (error) {
// //     console.error("Error processing chat request:", error);
// //     res.status(500).json({ error: 'Something went wrong', details: error.message });
// //   }
// // });
// app.post('/chat', async (req, res) => {
//   console.log("Request body:", req.body);

//   const userId = req.cookies.userId || req.body.userId || req.params.userId;
//   console.log("User ID:", userId);

//   const { query, chat_history = [] } = req.body;

//   if (!query) {
//     return res.status(400).json({ error: 'Query is required' });
//   }

//   if (!userId) {
//     console.log("User ID not found in cookies, request body, or params");
//   }

//   if (!customChain) {
//     return res.status(503).json({ error: 'Service unavailable', details: 'Vector database not initialized yet' });
//   }

//   let sensitiveWordsFound = {};
//   try {
//     if (userId) {
//       sensitiveWordsFound = await trackSensitiveWords(userId, query);
//     }

//     console.log("Query:", query);
//     console.log("Chat history length:", chat_history.length);

//     const formattedHistory = chat_history.flatMap((msg) => [
//       new HumanMessage(msg.question),
//       new AIMessage(msg.answer),
//     ]);

//     const response = await customChain({
//       question: query,
//       chat_history: formattedHistory,
//     });

//     res.json({
//       response,
//       sensitiveWordsDetected: Object.keys(sensitiveWordsFound).length > 0,
//     });
//   } catch (error) {
//     console.error("Error processing chat request:", error);
//     res.status(500).json({ error: 'Something went wrong', details: error.message });
//   }
// });


// // Initialize the app
// (async () => {
//   try {
//     const vectorStore = await initializeVectorStore();
//     customChain = createChainWithVectorStore(vectorStore);
//     console.log("Chain with vector store initialized successfully");
    
//     // Start the server after initialization
//     app.listen(PORT, '0.0.0.0', () => {
//       console.log(`Server listening on port ${PORT}`);
//     });
//   } catch (error) {
//     console.error("Error during initialization:", error);
//     process.exit(1); // Exit if initialization fails
//   }
// })();