import { GoogleGenAI, Type } from "@google/genai";
import { SEMANTIC_CHUNKER_PROMPT } from '../prompts';
import { GEMINI_API_KEY } from '../../config';

// Initialize GenAI
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export const chunkerService = {
  chunkText: async (text: string): Promise<any[]> => {
    if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured");
    }
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash", // Use flash for speed
      contents: SEMANTIC_CHUNKER_PROMPT(text),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              content: { type: Type.STRING },
              summary: { type: Type.STRING },
              boundaryReason: { type: Type.STRING },
            },
            required: ["content", "summary", "boundaryReason"],
          },
        },
      },
    });
    return JSON.parse(response.text || "[]");
  }
};
