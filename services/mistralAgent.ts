import { GeneratedQuestionBatch } from "@/core/types";
import { SKD_PATTERN_SSOT } from "./skdPatternSSOT";
import { callGeminiJSON } from "./geminiAgent";

// AGENT 2: THE ARCHITECT (Generates Questions)

// Helper to make the actual API call
const callMistral = async (prompt: string): Promise<any> => {
  try {
    return await callGeminiJSON(prompt);
  } catch (error: any) {
    console.error("Generation Error:", error.message || error);
    throw new Error(`Generation API Error: ${error.message || 'Unknown'}`);
  }
};

const generateTiuQuestions = async (context: string, count: number, isHots: boolean, selectedTopic?: string, useNews: boolean = true) => {
  if (count <= 0) return [];

  const topicInstruction = selectedTopic 
    ? `FOKUS TOPIK (SANGAT PENTING): Anda WAJIB membuat soal HANYA untuk topik "${selectedTopic}". Abaikan instruksi "VARIASI SOAL" di bawah jika bertentangan dengan topik ini. Pastikan JSON output menggunakan topik ini di field "topic" dan "subtopic".`
    : `FOKUS TOPIK: Pilih topik TIU Numerik (seperti Deret Angka, Aritmetika Cepat, Aljabar, dll).`;

  const contextInstruction = useNews
    ? `KONTEKS BERITA:\n${context}\n\nTUGAS:\nBuat ${count} soal TIU Numerik. Gunakan informasi atau istilah dari berita sebagai bahan soal jika memungkinkan. Sesuaikan jenis soal dengan FOKUS TOPIK yang diminta.`
    : `REFERENSI BANK SOAL:\n${context}\n\nTUGAS:\nBuat ${count} soal TIU Numerik murni tanpa konteks berita, gunakan gaya dan format dari referensi Bank Soal di atas. Sesuaikan jenis soal dengan FOKUS TOPIK yang diminta.`;

  const prompt = `
    Anda adalah **AGENT B: SPECIALIST TIU (Tes Intelegensia Umum) NUMERIK**.
    
    ${contextInstruction}
    
    REFERENSI POLA SOAL (SSOT):
    ${SKD_PATTERN_SSOT}
    
    ${topicInstruction}
    
    LEVEL: HOTS (High Order Thinking Skills). Soal harus menuntut penalaran multi-langkah, pengenalan pola yang kompleks, logika analitis tingkat tinggi, dan sintesis informasi.
    
    VARIASI SOAL (Harus berbeda-beda sesuai dengan 7 sub-topik numerik TIU):
    1. **Berhitung/Aritmetika Cepat:** Operasi matematika dasar (tambah, kurang, kali, bagi, pecahan, persen, desimal) dengan trik hitung cepat.
    2. **Deret Angka (Pola Bilangan):** Hubungan angka (aritmetika bertingkat, berseling, kelipatan ganda, ganjil-genap).
    3. **Perbandingan Kuantitatif/Rasio:** Analisis data dua nilai numerik (rasio pekerja, rasio umur, rasio nilai).
    4. **Soal Cerita Kuantitatif:** Skenario jarak-waktu-kecepatan, laba-rugi, atau masalah kontekstual yang butuh perhitungan rumit tapi singkat.
    5. **Persentase/Pecahan/Desimal:** Pengolahan nilai persentase, pembagian desimal cepat.
    6. **Aljabar Dasar:** Persamaan linear sederhana atau substitusi nilai X dan Y.
    7. **Interpretasi Data/Tabel:** Jika relevan, ekstraksi insight numerik dari sebuah pernyataan data.

    DISTRACTOR (Pengecoh wajib menguji kecerobohan peserta):
    - Berikan hasil dari kesalahan urutan operasi (misal: penjumlahan dilakukan sebelum perkalian).
    - Berikan hasil dari kelupaan satu tahap akhir (misal: dihitung jarak total, padahal yang ditanya jarak sisa).
    - Untuk rasio, berikan opsi yang rasionya terbalik (misal: ditanya A:B, ada opsi untuk B:A).
    - Untuk deret angka, berikan angka hasil dari tebakan pola yang pendek/salah.

    SYARAT:
    - Harus ada SATU jawaban benar yang mutlak (logis/matematis).
    - Jangan buat soal opini.
    - Tentukan DIFFICULTY: 1 (Mudah) - 5 (Sangat Sulit).
    - RESTRAINTS: A question must can be done within 1 minute. The reading time for the question is approx. 30 seconds. Pastikan teks soal tidak terlalu panjang.

    FORMAT JSON:
    {
      "questions": [
        {
          "meta": { "news_topic": "Topik Berita", "question_type": "TIU" },
          "content": {
            "category": "TIU",
            "topic": "Numerik",
            "subtopic": "Silogisme / Aritmatika dll",
            "difficulty": 5,
            "question_text": "...",
            "options": { "A": "...", "B": "...", "C": "...", "D": "...", "E": "..." },
            "answer_key": {
              "correct_option": "A", 
              "tkp_points": null
            },
            "explanation": "Jelaskan langkah penyelesaian logika atau rumus matematikanya."
          }
        }
      ]
    }
  `;
  const result = await callMistral(prompt);
  return result.questions || [];
};

// MAIN DISPATCHER
export const generateDraftQuestions = async (contextMaterial: string, categories: string[], isHots: boolean, selectedTopic?: string, useNews: boolean = true): Promise<string> => {
  const totalQuestions = 1; // Number of generated questions
  
  const promises: Promise<any>[] = [];

  promises.push(generateTiuQuestions(contextMaterial, totalQuestions, isHots, selectedTopic, useNews));

  try {
    const results = await Promise.all(promises);
    const flattenedQuestions = results.flat();
    
    if (flattenedQuestions.length === 0) {
        throw new Error("Gagal membuat soal. Mohon coba lagi.");
    }

    // Shuffle results so categories are mixed
    const shuffled = flattenedQuestions.sort(() => Math.random() - 0.5);

    return JSON.stringify({ questions: shuffled });

  } catch (error) {
     console.error("Orchestration Error:", error);
     throw error;
  }
};
