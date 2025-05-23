// const fs = require('fs');
// const path = require('path');
// const { Chroma } = require('langchain/vectorstores/chroma');
// const { CharacterTextSplitter } = require('langchain/text_splitter');
// const { genAI } = require('@google/generative-ai');  // Assuming this is imported in your main file

// // Utility function to embed text
// const embedText = async (text) => {
//   try {
//     // Get byte length of text in UTF-8
//     const byteLength = Buffer.byteLength(text, 'utf8');
    
//     // Hard limit of 32000 bytes to be safe (below Google's 36000 byte limit)
//     const MAX_BYTES = 32000;
    
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
    
//     const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
//     const result = await embeddingModel.embedContent(text);
//     return result.embedding.values;
//   } catch (error) {
//     console.error(`Embedding error: ${error.message}`);
//     throw error;
//   }
// };

// class Document {
//   constructor(pageContent, metadata = {}) {
//     this.pageContent = pageContent;
//     this.metadata = metadata;
//   }
// }

// // Custom embedder class that works with Chroma
// class GoogleEmbedder {
//   constructor() {
//     // No initialization needed for Google's embeddings
//   }
  
//   async embedDocuments(texts) {
//     const embeddings = [];
//     for (const text of texts) {
//       const embedding = await embedText(text);
//       embeddings.push(embedding);
//     }
//     return embeddings;
//   }
  
//   async embedQuery(text) {
//     return await embedText(text);
//   }
// }

// // Function to process a dataset file and store in vector DB
// const processDataset = async (filePath, collectionName) => {
//   try {
//     // Check if file exists
//     if (!fs.existsSync(filePath)) {
//       throw new Error(`File not found: ${filePath}`);
//     }
    
//     // Extract file type from extension
//     const fileExt = path.extname(filePath).toLowerCase();
//     let rawText;
    
//     console.log(`Processing ${filePath} with file type ${fileExt}`);
    
//     // Read file based on type
//     if (fileExt === '.xlsx' || fileExt === '.xls') {
//       // For Excel files, use a library like xlsx or exceljs
//       // This is simplified - you'd need to implement actual Excel parsing
//       console.log('Detected Excel file, parsing...');
//       // Using readFileSync as a placeholder - you'd use an Excel library here
//       rawText = fs.readFileSync(filePath, 'utf-8');
//     } else if (fileExt === '.pdf') {
//       // For PDF files, use a PDF parsing library
//       console.log('Detected PDF file, parsing...');
//       // Placeholder for PDF parsing
//       rawText = fs.readFileSync(filePath, 'utf-8');
//     } else if (fileExt === '.doc' || fileExt === '.docx') {
//       // For Word documents
//       console.log('Detected Word document, parsing...');
//       // Placeholder for Word parsing
//       rawText = fs.readFileSync(filePath, 'utf-8');
//     } else {
//       // Default to treating it as plain text
//       console.log('Processing as text file');
//       rawText = fs.readFileSync(filePath, 'utf-8');
//     }
    
//     // Create metadata for the document
//     const metadata = {
//       source: path.basename(filePath),
//       dateProcessed: new Date().toISOString(),
//       collection: collectionName
//     };
    
//     // Split the text into chunks
//     const splitter = new CharacterTextSplitter({ 
//       chunkSize: 1000,  // Small chunk size to avoid embedding API limits
//       chunkOverlap: 50  // Small overlap for context preservation
//     });
    
//     console.log(`Splitting raw text of ${Buffer.byteLength(rawText, 'utf8')} bytes`);
//     const textChunks = await splitter.splitText(rawText);
//     console.log(`Split into ${textChunks.length} chunks`);
    
//     // Create document objects with metadata
//     const documents = textChunks.map(chunk => 
//       new Document(chunk, { ...metadata, chunkSize: Buffer.byteLength(chunk, 'utf8') })
//     );
    
//     // Create or connect to Chroma collection
//     const embedder = new GoogleEmbedder();
//     const vectorStore = await Chroma.fromDocuments(
//       documents,
//       embedder,
//       {
//         collectionName: collectionName,
//         url: process.env.CHROMA_URL || "http://localhost:8000" // Default Chroma server URL
//       }
//     );
    
//     console.log(`Successfully processed ${documents.length} chunks into collection "${collectionName}"`);
//     return { success: true, chunks: documents.length };
    
//   } catch (error) {
//     console.error(`Error processing dataset ${filePath}: ${error.message}`);
//     return { success: false, error: error.message };
//   }
// };

// // Process multiple datasets
// const processMultipleDatasets = async (datasetConfigs) => {
//   const results = {};
  
//   for (const config of datasetConfigs) {
//     console.log(`Processing dataset for ${config.context} from ${config.filePath}`);
//     results[config.context] = await processDataset(config.filePath, config.collectionName);
//   }
  
//   return results;
// };

// // Function to query a specific collection
// const queryCollection = async (query, collectionName, k = 3) => {
//   try {
//     const embedder = new GoogleEmbedder();
    
//     // Connect to existing collection
//     const vectorStore = await Chroma.fromExistingCollection(
//       embedder,
//       { collectionName: collectionName }
//     );
    
//     // Search for relevant documents
//     const results = await vectorStore.similaritySearch(query, k);
//     return results;
//   } catch (error) {
//     console.error(`Error querying collection ${collectionName}: ${error.message}`);
//     throw error;
//   }
// };

// // Example usage in your application:
// const setupVectorDBs = async () => {
//   // Define your datasets and their contexts
//   const datasets = [
//     { 
//       filePath: './data.xlsx', 
//       collectionName: 'mental_health_data',
//       context: 'mental_health'
//     }
//   ];
  
//   // Process all datasets
//   const results = await processMultipleDatasets(datasets);
//   console.log('All datasets processed:', results);
// };

// // Modified chain creation to use the vector database
// const createVectorDBChain = (collectionName) => {
//   return async ({ question, chat_history }) => {
//     // Get relevant documents from the vector database
//     const relevantDocs = await queryCollection(question, collectionName);
//     const context = relevantDocs.map(doc => doc.pageContent).join('\n\n');
    
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

// // Context-aware routing function to select the appropriate collection
// const getContextFromQuery = (query) => {
//   // This is a simple example - you might use a more sophisticated method
//   const lowerQuery = query.toLowerCase();
  
//   if (lowerQuery.includes('mental') || lowerQuery.includes('therapy') || 
//       lowerQuery.includes('depression') || lowerQuery.includes('anxiety')) {
//     return 'mental_health_data';
//   } else if (lowerQuery.includes('money') || lowerQuery.includes('finance') || 
//              lowerQuery.includes('invest') || lowerQuery.includes('budget')) {
//     return 'finance_data';
//   }
  
//   // Default collection or more sophisticated routing logic
//   return 'general_data';
// };

// // Modified route handler
// app.post('/chat', async (req, res) => {
//   const { query, chat_history = [] } = req.body;
  
//   if (!query) return res.status(400).json({ error: 'Query is required' });

//   try {
//     // Determine which collection to query based on the question
//     const contextCollection = getContextFromQuery(query);
    
//     // Create a chain for the specific context
//     const contextChain = createVectorDBChain(contextCollection);
    
//     const formattedHistory = chat_history.flatMap((msg) => [
//       new HumanMessage(msg.question),
//       new AIMessage(msg.answer),
//     ]);

//     const response = await contextChain({
//       question: query,
//       chat_history: formattedHistory,
//     });

//     res.json({ response });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Something went wrong', details: error.message });
//   }
// });

// module.exports = {
//   setupVectorDBs,
//   processDataset,
//   queryCollection,
//   getContextFromQuery
// };