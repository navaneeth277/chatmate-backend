import mongoose from "mongoose";

const EntrySchema = new mongoose.Schema({
  userId: String,
  username: String,
  content: String,
  summary: String,
  type: {
    type: String,
    enum: ["diary", "task", "note", "reminder"],
    default: "note",
  },
  tasks: [String],
  tags: [String],
  mood: String, // ✅ Added mood field
  date: { type: Date, default: Date.now },
  scheduledFor: { type: Date, default: null },
});

export default mongoose.model("Entry", EntrySchema);
