import mongoose from "mongoose";

// Define keyword and sensitive word schemas
const KeywordSchema = new mongoose.Schema({
  word: { type: String, required: true },
  count: { type: Number, default: 1 },
});

const SensitiveWordSchema = new mongoose.Schema({
  word: { type: String, required: true },
  count: { type: Number, default: 1 },
});

// Define chat message schema
const ChatMessageSchema = new mongoose.Schema({
  timestamp: { type: Date, required: true, default: Date.now },
  query: { type: String, required: true },
  response: { type: String, required: true },
  recommendations: [{ type: String }],
});

// Main session schema
const ChatSessionSchema = new mongoose.Schema(
  {
    sessionType: { type: String, required: true, default: 'default' },
    sessionId: { type: String, required: true },
    chatMessages: [ChatMessageSchema],
  },
  { timestamps: true }
);

// Main chatbot schema
const ChatbotSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  chat_history: [ChatSessionSchema],
  sensitiveWords: [SensitiveWordSchema],
  keyWords: [KeywordSchema]
}, { timestamps: true });

// Add compound index for better performance
ChatbotSchema.index({ userId: 1 });
ChatbotSchema.index({ userId: 1, 'chat_history.sessionId': 1 });

export default mongoose.model("AIchatbot", ChatbotSchema);