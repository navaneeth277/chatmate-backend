import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import Entry from "../models/Entry.js";
import dotenv from "dotenv";

dotenv.config();

const dateModel = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-1.5-flash",
});

export const handlePrompt = async (req, res) => {
  const { input } = req.body;
  //console.log("Received input:", input);

  if (!process.env.GOOGLE_API_KEY) {
    return res.status(500).json({ success: false, error: "Missing API key" });
  }

  const model = new ChatGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY,
    model: "gemini-1.5-flash",
  });

  const prompt = `
You are a helpful assistant. Analyze this input:
"${input}"

1. Classify the type as one of: "diary", "task", "note", or "reminder".
2. Extract a short summary of the content.
3. If there are any action items, list them.
4. Return a JSON like:
{
  "type": "...",
  "summary": "...",
  "tasks": ["..."]
}
`;

  try {
    const response = await model.invoke(prompt);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch[0]);

    const scheduledDate = await extractDateFromInput(input);

    const entry = await Entry.create({
      userId: req.user.id,
      Username: req.user.name,
      content: input,
      summary: parsed.summary,
      type: parsed.type || "note",
      tasks: parsed.tasks || [],
      tags: [],
      scheduledFor: scheduledDate,
    });

    res.json({ success: true, data: entry });
  } catch (error) {
    console.error("Gemini Error:", error.message || error);
    res.status(500).json({ success: false, error: "Failed to process prompt" });
  }
};

async function extractDateFromInput(text) {
  const datePrompt = PromptTemplate.fromTemplate(`
Today is: {today}
Input: "{input}"
Your task is to extract a specific date in the format YYYY-MM-DD based on the context of the input and today's date.
If no clear date is mentioned, return "null".

Output:
  `);

  const dateChain = RunnableSequence.from([datePrompt, dateModel]);
  const today = new Date().toISOString().split("T")[0];

  try {
    const result = await dateChain.invoke({ today, input: text });
    const raw = result.content.trim();

    if (raw.toLowerCase() !== "null") {
      const parsedDate = new Date(raw);
      if (!isNaN(parsedDate)) return parsedDate;
    }

    // 👇 Additional fallback logic:
    const hasTime = /\b(\d{1,2})(:\d{2})?\s?(am|pm)?\b/i.test(text);
    if (hasTime) {
      return new Date(); // Default to today if time is present
    }

    return null;
  } catch (err) {
    console.error("Date Extraction Error:", err.message || err);
    return null;
  }
}

export const getEntriesByDate = async (req, res) => {
  const { date } = req.query;
  const userid= req.user.id;
  if (!userid) return res.status(401).json({ success: false, error: "Unauthorized" });
  if (!date) return res.status(400).json({ success: false, error: "Missing 'date'" });

  try {
    const selectedDate = new Date(date);
    const start = new Date(selectedDate.setHours(0, 0, 0, 0));
    const end = new Date(selectedDate.setHours(23, 59, 59, 999));

    const entries = await Entry.find({
      scheduledFor: { $gte: start, $lte: end },
       userId: userid,
    });

    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch entries" });
  }
};

export const generateDiaryEntry = async (req, res) => {
  const { date, extraText } = req.body;
  const userid= req.user.id;
  
  if (!userid) return res.status(401).json({ success: false, error: "Unauthorized" });

  const username = req.user.name;

  if (!date) return res.status(400).json({ success: false, error: "Missing 'date'" });

  try {
    const selectedDate = new Date(date);
    const start = new Date(selectedDate.setHours(0, 0, 0, 0));
    const end = new Date(selectedDate.setHours(23, 59, 59, 999));

    const entries = await Entry.find({
      scheduledFor: { $gte: start, $lte: end },
      userId: userid,
    });

    const entrySummaries = entries.map(e => `• ${e.type}: ${e.summary}`).join("\n") || "No entries.";

    const model = new ChatGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_API_KEY,
      model: "gemini-1.5-flash",
    });

    const prompt = `
You are a diary writing assistant.

Date: ${new Date(date).toDateString()}

Here are the notes, tasks, and reminders saved for the day:
${entrySummaries}

The user also added:
"${extraText}"

Write a personal diary entry summarizing the day. Be reflective, warm, and concise.
Also extract the user's overall mood from the context using one word (e.g., happy, sad, tired, excited, relaxed).
Return JSON like:
{
  "diaryText": "...",
  "mood": "..."
}
`;

    const response = await model.invoke(prompt);
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch[0]);

    const savedEntry = await Entry.create({
      userId: userid,
      username: username,
      content: parsed.diaryText, // ✅ Save full diary text here
      summary: parsed.diaryText,// Short summary
      type: "diary",
      scheduledFor: new Date(date),
      tags: ["auto-generated", "diary"],
      mood: parsed.mood,
      userInput: extraText, // Optional: save user's input separately if schema allows
    });

    res.json({ success: true, diaryEntry: parsed.diaryText, saved: savedEntry });
  } catch (error) {
    console.error("Diary Generation Error:", error.message || error);
    res.status(500).json({ success: false, error: "Failed to generate diary entry" });
  }
};


export const getDiaryByDate = async (req, res) => {
  const { date } = req.query;
  const userid= req.user.id;
  if (!date) return res.status(400).json({ success: false, error: "Missing 'date'" });

  try {
    const selectedDate = new Date(date);
    const start = new Date(selectedDate.setHours(0, 0, 0, 0));
    const end = new Date(selectedDate.setHours(23, 59, 59, 999));

    const diary = await Entry.findOne({
      type: "diary",
      userId: userid,
      scheduledFor: { $gte: start, $lte: end },
    });

    if (!diary) return res.status(404).json({ success: false, message: "No diary found" });

    res.json({ success: true, data: diary });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to fetch diary" });
  }
};

export const getEntriesWithTaskTag = async (req, res) => {
  const userid= req.user.id;
  try {
    const entries = await Entry.find({
    userId: userid,
     
    });
//console.log("Entries with task tag:", entries);
    res.json({ success: true, data: entries });
  } catch (error) {
    console.error("Get Tasks Error:", error.message || error);
    res.status(500).json({ success: false, error: "Failed to fetch task-tagged entries" });
  }
};

