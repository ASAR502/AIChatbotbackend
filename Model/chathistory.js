import mongoose from "mongoose";

// Define keyword schema for user tracking (stores only keyword ObjectId reference)
const UserKeywordSchema = new mongoose.Schema({
  keywordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Keyword", // Reference to the main Keyword collection
    required: true,
  },
  count: {
    type: Number,
    default: 1,
  },
  lastSelectedAt: {
    type: Date,
    default: Date.now,
  },
});

// Define sensitive word schema
const SensitiveWordSchema = new mongoose.Schema({
  word: {
    type: String,
    required: true,
  },
  count: {
    type: Number,
    default: 1,
  },
  // Array to store timestamps of occurrences
  occurrences: [
    {
      type: Date,
      default: Date.now,
    },
  ],
});

// Define chat message schema
const ChatMessageSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
  },
  query: {
    type: String,
    required: true,
  },
  response: {
    type: String,
    required: true,
  },
  recommendations: [
    {
      type: String,
    },
  ],
});

// Main session schema
const ChatSessionSchema = new mongoose.Schema(
  {
    sessionType: {
      type: String,
      required: true,
      default: "default",
    },
    sessionId: {
      type: String,
      required: true,
    },
    chatMessages: [ChatMessageSchema],
  },
  { timestamps: true }
);

// Main chatbot schema
const ChatbotSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    chat_history: [ChatSessionSchema],
    sensitiveWords: [SensitiveWordSchema],
    keyWords: [UserKeywordSchema], // Now properly stores only keyword ObjectId references
  },
  {
    timestamps: true,
  }
);

// Add compound indexes for better performance
ChatbotSchema.index({ userId: 1 });
ChatbotSchema.index({ userId: 1, "chat_history.sessionId": 1 });
ChatbotSchema.index({ userId: 1, "keyWords.keywordId": 1 });

export default mongoose.model("AIchatbot", ChatbotSchema);
