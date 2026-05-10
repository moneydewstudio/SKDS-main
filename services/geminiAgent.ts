import { GoogleGenAI } from "@google/genai";

const MODEL_NAME = 'gemini-2.5-flash'; 

const getAiInstance = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("CRITICAL: GEMINI_API_KEY is not set!");
    throw new Error("GEMINI_API_KEY is not configured in the environment.");
  }
  return new GoogleGenAI({ apiKey });
};

export const callGeminiJSON = async (prompt: string): Promise<any> => {
  const ai = getAiInstance();
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    }
  });
  
  const text = response.text;
  if (!text) throw new Error("Empty response from Gemini");
  
  try {
    return JSON.parse(text);
  } catch (e) {
    // Clean code blocks if model adds them despite responseMimeType
    let cleaned = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (jsonMatch) {
        cleaned = jsonMatch[1].trim();
    } else {
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            cleaned = text.substring(firstBrace, lastBrace + 1).trim();
        }
    }
    
    try {
        return JSON.parse(cleaned);
    } catch (innerE) {
        // Final attempt: replace unescaped control characters (like literal newline or tab) that cause parsing errors
        cleaned = cleaned.replace(/[\x00-\x1F]/g, " ");
        return JSON.parse(cleaned);
    }
  }
};

// ROLE: NEWS FETCHER & TOPIC GENERATOR
// This agent does NOT generate questions. It generates the 'Source Material'.
export const fetchNewsContext = async (query: string = ''): Promise<string> => {
  const ai = getAiInstance();
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  let prompt = '';
  
  if (query && query.trim().length > 0) {
      prompt = `Cari berita terkini, faktual, dan mendalam mengenai topik "${query}" di Indonesia.
      Fokus pada data dan fakta yang relevan untuk materi ujian CPNS (TWK/TIU/TKP).
      Berikan ringkasan padat tentang isu ini.
      Jangan buat soal, hanya materi sumber.`;
  } else {
      prompt = `Cari berita terpopuler Indonesia hari ini (${today}). 
      Analisis 3 isu krusial (Ekonomi, Politik, Sosial) yang cocok untuk dijadikan bahan ujian CPNS (TWK/TIU/TKP).
      Berikan ringkasan padat dan mendalam untuk setiap topik, termasuk data faktual jika ada.
      Jangan buat soal, hanya materi sumber.`;
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: { 
        tools: [{ googleSearch: {} }],
      },
    });
    
    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini Grounding");
    
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const urls = chunks.map((chunk: any) => chunk.web?.uri).filter(Boolean) as string[];
    const uniqueUrls = [...new Set(urls)];
    
    return uniqueUrls.length > 0 
      ? `CONTEXT MATERIAL (Source: Gemini Grounding - ${query || 'Trending'}):\n${text}\n\nREFERENCES:\n${uniqueUrls.join('\n')}` 
      : text;
      
  } catch (error: any) {
    console.warn("Gemini Search failed, using simulation:", error);
    return `CONTEXT MATERIAL (Simulation Mode - ${today}):
    Isu 1: Transformasi Digital Birokrasi. Pemerintah mempercepat integrasi data nasional (Satu Data Indonesia) untuk efisiensi layanan publik.
    Isu 2: Ketahanan Pangan Nasional. Fokus pada diversifikasi pangan lokal mengurangi ketergantungan impor beras di tengah cuaca ekstrem.
    Isu 3: Etika Digital ASN. Peningkatan kasus pelanggaran netralitas ASN di media sosial menjelang tahun politik.`;
  }
};
