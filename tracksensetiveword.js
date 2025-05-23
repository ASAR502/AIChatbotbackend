import { ObjectId } from "mongodb";
import NodeCache from "node-cache";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import AIchatbot from "./Model/chathistory.js"
// Setup environment and paths
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sensitiveWordsFilePath = path.join(__dirname, "sensitive.json");

// Initialize cache and database connection
const cache = new NodeCache({ stdTTL: 600 });
/**
 * Loads sensitive words from JSON file
 * @param {string} filePath Path to the sensitive words JSON file
 * @returns {Object} Sensitive words object categorized by type
 */
function loadSensitiveWordsFromFile(filePath) {
  try {
    // Read the file synchronously
    const data = fs.readFileSync(filePath, "utf8");

    // Parse the JSON data
    const sensitiveWords = JSON.parse(data);

    // Validate the format
    if (!sensitiveWords || typeof sensitiveWords !== "object") {
      console.error("Invalid sensitive words format in file");
      return {};
    }

    return sensitiveWords;
  } catch (error) {
    console.error(
      `Error loading sensitive words from ${filePath}:`,
      error.message
    );
    // Return empty object as fallback
    return {};
  }
}
const sensitiveWords = loadSensitiveWordsFromFile(sensitiveWordsFilePath);
const keyWords = [
  "afraid",
  "angry",
  "anger",
  "anxious",
  "anxiety",
  "burnout",
  "calm",
  "confident",
  "confused",
  "depressed",
  "depression",
  "low energy",
  "drained",
  "fear",
  "frustrated",
  "frustration",
  "help",
  "helpless",
  "hopeless",
  "feeling low",
  "numb",
  "panic",
  "overwhelmed",
  "sad",
  "stress",
  "stressed",
  "tired",
  "exhausted",
  "exam stress",
  "sleep trouble",
  "focusing",
  "blank out",
  "self-worth",
  "disappontment",
  "letting down",
  "family",
  "coping",
  "failure",
  "procrastination",
  "body image",
  "peer pressure",
  "identity",
  "sexuality",
  "bullying",
  "breakup",
  "body image",
  "social anxiety",
  "guilt",
  "loneliness",
  "self-doubt",
  "substance abuse",
  "trauma",
  "time management",
  "self-care",
  "parental presuure",
  "FOMO",
  "social media",
  "relationship",
  "career uncertainty",
  "financial pressure",
  "learning difficulty",
  "drugs",
  "alcohol",
  "therapy",
  "counselling",
  "tension",
  "partying",
  "misunderstanding",
  "expectation",
  "money issue",
  "lack of motivation",
  "career uncertainty",
  "bored",
  "work pressure",
  "work stress",
];
const defaultKeyWords = [
  "afraid",
  "angry",
  "anger",
  "anxious",
  "anxiety",
  "burnout",
  "calm",
  "confident",
  "confused",
  "depressed",
  "depression",
  "low energy",
  "drained",
  "fear",
  "frustrated",
  "frustration"
];

// Fallback sensitive words in case file is not available or empty
const defaultSensitiveWords = {
  suicidal: [
    "suicide",
    "kill myself",
    "end my life",
    "take my life",
    "want to die",
    "don't want to live",
    "no reason to live",
    "better off dead",
  ],
  selfHarm: [
    "cut myself",
    "hurt myself",
    "self harm",
    "harming myself",
    "injure myself",
    "burn myself",
    "self-injury",
    "self-mutilation",
  ],
  violence: [
    "want to hurt",
    "kill someone",
    "attack",
    "revenge",
    "violent thoughts",
    "harm others",
    "murder",
    "assault",
  ],
  depression: [
    "hopeless",
    "worthless",
    "empty",
    "never get better",
    "can't go on",
    "giving up",
    "overwhelmed",
    "darkness",
  ],
  anxiety: [
    "panic attack",
    "can't breathe",
    "heart racing",
    "terrified",
    "constant worry",
    "fear everything",
    "nowhere safe",
  ],
  substance: [
    "overdose",
    "too many pills",
    "mixing drugs",
    "alcohol blackout",
    "relapse",
    "withdrawal",
    "addiction",
  ],
};

/**
 * Calculates the severity level based on matched categories
 * @param {Object} matches Object containing matched categories and words
 * @returns {string} Severity level (high, medium, low, none)
 */
function calculateSeverity(matches) {
  const categories = Object.keys(matches);

  // High priority categories that should trigger immediate attention
  const highPriorityCategories = ["suicidal", "selfHarm", "violence"];

  if (categories.some((cat) => highPriorityCategories.includes(cat))) {
    return "high";
  } else if (categories.length > 1) {
    return "medium";
  } else if (categories.length === 1) {
    return "low";
  }

  return "none";
}

/**
 * Tracks a sensitive word for a specific user
 * @param {string} userId User's ID
 * @param {string} sensitiveWord Sensitive word category to track
 * @returns {Promise<void>}
 */

const trackSensitiveWord = async (userId, sensitiveWord) => {
  try {
    if (!userId || !ObjectId.isValid(userId)) {
      console.error("Invalid userId for tracking sensitive word");
      return;
    }

    const objectId = new ObjectId(userId);

    // Find the user document
    const user = await AIchatbot.findOne({ userId: objectId });

    if (user) {
      // Check if sensitiveWords array exists
      if (user.sensitiveWords && Array.isArray(user.sensitiveWords)) {
        // If user exists, check if the sensitive word is already tracked
        const sensitiveWordIndex = user.sensitiveWords.findIndex(
          (item) => item.word === sensitiveWord
        );

        if (sensitiveWordIndex >= 0) {
          // Increment count if word exists
          await AIchatbot.updateOne(
            { userId: objectId, "sensitiveWords.word": sensitiveWord },
            { $inc: { "sensitiveWords.$.count": 1 } }
          );
        } else {
          // Add new word with count 1
          await AIchatbot.updateOne(
            { userId: objectId },
            { $push: { sensitiveWords: { word: sensitiveWord, count: 1 } } }
          );
        }
      } else {
        // User exists but doesn't have sensitiveWords array yet
        await AIchatbot.updateOne(
          { userId: objectId },
          { $set: { sensitiveWords: [{ word: sensitiveWord, count: 1 }] } }
        );
      }
    } else {
      // Create new user document with the sensitive word
      const newChatbot = new AIchatbot({
        userId: objectId,
        chat_history: [],
        sensitiveWords: [{ word: sensitiveWord, count: 1 }],
        keyWords: []
      });
      await newChatbot.save();
    }
  } catch (error) {
    console.error("Error tracking sensitive word:", error);
    // Don't throw to prevent disrupting the main flow
  }
};

const trackKeyWord = async (userId, keyWord) => {
  try {
    if (!userId || !ObjectId.isValid(userId)) {
      console.error("Invalid userId for tracking keyword");
      return;
    }

    const objectId = new ObjectId(userId);

    // Find the user document
    const user = await AIchatbot.findOne({ userId: objectId });

    if (user) {
      // Check if keyWords array exists
      if (user.keyWords && Array.isArray(user.keyWords)) {
        // If user exists, check if the keyword is already tracked
        const keyWordIndex = user.keyWords.findIndex(
          (item) => item.word === keyWord
        );

        if (keyWordIndex >= 0) {
          // Increment count if word exists
          await AIchatbot.updateOne(
            { userId: objectId, "keyWords.word": keyWord },
            { $inc: { "keyWords.$.count": 1 } }
          );
        } else {
          // Add new word with count 1
          await AIchatbot.updateOne(
            { userId: objectId },
            { $push: { keyWords: { word: keyWord, count: 1 } } }
          );
        }
      } else {
        // User exists but doesn't have keyWords array yet
        await AIchatbot.updateOne(
          { userId: objectId },
          { $set: { keyWords: [{ word: keyWord, count: 1 }] } }
        );
      }
    } else {
      // Create new user document with the keyword
      const newChatbot = new AIchatbot({
        userId: objectId,
        chat_history: [],
        keyWords: [{ word: keyWord, count: 1 }],
        sensitiveWords: []
      });
      await newChatbot.save();
    }
  } catch (error) {
    console.error("Error tracking keyword:", error);
    // Don't throw to prevent disrupting the main flow
  }
};


/**
 * Analyzes text for sensitive content
 * @param {string} userId User's ID
 * @param {string} text Text to analyze
 * @returns {Promise<Object>} Analysis results
 */
async function analyzeSensitiveContent(userId, text) {
  try {
    // Validate parameters
    if (!text || typeof text !== "string") {
      console.error("Invalid or missing text parameter");
      return {
        matches: {},
        hasSensitiveContent: false,
        categoriesWithMatches: [],
        severity: "none",
      };
    }

    if (!userId || !ObjectId.isValid(userId)) {
      console.error("Invalid or missing userId parameter");
      return {
        matches: {},
        hasSensitiveContent: false,
        categoriesWithMatches: [],
        severity: "none",
      };
    }

    // Use file-loaded words or fallback to default if empty
    const wordsToUse =
      Object.keys(sensitiveWords).length > 0
        ? sensitiveWords
        : defaultSensitiveWords;

    const keyWordsToUse =
      keyWords.length > 0 ? keyWords : defaultKeyWords;

    const textLower = text.toLowerCase();
    const matches = {};
    let hasSensitiveContent = false;

    // Find matches across all categories
    Object.keys(wordsToUse).forEach((category) => {
      const matchedWords = wordsToUse[category].filter((word) =>
        textLower.includes(word.toLowerCase())
      );

      if (matchedWords.length > 0) {
        matches[category] = matchedWords;
        hasSensitiveContent = true;
      }
    });

    // Find matches for keywords
    const matchedKeyWords = keyWordsToUse.filter((word) =>
      textLower.includes(word.toLowerCase())
    );

    const categoriesWithMatches = Object.keys(matches); // Categories with matches

    try {
      // Track sensitive word categories
      const sensitivePromises = categoriesWithMatches.map((category) =>
        trackSensitiveWord(userId, category)
      );
      
      // Track individual keywords
      const keywordPromises = matchedKeyWords.map((keyword) =>
        trackKeyWord(userId, keyword)
      );
      
      // Wait for all tracking operations to complete
      await Promise.all([...sensitivePromises, ...keywordPromises]);
    } catch (error) {
      console.error("Error tracking words:", error);
    }

    const severity = calculateSeverity(matches);

    // Log results if needed (consider environment-based logging)
    if (process.env.NODE_ENV === "development") {
      console.log("matches:", matches);
      console.log("categoriesWithMatches:", categoriesWithMatches);
      console.log("matchedKeyWords:", matchedKeyWords);
      console.log("severity:", severity);
    }

    return {
      matches,
      hasSensitiveContent,
      categoriesWithMatches,
      matchedKeyWords, // Include matched keywords in the response
      severity,
    };
  } catch (error) {
    console.error("Error analyzing sensitive content:", error);
    // Return safe default values on error
    return {
      matches: {},
      hasSensitiveContent: false,
      categoriesWithMatches: [],
      matchedKeyWords: [],
      severity: "none",
      error: error.message,
    };
  }
}

export { analyzeSensitiveContent };
