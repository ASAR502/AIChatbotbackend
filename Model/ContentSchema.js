// models/Content.js
import mongoose from "mongoose";
import { Schema } from "mongoose";

const ContentSchema = new Schema(
  {
    contentId: { type: String, required: true, unique: true },
    language: {
      type: String,
      enum: ["English", "हिंदी", "ಕನ್ನಡ"],
      required: true,
    },
    contentType: { type: Schema.Types.ObjectId, ref: "ContentType" },
    linkURL: String,
    fileUrl: String,
    thumbnailUrl: String,
    title: { type: String, required: true },
    intro: String,
    keywords: [{ type: Schema.Types.ObjectId, ref: "Keyword" }],
    track: { type: Schema.Types.ObjectId, ref: "Track" },
    ageGroup: [{ type: Schema.Types.ObjectId, ref: "AgeGroup" }],
    concerns: [{ type: Schema.Types.ObjectId, ref: "Concern" }],
    subConcerns: [{ type: Schema.Types.ObjectId, ref: "SubConcern" }],
    categories: { type: Schema.Types.ObjectId, ref: "Category" },
    status: {
      type: String,
      enum: ["active", "pending", "rejected"],
      default: "active",
    },

    // 🚀 Analytics fields
    recommendedCount: { type: Number, default: 0 },
    recommendedClicks: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    totalViewingTime: { type: Number, default: 0 }, // in seconds
    viewSessionCount: { type: Number, default: 0 }, // to calculate average
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// 🔍 Virtual field for average viewing time
ContentSchema.virtual("averageViewingTime").get(function () {
  return this.viewSessionCount > 0
    ? this.totalViewingTime / this.viewSessionCount
    : 0;
});

export default mongoose.model("Content", ContentSchema);
