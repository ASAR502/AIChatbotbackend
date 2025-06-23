import mongoose from "mongoose";
import Content from "./Model/ContentSchema.js";

/**
 * Recommend content based on matching keyword ObjectIds.
 * @param {Array<string|mongoose.Types.ObjectId>} keywordIds - Array of keyword ObjectIds or strings.
 * @param {Number} limit - Number of recommendations to return.
 * @returns {Promise<Array>} - Array of recommended content documents.
 */
export default function recommendContentByKeywords(keywordIds, limit = 3) {
  console.log("Input keywordIds:", keywordIds, "limit:", limit);

  // Fix: Use 'new' keyword when creating ObjectIds, with validation
  const keywordObjectIds = keywordIds.map((id) => {
    // Handle both string and ObjectId inputs
    return typeof id === "string" ? new mongoose.Types.ObjectId(id) : id;
  });

  console.log("Converted ObjectIds:", keywordObjectIds);

  // Fix: Use correct field name based on your schema (keywords, not keywordentity)
  return Content.find({ keywords: { $in: keywordObjectIds } })
    .limit(limit)
    .exec();
}
