import { neon } from "@neondatabase/serverless";
import { GeneratedQuestion, TkpPoints } from "@/core/types";

export const saveBatchToNeon = async (connectionString: string, questions: GeneratedQuestion[]): Promise<void> => {
  if (!connectionString) throw new Error("Connection string is empty");

  // Initialize Neon client
  const sql = neon(connectionString);

  try {
    // =========================================================
    // 1. DDL: SCHEMA INITIALIZATION (FINAL QUESTION SCHEMA)
    // =========================================================
    
    await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;

    // TABLE 1: TOPICS
    // Meaning: Exam section (TWK, TIU, TKP)
    // Columns: id, name (UNIQUE), created_at
    await sql`
      CREATE TABLE IF NOT EXISTS topics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // TABLE 2: SUBTOPICS
    // Meaning: Actual curriculum buckets (e.g., Nasionalisme, Numerik)
    // Columns: id, topic_id, name, created_at
    // Constraint: UNIQUE(topic_id, name)
    await sql`
      CREATE TABLE IF NOT EXISTS subtopics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(topic_id, name)
      )
    `;

    // TABLE 3: QUESTIONS
    // Columns: id, topic_id, subtopic_id, question_text, difficulty, question_type, 
    // time_limit_seconds, source, is_active, created_at, updated_at
    // TEAM_036: Changed id from UUID to TEXT for DDMMYYHHMM format
    await sql`
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
        subtopic_id UUID REFERENCES subtopics(id) ON DELETE SET NULL,
        question_text TEXT NOT NULL,
        difficulty INT DEFAULT 3,
        question_type VARCHAR(50) NOT NULL, -- 'single_correct' | 'weighted'
        time_limit_seconds INT DEFAULT 60,
        source TEXT, -- AI / internal / third-party
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // TABLE 4: OPTIONS
    // Columns: id, question_id, option_key, option_text, weight, is_correct, created_at
    // Constraints: UNIQUE(question_id, option_key)
    await sql`
      CREATE TABLE IF NOT EXISTS question_options (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
        option_key CHAR(1) NOT NULL,
        option_text TEXT NOT NULL,
        weight INT, -- nullable, 1-5 for TKP
        is_correct BOOLEAN, -- nullable, for TWK/TIU
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(question_id, option_key)
      )
    `;

    // TABLE 5: EXPLANATIONS
    // Columns: id, question_id, level, explanation_text, created_at
    // Constraint: UNIQUE(question_id, level)
    await sql`
      CREATE TABLE IF NOT EXISTS question_explanations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
        level VARCHAR(20) DEFAULT 'free', -- free | ad | premium
        explanation_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(question_id, level)
      )
    `;

    // TABLE 6: TAGS
    // Columns: id, question_id, tag, created_at
    await sql`
      CREATE TABLE IF NOT EXISTS question_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
        tag TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // =========================================================
    // 1.5 MIGRATION (Best Effort)
    // =========================================================
    // Handles transition from previous iterations if tables exist with different structure.
    try {
      // If 'topics' has 'question_categories' column from previous runs, make it nullable
      await sql`ALTER TABLE topics ALTER COLUMN question_categories DROP NOT NULL`;
      // Drop old unique constraint if it includes question_categories
      await sql`ALTER TABLE topics DROP CONSTRAINT IF EXISTS topics_question_categories_name_key`;
      // Ensure new constraint exists
      await sql`ALTER TABLE topics ADD CONSTRAINT topics_name_key UNIQUE (name)`;
    } catch (e) { /* ignore if column/constraint doesn't exist */ }

    try {
        // Drop 'category' string column from questions if exists, as it's now normalized via topic_id
        await sql`ALTER TABLE questions DROP COLUMN IF EXISTS category`;
        await sql`ALTER TABLE questions DROP COLUMN IF EXISTS question_categories`;
        
        // Ensure difficulty column exists (Migration for existing tables)
        await sql`ALTER TABLE questions ADD COLUMN IF NOT EXISTS difficulty INT DEFAULT 3`;
    } catch (e) { /* ignore */ }

    // =========================================================
    // 2. DATA INSERTION
    // =========================================================

    for (const q of questions) {
      // A. HANDLE TOPIC (The high-level Category: TWK, TIU, TKP)
      const categoryName = q.content.category; // TWK, TIU, TKP
      const [topic] = await sql`
        INSERT INTO topics (name) 
        VALUES (${categoryName})
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `;

      // B. HANDLE SUBTOPIC (The actual Topic content, e.g. Nasionalisme)
      // We map AI's 'topic' to DB's 'subtopic'.
      const subtopicName = q.content.topic || 'General'; 
      const [subtopic] = await sql`
        INSERT INTO subtopics (topic_id, name)
        VALUES (${topic.id}, ${subtopicName})
        ON CONFLICT (topic_id, name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `;

      // C. INSERT QUESTION
      const questionType = q.content.category === 'TKP' ? 'weighted' : 'single_correct';
      
      // Use the difficulty from the AI, or default to 3 if missing/invalid
      const difficultyLevel = (q.content.difficulty >= 1 && q.content.difficulty <= 5) 
          ? q.content.difficulty 
          : 3;

      // TEAM_036: Generate question ID in DDMMYYHHMM format
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = String(now.getFullYear()).slice(-2);
      const hour = String(now.getHours()).padStart(2, '0');
      const minute = String(now.getMinutes()).padStart(2, '0');
      const questionId = `${day}${month}${year}${hour}${minute}`;

      const [insertedQ] = await sql`
        INSERT INTO questions (
          id,
          topic_id, 
          subtopic_id, 
          question_text, 
          difficulty, 
          question_type, 
          time_limit_seconds,
          source, 
          is_active
        ) VALUES (
          ${questionId},
          ${topic.id}, 
          ${subtopic.id}, 
          ${q.content.question_text},
          ${difficultyLevel}, 
          ${questionType}, 
          60, -- Default time
          ${q.meta.news_topic}, 
          true
        )
        RETURNING id
      `;

      // D. INSERT OPTIONS
      for (const [key, text] of Object.entries(q.content.options)) {
        const optionKey = key.toUpperCase();
        let weight: number | null = null;
        let isCorrect: boolean | null = null;

        if (q.content.category === 'TKP') {
          weight = q.content.answer_key.tkp_points?.[key as keyof TkpPoints] || 0;
        } else {
          isCorrect = (optionKey === q.content.answer_key.correct_option);
        }

        await sql`
          INSERT INTO question_options (
            question_id, option_key, option_text, weight, is_correct
          ) VALUES (
            ${insertedQ.id}, ${optionKey}, ${text}, ${weight}, ${isCorrect}
          )
          ON CONFLICT (question_id, option_key) DO UPDATE SET 
            option_text = EXCLUDED.option_text,
            weight = EXCLUDED.weight,
            is_correct = EXCLUDED.is_correct
        `;
      }

      // E. INSERT EXPLANATION
      await sql`
        INSERT INTO question_explanations (question_id, level, explanation_text)
        VALUES (${insertedQ.id}, 'free', ${q.content.explanation})
        ON CONFLICT (question_id, level) DO UPDATE SET explanation_text = EXCLUDED.explanation_text
      `;

      // F. INSERT TAG (Optional: Use subtopic from AI or source)
      const tag = q.content.subtopic || 'General';
      if (tag) {
        // Check if exists strictly to avoid clutter, or just insert
        await sql`
          INSERT INTO question_tags (question_id, tag)
          VALUES (${insertedQ.id}, ${tag})
        `;
      }
    }

  } catch (error: any) {
    console.error("Neon DB Error:", error);
    if (error.message?.includes('value too long')) {
         throw new Error("Teks terlalu panjang untuk database. Kami telah memperbarui skema, silakan coba simpan lagi.");
    }
    throw new Error(`Gagal menyimpan ke database: ${error.message}`);
  }
};