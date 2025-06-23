const mongoose = require("mongoose");
const { IST_OFFSET_MS } = require("../utils/contant");

const UserSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Types.ObjectId, required: true, ref: "User" },
    isTimedOut: { type: Boolean, default: false },
    flowStep: { type: Number, default: 1 },
    featuresUsed: [
      { type: mongoose.Types.ObjectId, required: true, ref: "Feature" },
    ],
    categorySelected: [
      { type: mongoose.Types.ObjectId, required: true, ref: "Category" },
    ],
    concernsSelected: [
      { type: mongoose.Types.ObjectId, required: true, ref: "Concern" },
    ],
    subConcernsSelected: [
      { type: mongoose.Types.ObjectId, required: true, ref: "Subconcern" },
    ],
    feedbackReceived: {
      type: mongoose.Types.ObjectId,
      required: false,
      ref: " Feedback",
    },
    completed: { type: Boolean, default: false },
    duration: { type: Number }, // in seconds
  },
  {
    timestamps: {
      currentTime: () => new Date(Date.now() + IST_OFFSET_MS),
    },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export default mongoose.model("UserSession", UserSessionSchema);
