import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  entity: { type: String, required: true, unique: true }, // e.g. "Concern", "Activity"
  count: { type: Number, default: 0 },
});

export default mongoose.model("Counter", counterSchema);
