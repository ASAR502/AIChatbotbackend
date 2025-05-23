import { MongoClient } from "mongodb";
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
let db;
let userChatCollection;

if (!MONGO_URI) {
  console.error("MongoDB URI is not defined in environment variables");
  process.exit(1);
}

// Connect to MongoDB using mongoose (recommended for schema-based operations)
async function connectToDatabase() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB with Mongoose');
    return mongoose.connection.db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Alternative: Native MongoDB connection (if needed for specific operations)
async function connectToMongoDB() {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db('test');
    userChatCollection = db.collection('AIChatbot');
    console.log('Connected to MongoDB (Native Driver)');
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

export default connectToDatabase;
export { connectToMongoDB, userChatCollection };