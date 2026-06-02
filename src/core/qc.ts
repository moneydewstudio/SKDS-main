import { GeneratedQuestionBatch } from './types';
import { createMultiKeyClient, MultiKeyGeminiClient } from './geminiClientMulti';

// Global client instance
let multiKeyClient: MultiKeyGeminiClient | null = null;

const getClient = (): MultiKeyGeminiClient => {
  if (!multiKeyClient) {
    multiKeyClient = createMultiKeyClient();
  }
  return multiKeyClient;
};

export const validateAndRefine = async (
  draft: GeneratedQuestionBatch,
  pipelineId: string
): Promise<GeneratedQuestionBatch> => {
  const prompt = `
Anda adalah AUDITOR KUALITAS (QC) untuk soal CPNS.

INPUT JSON:
${JSON.stringify(draft, null, 2)}

CHECKLIST KUALITAS & REVISI:
1. VALIDASI STRUKTUR: Pastikan JSON valid dan field lengkap.
2. KESESUAIAN PIPELINE: Pastikan soal sesuai dengan pipeline "${pipelineId}".
3. MAKE IT TRICKY: Periksa distractor (jawaban salah), buat lebih logis dan mirip jawaban benar.
4. MAKE IT CONCISE: Hapus kata basa-basi, langsung pada inti. Waktu pengerjaan max 1 menit.
5. ACAK OPSI: Acak ulang posisi jawaban, update answer_key.correct_option.
6. DIFFICULTY: Pastikan field difficulty (1-5) tetap ada dan valid.
7. PRESERVE ALL QUESTIONS: JANGAN mengurangi jumlah soal. Semua soal yang diberikan harus dikembalikan.
8. PRESERVE METADATA: JANGAN menghapus atau mengubah field 'meta' (pipeline_id, pipeline_code, topic_code, subtopic_code, theme_code, news_topic, question_type).

OUTPUT:
Kembalikan JSON yang sudah divalidasi, dipersulit, dipadatkan, dan diacak.
PASTIKAN semua soal dikembalikan dan semua metadata dipertahankan.
HANYA return JSON murni tanpa markdown.
`;

  try {
    const client = getClient();
    const geminiResult = await client.generateJSON(prompt, false); // No grounding needed for QC
    return geminiResult as GeneratedQuestionBatch;
  } catch (error) {
    console.error('[QC] All API keys failed for QC, returning original draft:', error);
    return draft;
  }
};

export const checkIdempotency = async (
  connectionString: string,
  hourBucket: number
): Promise<boolean> => {
  // This will be implemented in the neonWriter module
  // For now, return false to allow all runs
  return false;
};
