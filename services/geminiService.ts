
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

const getAIClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const extractTextFromImage = async (base64Image: string): Promise<string> => {
  const ai = getAIClient();
  const imagePart = {
    inlineData: {
      mimeType: 'image/jpeg',
      data: base64Image.split(',')[1] || base64Image,
    },
  };
  
  const prompt = "Please perform OCR on this image. Extract all text exactly as it appears. If there are tables or lists, try to maintain their visual structure using markdown. Do not add any conversational text, just the extracted content.";

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: [imagePart, { text: prompt }] },
  });

  return response.text || "No text could be extracted.";
};

export const summarizeText = async (text: string): Promise<string> => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Please summarize the following extracted text into a concise, professional summary: \n\n${text}`,
  });
  return response.text || "Summary unavailable.";
};

export const translateText = async (text: string, targetLang: string = 'English'): Promise<string> => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Please translate the following text into ${targetLang}. Only provide the translation: \n\n${text}`,
  });
  return response.text || "Translation unavailable.";
};
