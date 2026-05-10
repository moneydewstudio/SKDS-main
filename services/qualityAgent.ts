import { GeneratedQuestionBatch } from "@/core/types";
import { SKD_PATTERN_SSOT } from "./skdPatternSSOT";
import { callGeminiJSON } from "./geminiAgent";

// AGENT 3: THE AUDITOR (Quality Control)
const OPENROUTER_API_KEY = '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';
const QC_MODEL = 'stepfun/step-3.5-flash:free';

export const auditAndRefineQuestions = async (draftJsonString: string, selectedTopic?: string): Promise<GeneratedQuestionBatch> => {
  
  const topicCheck = selectedTopic 
    ? `\n    - **TOPIK WAJIB**: Pastikan soal yang dihasilkan BENAR-BENAR membahas topik "${selectedTopic}". Jika melenceng, perbaiki soal agar sesuai dengan topik tersebut.`
    : '';

  const prompt = `
    Anda adalah **AUDITOR KUALITAS (QC)**. Tugas Anda memeriksa output JSON soal CPNS.
    
    INPUT JSON:
    ${draftJsonString}

    REFERENSI POLA SOAL (SSOT):
    ${SKD_PATTERN_SSOT}

    CHECKLIST KUALITAS & REVISI:
    1. **VALIDASI STRUKTUR**: Pastikan JSON valid.
    2. **KESESUAIAN SSOT**: Pastikan soal, opsi, dan tingkat kesulitan (HOTS) mematuhi panduan di SSOT.${topicCheck}
    3. **MAKE IT TRICKY (PENGECOH)**: 
       - Periksa opsi jawaban yang salah (Distractor).
       - Ubah distractor yang terlalu mudah ditebak menjadi lebih logis dan mirip dengan jawaban benar.
       - Hindari opsi "Semua benar" atau "Tidak ada yang benar" kecuali sangat diperlukan.
    4. **MAKE IT CONCISE (PADAT)**:
       - Hapus kata-kata basa-basi ("Adapun", "Maka dari itu", "Sebagai berikut") yang tidak perlu.
       - Pastikan soal langsung pada inti masalah (To the point).
       - **TIME CONSTRAINT**: Sebuah soal harus bisa dikerjakan dalam waktu 1 menit. Waktu membaca soal maksimal sekitar 30 detik. Pangkas teks soal yang terlalu panjang.
    5. **ACAK OPSI (SHUFFLE)**: 
       - Acak ulang posisi teks jawaban (Options A-E). 
       - Update 'answer_key.correct_option' sesuai posisi baru.
    6. **DIFFICULTY**: Pastikan field 'difficulty' (1-5) tetap ada. Jika soal menjadi lebih sulit setelah revisi, naikkan nilainya.

    OUTPUT:
    Kembalikan JSON yang sudah divalidasi, dipersulit (tricky), dipadatkan (concise), dan diacak.
    HANYA return JSON murni.
  `;

  try {
    const geminiResult = await callGeminiJSON(prompt);
    return geminiResult as GeneratedQuestionBatch;
  } catch (error) {
    console.error("Quality Agent Error (Skipping QC):", error);
    // Fail safe: return the original draft if QC crashes
    try {
        return JSON.parse(draftJsonString);
    } catch (e) {
        throw new Error("Gagal parsing draft JSON (Critical Error).");
    }
  }
};