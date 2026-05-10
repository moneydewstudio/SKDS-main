import { GoogleGenAI } from "@google/genai";

const getAiInstance = () => {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
};

async function test() {
  const ai = getAiInstance();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: "Hello",
    });
    console.log("Success 2.5:", response.text);
  } catch (e: any) {
    console.error("Error 2.5:", e.message);
  }
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Hello",
    });
    console.log("Success 3:", response.text);
  } catch (e: any) {
    console.error("Error 3:", e.message);
  }
}
test();