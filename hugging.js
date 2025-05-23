// import express from 'express';
// import dotenv from 'dotenv';
// import fs from 'fs';
// import { CharacterTextSplitter } from 'langchain/text_splitter';
// import cors from 'cors';
// import bodyParser from 'body-parser';
// import cookieParser from 'cookie-parser';
// import { HumanMessage, AIMessage } from '@langchain/core/messages';
// import { MistralAI } from '@langchain/mistralai';
// import { PromptTemplate } from '@langchain/core/prompts';

// dotenv.config();
// const app = express();
// app.use(express.json());
// // 
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

// const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
// const PORT = 5006;

// // Initialize Mistral client
// const mistralClient = new MistralAI({
//   apiKey: MISTRAL_API_KEY,
//   model: "mistral-small-latest", // maps to Mistral-7B-Instruct-v0.3
// });

// // Document class for storing text chunks
// class Document {
//   constructor(pageContent, metadata = {}) {
//     this.pageContent = pageContent;
//     this.metadata = metadata;
//   }
// }

// // Custom embedding function using Mistral's embeddings API
// const embedText = async (text) => {
//   try {
//     // Get byte length of text in UTF-8
//     const byteLength = Buffer.byteLength(text, 'utf8');
    
//     // Hard limit - Mistral typically has 8192 token limit
//     const MAX_BYTES = 24000; // Approximate byte limit
    
//     // If text is too large, truncate it
//     if (byteLength > MAX_BYTES) {
//       console.warn(`Text too large for embedding (${byteLength} bytes), truncating`);
      
//       // Truncate characters gradually until we're under the byte limit
//       let truncatedText = text;
//       while (Buffer.byteLength(truncatedText, 'utf8') > MAX_BYTES) {
//         truncatedText = truncatedText.slice(0, truncatedText.length * 0.9); // Reduce by 10% each time
//       }
//       text = truncatedText;
      
//       console.log(`Truncated to ${Buffer.byteLength(text, 'utf8')} bytes`);
//     }
    
//     // Use Mistral's embeddings endpoint
//     const response = await fetch("https://api.mistral.ai/v1/embeddings", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         "Authorization": `Bearer hV1oFLUzqo8vGgWIiwicfxwJjtHSE4lP `
//       },
//       body: JSON.stringify({
//         model: "mistral-embed",
//         input: text
//       })
//     });
    
//     const data = await response.json();
    
//     if (!response.ok) {
//       throw new Error(`Embedding API error: ${data.error?.message || JSON.stringify(data)}`);
//     }
    
//     return data.data[0].embedding;
//   } catch (error) {
//     console.error(`Embedding error: ${error.message}`);
//     throw error;
//   }
// };

// // Load and split data from a text file
// const loadAndSplitData = async () => {
//   const filePath = './data.xlsx';
//   const rawText = fs.readFileSync(filePath, 'utf-8');
  
//   // Use smaller chunk sizes for better processing
//   const splitter = new CharacterTextSplitter({ 
//     chunkSize: 1000,
//     chunkOverlap: 50
//   });
  
//   console.log(`Splitting raw text of ${Buffer.byteLength(rawText, 'utf8')} bytes`);
//   const textChunks = await splitter.splitText(rawText);
//   console.log(`Split into ${textChunks.length} chunks`);
  
//   return textChunks.map(chunk => new Document(chunk));
// };

// // Simple vector similarity function
// const cosineSimilarity = (vecA, vecB) => {
//   const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
//   const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
//   const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
//   return dotProduct / (magA * magB);
// };

// // Custom retriever implementation
// class CustomRetriever {
//   constructor(documents, embedFn) {
//     this.documents = documents;
//     this.embedFn = embedFn;
//     this.embeddings = [];
//   }

//   async initialize() {
//     // Precompute embeddings for all documents
//     console.log(`Starting embedding computation for ${this.documents.length} documents...`);
//     let successCount = 0;
//     let errorCount = 0;
    
//     for (const doc of this.documents) {
//       try {
//         // Make sure document isn't too large before embedding
//         const pageContent = doc.pageContent;
//         const byteLength = Buffer.byteLength(pageContent, 'utf8');
        
//         if (byteLength > 24000) { // Adjusted for Mistral's limits
//           console.warn(`Document too large (${byteLength} bytes), further chunking needed`);
          
//           // Split the document into smaller chunks
//           const splitter = new CharacterTextSplitter({ 
//             chunkSize: 1000,
//             chunkOverlap: 50
//           });
          
//           const subChunks = await splitter.splitText(pageContent);
//           console.log(`  Split large document into ${subChunks.length} sub-chunks`);
          
//           // Process each sub-chunk individually
//           for (const chunk of subChunks) {
//             try {
//               const embedding = await this.embedFn(chunk);
//               this.embeddings.push({ 
//                 doc: new Document(chunk, doc.metadata), 
//                 embedding 
//               });
//               successCount++;
//             } catch (subError) {
//               console.error(`Failed to embed sub-chunk: ${subError.message}`);
//               errorCount++;
//             }
//           }
//         } else {
//           // Process normal-sized document
//           const embedding = await this.embedFn(pageContent);
//           this.embeddings.push({ doc, embedding });
//           successCount++;
//         }
        
//         // Log progress periodically
//         if ((successCount + errorCount) % 10 === 0) {
//           console.log(`Processed ${successCount + errorCount}/${this.documents.length} documents. Success: ${successCount}, Errors: ${errorCount}`);
//         }
//       } catch (error) {
//         console.error(`Failed to embed document: ${error.message}`);
//         errorCount++;
//       }
//     }
    
//     console.log(`Embedding complete. Success: ${successCount}, Errors: ${errorCount}`);
//   }

//   async getRelevantDocuments(query, k = 3) {
//     const queryEmbedding = await this.embedFn(query);
    
//     // Compute similarities
//     const similarities = this.embeddings.map(item => ({
//       doc: item.doc,
//       score: cosineSimilarity(queryEmbedding, item.embedding)
//     }));
    
//     // Sort by similarity score (descending)
//     similarities.sort((a, b) => b.score - a.score);
    
//     // Return top k documents
//     return similarities.slice(0, k).map(item => item.doc);
//   }
// }

// // Prompt template (adjusted for Mistral's instruction format)
// const promptTemplate = `<s>[INST] You are a kind and helpful assistant focused on mental health support.

// Use the provided context to answer the user's question as accurately as possible.

// - If the answer is not found in the context, respond using your general knowledge **in the field of mental health** within 10–20 words.
// - If the user says hello, introduces themselves, or sends a greeting (like "hi", "hello", "my name is..."), respond warmly and encourage them to ask their mental health-related query.
// - If the question is unrelated to mental health and not a greeting, respond in **one short polite line** stating that the topic is outside the scope of mental health support.

// Context:
// {context}

// Chat History:
// {chat_history}

// User Question:
// {question} [/INST]`;

// // Format documents into context string
// const formatDocs = (docs) => docs.map((doc) => doc.pageContent).join('\n\n');

// // Call Mistral AI API
// const callMistral = async (prompt) => {
//   try {
//     const result = await mistralClient.invoke(prompt);
//     return result;
//   } catch (error) {
//     console.error("Error calling Mistral API:", error);
//     throw error;
//   }
// };

// // Create a custom chain
// const createCustomChain = (retriever) => {
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
    
//     // Call Mistral
//     return await callMistral(filledPrompt);
//   };
// };

// let customChain;

// // Load documents, initialize retriever and build chain
// (async () => {
//   try {
//     const documents = await loadAndSplitData();
//     const retriever = new CustomRetriever(documents, embedText);
//     await retriever.initialize();
//     customChain = createCustomChain(retriever);
//     console.log("Chain initialized successfully");
//   } catch (error) {
//     console.error("Error initializing chain:", error);
//   }
// })();

// // Routes
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

//     const response = await customChain({
//       question: query,
//       chat_history: formattedHistory,
//     });

//     res.json({ response });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Something went wrong', details: error.message });
//   }
// });

// app.listen(PORT, () => console.log(`Mistral chatbot running on port ${PORT}`));