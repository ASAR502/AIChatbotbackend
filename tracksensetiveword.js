import { ObjectId } from "mongodb";
import NodeCache from "node-cache";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import AIchatbot from "./Model/chathistory.js";
import Keyword from "./Model/KeyWordSchema.js";

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

// Fallback keywords (kept for backward compatibility)
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
  "frustration",
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
        keyWords: [],
      });
      await newChatbot.save();
    }
  } catch (error) {
    console.error("Error tracking sensitive word:", error);
    // Don't throw to prevent disrupting the main flow
  }
};

/**
 * Tracks keywords from the Keyword collection and updates their selectionCount
 * @param {string} text The text to analyze for keywords
 * @returns {Promise<Array>} Array of matched keywords with their details
 */
const trackKeyWord = async (text) => {
  try {
    if (!text || typeof text !== "string") {
      console.error("Invalid text for tracking keywords");
      return [];
    }

    const textLower = text.toLowerCase();
    const matchedKeywords = [];

    // Fetch all keywords from the Keyword collection
    const keywords = await Keyword.find({});

    if (!keywords || keywords.length === 0) {
      console.log("No keywords found in the collection");
      return [];
    }

    // Check each keyword against the text
    for (const keyword of keywords) {
      let isMatched = false;
      const keywordDetails = {
        _id: keyword._id,
        keywordId: keyword.keywordId,
        name: keyword.name, // This is a Map object
        matchedTerms: [],
      };

      // Check all language variants of the keyword
      for (const [lang, term] of keyword.name.entries()) {
        if (term && textLower.includes(term.toLowerCase())) {
          isMatched = true;
          keywordDetails.matchedTerms.push({
            language: lang,
            term: term,
          });
        }
      }

      // If keyword is matched, update its global selectionCount
      if (isMatched) {
        await Keyword.updateOne(
          { _id: keyword._id },
          {
            $inc: { selectionCount: 1 },
            $set: { lastSelectedAt: new Date() },
          }
        );

        matchedKeywords.push(keywordDetails);

        if (process.env.NODE_ENV === "development") {
          console.log(
            `Keyword matched: ${keyword.keywordId} - ${JSON.stringify(
              keywordDetails.matchedTerms
            )}`
          );
        }
      }
    }

    return matchedKeywords;
  } catch (error) {
    console.error("Error tracking keywords:", error);
    return [];
  }
};

// it is used to track keywords from the Keyword collection not updating here

const trackKeyWords = async (text) => {
  try {
    if (!text || typeof text !== "string") {
      console.error("Invalid text for tracking keywords");
      return [];
    }

    const textLower = text.toLowerCase();
    const matchedKeywords = [];

    // Fetch all keywords from the Keyword collection
    const keywords = await Keyword.find({});

    if (!keywords || keywords.length === 0) {
      console.log("No keywords found in the collection");
      return [];
    }

    // Check each keyword against the text
    for (const keyword of keywords) {
      let isMatched = false;
      const keywordDetails = {
        _id: keyword._id,
        keywordId: keyword.keywordId,
        name: keyword.name, // This is a Map object
        matchedTerms: [],
      };

      // Check all language variants of the keyword
      for (const [lang, term] of keyword.name.entries()) {
        if (term && textLower.includes(term.toLowerCase())) {
          isMatched = true;
          keywordDetails.matchedTerms.push({
            language: lang,
            term: term,
          });
        }
      }
      if (isMatched) {
        matchedKeywords.push(keywordDetails);
        if (process.env.NODE_ENV === "development") {
          console.log(
            `Keyword matched: ${keyword.keywordId} - ${JSON.stringify(
              keywordDetails.matchedTerms
            )}`
          );
        }
      }
    }

    return matchedKeywords;
  } catch (error) {
    console.error("Error tracking keywords:", error);
    return [];
  }
};
/**
 * Tracks keywords for a specific user in the chatbot collection
 * @param {string} userId User's ID
 * @param {Array} matchedKeywords Array of matched keywords from the Keyword collection
 * @returns {Promise<void>}
 */
const trackUserKeyWords = async (userId, matchedKeywords) => {
  try {
    if (!userId || !ObjectId.isValid(userId)) {
      console.error("Invalid userId for tracking user keywords");
      return;
    }

    if (!matchedKeywords || matchedKeywords.length === 0) {
      return;
    }

    const objectId = new ObjectId(userId);

    // Find the user document
    let user = await AIchatbot.findOne({ userId: objectId });

    if (!user) {
      // Create new user document
      user = new AIchatbot({
        userId: objectId,
        chat_history: [],
        keyWords: [],
        sensitiveWords: [],
      });
      await user.save();
    }

    // Process each matched keyword
    for (const matchedKeyword of matchedKeywords) {
      // Use _id instead of keywordId since you want to store ObjectId
      const { _id, keywordId, name } = matchedKeyword;

      // Check if this keyword is already tracked for the user
      // Compare using _id (ObjectId) instead of keywordId (string)
      const existingKeywordIndex = user.keyWords.findIndex(
        (item) => item.keywordId.toString() === _id.toString()
      );

      if (existingKeywordIndex >= 0) {
        // Increment count if keyword exists
        await AIchatbot.updateOne(
          { userId: objectId, "keyWords.keywordId": _id },
          {
            $inc: { "keyWords.$.count": 1 },
            $set: { "keyWords.$.lastSelectedAt": new Date() },
          }
        );
      } else {
        // Add new keyword entry
        const newKeywordEntry = {
          _id: new ObjectId(),
          keywordId: _id, // Store the ObjectId from the keyword document
          name: name, // Store the complete Map object
          count: 1,
          lastSelectedAt: new Date(),
        };

        await AIchatbot.updateOne(
          { userId: objectId },
          {
            $push: {
              keyWords: newKeywordEntry,
            },
          }
        );
      }

      if (process.env.NODE_ENV === "development") {
        console.log(
          `Tracked keyword for user ${userId}: ${keywordId} (ObjectId: ${_id})`
        );
      }
    }
  } catch (error) {
    console.error("Error tracking user keywords:", error);
    // Don't throw to prevent disrupting the main flow
  }
};

/**
 * Legacy function to track keywords in user's chat history (kept for backward compatibility)
 * @param {string} userId User's ID
 * @param {string} keyWord Keyword to track in user's history
 * @returns {Promise<void>}
 */

/**
 * Analyzes text for sensitive content and keywords
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
        matchedKeywords: [],
      };
    }

    if (!userId || !ObjectId.isValid(userId)) {
      console.error("Invalid or missing userId parameter");
      return {
        matches: {},
        hasSensitiveContent: false,
        categoriesWithMatches: [],
        severity: "none",
        matchedKeywords: [],
      };
    }

    // Use file-loaded words or fallback to default if empty
    const wordsToUse =
      Object.keys(sensitiveWords).length > 0
        ? sensitiveWords
        : defaultSensitiveWords;

    const textLower = text.toLowerCase();
    const matches = {};
    let hasSensitiveContent = false;

    // Find matches across all sensitive word categories
    Object.keys(wordsToUse).forEach((category) => {
      const matchedWords = wordsToUse[category].filter((word) =>
        textLower.includes(word.toLowerCase())
      );

      if (matchedWords.length > 0) {
        matches[category] = matchedWords;
        hasSensitiveContent = true;
      }
    });

    // Track keywords from the Keyword collection
    const matchedKeywords = await trackKeyWord(text);

    const categoriesWithMatches = Object.keys(matches); // Categories with matches

    try {
      // Track sensitive word categories
      const sensitivePromises = categoriesWithMatches.map((category) =>
        trackSensitiveWord(userId, category)
      );

      // Track keywords for the specific user
      await trackUserKeyWords(userId, matchedKeywords);

      // Wait for all tracking operations to complete
      await Promise.all(sensitivePromises);
    } catch (error) {
      console.error("Error tracking words:", error);
    }

    const severity = calculateSeverity(matches);

    // Log results if needed (consider environment-based logging)
    if (process.env.NODE_ENV === "development") {
      console.log("matches:", matches);
      console.log("categoriesWithMatches:", categoriesWithMatches);
      console.log("matchedKeywords:", matchedKeywords);
      console.log("severity:", severity);
    }

    return {
      matches,
      hasSensitiveContent,
      categoriesWithMatches,
      matchedKeywords, // Include matched keywords from the collection
      severity,
    };
  } catch (error) {
    console.error("Error analyzing sensitive content:", error);
    // Return safe default values on error
    return {
      matches: {},
      hasSensitiveContent: false,
      categoriesWithMatches: [],
      matchedKeywords: [],
      severity: "none",
      error: error.message,
    };
  }
}

export {
  analyzeSensitiveContent,
  trackKeyWord,
  trackUserKeyWords,
  trackKeyWords,
};
