import express from "express";
import {
  TranslateClient,
  TranslateTextCommand,
} from "@aws-sdk/client-translate";

// Configure AWS SDK - SECURITY NOTE: Use environment variables for credentials
const client = new TranslateClient({
  region: "ap-south-1", // or your AWS region
  credentials: {
    accessKeyId: "AKIARXEKZRAZHJP5JLP2", // Move to environment variables
    secretAccessKey: "wqit7gvq2Bn/eilMSg89iGsxxwvUYwJVPqM4t3EK", // Move to environment variables
  },
});

export async function translateWithAWS(
  text,
  sourceLang = "auto",
  targetLang = "en"
) {
  try {
    const command = new TranslateTextCommand({
      Text: text,
      SourceLanguageCode: sourceLang,
      TargetLanguageCode: targetLang,
    });

    const response = await client.send(command);
    return response.TranslatedText;
  } catch (err) {
    console.error("AWS Translate Error:", err);
    throw err;
  }
}
