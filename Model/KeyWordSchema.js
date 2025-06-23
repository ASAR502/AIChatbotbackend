const { Schema } = mongoose;
import mongoose from "mongoose";

const KeywordSchema = new Schema(
  {
    keywordId: { type: String, required: true, unique: true },
    name: { type: Map, of: String, required: true },
    selectionCount: { type: Number, default: 0 },
    lastSelectedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);
export default mongoose.model("Keyword", KeywordSchema);
