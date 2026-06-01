import { neon } from '@neondatabase/serverless';
import { GeneratedQuestion, TkpPoints } from './types';

export const checkHourExists = async (
  connectionString: string,
  hourBucket: number
): Promise<boolean> => {
  const sql = neon(connectionString);
  
  try {
    const result = await sql`
      SELECT COUNT(*) as count 
      FROM questions 
      WHERE source = ${`hour-${hourBucket}`}
      LIMIT 1
    `;
    return (result[0]?.count || 0) > 0;
  } catch (e) {
    console.warn('Could not check hour exists (table may not exist yet):', e);
    return false;
  }
};

export const saveBatchToNeon = async (
  connectionString: string, 
  questions: GeneratedQuestion[],
  hourBucket?: number
): Promise<void> => {
  if (!connectionString) throw new Error('Connection string is empty');

  const sql = neon(connectionString);

  try {
    // Initialize extensions
    await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;

    // FIXED: Create tables matching existing INTEGER-based schema
    await sql`
      CREATE TABLE IF NOT EXISTS topics (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS subtopics (
        id SERIAL PRIMARY KEY,
        topic_id INTEGER REFERENCES topics(id),
        name TEXT NOT NULL,
        code TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(topic_id, name)
      )
    `;
    
    // Add code column if missing (migration from old schema)
    try {
      await sql`ALTER TABLE subtopics ADD COLUMN IF NOT EXISTS code TEXT`;
      console.log('[Neon] Added code column to subtopics');
    } catch (e: any) {
      console.log('[Neon] Note: subtopics code column already exists');
    }

   // Add code column if missing (migration from old schema)
try {
  await sql`ALTER TABLE subtopics ADD COLUMN IF NOT EXISTS code TEXT`;
  console.log('[Neon] Added code column to subtopics');
} catch (e: any) {
  console.log('[Neon] Note: subtopics code column already exists');
}

// FIXED: Drop and recreate themes table to fix schema mismatch
try {
  await sql`DROP TABLE IF EXISTS themes CASCADE`;
  console.log('[Neon] Dropped existing themes table (schema mismatch)');
} catch (e) {
  console.log('[Neon] No themes table to drop');
}

// Create themes table with correct INTEGER subtopic_id
await sql`
  CREATE TABLE themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subtopic_id INTEGER NOT NULL REFERENCES subtopics(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(subtopic_id, name)
  )
`;

console.log('[Neon] Themes table recreated (INTEGER subtopic_id, UUID id)');
    console.log('[Neon] Themes table ready (INTEGER subtopic_id, UUID id)');

    // FIXED: Questions table matching existing schema
    await sql`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        topic_id INTEGER REFERENCES topics(id),
        subtopic_id INTEGER REFERENCES subtopics(id),
        theme_id UUID REFERENCES themes(id) ON DELETE SET NULL,
        question_text TEXT NOT NULL,
        difficulty INT DEFAULT 3 CHECK (difficulty >= 1 AND difficulty <= 5),
        question_type VARCHAR(50) NOT NULL CHECK (question_type IN ('single_correct', 'weighted')),
        time_limit_seconds INT DEFAULT 60,
        source TEXT,
        code TEXT UNIQUE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS question_options (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
        option_key CHAR(1) NOT NULL,
        option_text TEXT NOT NULL,
        weight INT,
        is_correct BOOLEAN,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(question_id, option_key)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS question_explanations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
        level VARCHAR(20) DEFAULT 'free',
        explanation_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(question_id, level)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS question_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
        tag TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // FIXED: Wrap all inserts in a transaction for atomicity
    await sql`BEGIN`;

    try {
      // Process all questions
      for (const q of questions) {
        const categoryName = q.content.category;
        
        // Insert topic (Level 1: TWK/TIU/TKP)
        const topicResult = await sql`
          INSERT INTO topics (name) 
          VALUES (${categoryName})
          ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `;
        
        if (!topicResult || topicResult.length === 0) {
          throw new Error(`Failed to insert/find topic: ${categoryName}`);
        }
        const topic = topicResult[0];

        // Insert subtopic (Level 2: e.g., Numerik, Verbal, Pancasila)
        const subtopicName = q.content.topic || 'General';
        const subtopicCode = q.meta.subtopic_code || null;
        const subtopicResult = await sql`
          INSERT INTO subtopics (topic_id, name, code)
          VALUES (${topic.id}, ${subtopicName}, ${subtopicCode})
          ON CONFLICT (topic_id, name) DO UPDATE SET 
            code = EXCLUDED.code
          RETURNING id
        `;
        
        if (!subtopicResult || subtopicResult.length === 0) {
          throw new Error(`Failed to insert/find subtopic: ${subtopicName}`);
        }
        const subtopic = subtopicResult[0];

        // Insert theme (Level 3) - ONLY for TIU, null for TWK/TKP
        let themeId = null;
        const category = q.content.category;
        
        if (category === 'TIU') {
          // TIU has 3-level hierarchy with themes
          const themeName = q.content.subtopic || 'General';
          const themeCode = q.meta.theme_code || null;
          
          // FIXED: subtopic.id is now INTEGER, which matches themes.subtopic_id INTEGER
          const themeResult = await sql`
            INSERT INTO themes (subtopic_id, name, code)
            VALUES (${subtopic.id}, ${themeName}, ${themeCode})
            ON CONFLICT (subtopic_id, name) DO UPDATE SET 
              code = EXCLUDED.code
            RETURNING id
          `;
          
          if (!themeResult || themeResult.length === 0) {
            throw new Error(`Failed to insert/find theme: ${themeName}`);
          }
          
          themeId = themeResult[0].id;
          console.log(`[Debug] Created/found theme: ${themeName} with ID: ${themeId}`);
        }
        // TWK and TKP have 2-level hierarchy: theme_id remains null

        // Determine question type
        const questionType = category === 'TKP' ? 'weighted' : 'single_correct';
        
        // Validate difficulty
        const difficultyLevel = (q.content.difficulty >= 1 && q.content.difficulty <= 5) 
            ? q.content.difficulty 
            : 3;

        // Build source string with hour bucket if provided
        const source = hourBucket !== undefined 
          ? `hour-${hourBucket}|${q.meta.news_topic}` 
          : q.meta.news_topic;

        // Generate question code from pipeline info (if available in meta)
        const questionCode = q.meta.pipeline_code || null;

        // TEAM_036: Check for duplicate question by question_text to prevent replacement
        const existingQuestion = await sql`
          SELECT id FROM questions 
          WHERE question_text = ${q.content.question_text}
          LIMIT 1
        `;

        if (existingQuestion && existingQuestion.length > 0) {
          console.log(`[Neon] Skipping duplicate question: ${q.content.question_text.substring(0, 50)}...`);
          continue; // Skip this question if it already exists
        }

        // Insert question with proper type handling
        const questionResult = await sql`
          INSERT INTO questions (
            topic_id, 
            subtopic_id, 
            theme_id,
            question_text, 
            difficulty, 
            question_type, 
            time_limit_seconds,
            source, 
            code,
            is_active
          ) VALUES (
            ${topic.id}, 
            ${subtopic.id}, 
            ${themeId},
            ${q.content.question_text},
            ${difficultyLevel}, 
            ${questionType}, 
            60,
            ${source}, 
            ${questionCode},
            true
          )
          ON CONFLICT (code) DO UPDATE SET 
            updated_at = CURRENT_TIMESTAMP,
            theme_id = EXCLUDED.theme_id,
            difficulty = EXCLUDED.difficulty,
            question_text = EXCLUDED.question_text
          RETURNING id
        `;

        if (!questionResult || questionResult.length === 0) {
          throw new Error(`Failed to insert question: ${q.content.question_text.substring(0, 50)}`);
        }
        const insertedQ = questionResult[0];

        // Insert options
        for (const [key, text] of Object.entries(q.content.options)) {
          const optionKey = key.toUpperCase();
          let weight: number | null = null;
          let isCorrect: boolean | null = null;

          if (q.content.category === 'TKP') {
            weight = q.content.answer_key.tkp_points?.[key as keyof TkpPoints] || 0;
          } else {
            isCorrect = (optionKey === q.content.answer_key.correct_option.toUpperCase());
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

        // Insert explanation
        await sql`
          INSERT INTO question_explanations (question_id, level, explanation_text)
          VALUES (${insertedQ.id}, 'free', ${q.content.explanation})
          ON CONFLICT (question_id, level) DO UPDATE SET explanation_text = EXCLUDED.explanation_text
        `;

        // Insert tags - both theme name and theme code for flexible querying
        const themeTag = q.content.subtopic || 'General';
        const codeTag = q.meta.theme_code || 'GENERAL';
        
        await sql`
          INSERT INTO question_tags (question_id, tag)
          VALUES (${insertedQ.id}, ${themeTag})
          ON CONFLICT DO NOTHING
        `;
        
        // Also insert theme_code as separate tag for metadata compliance
        if (codeTag !== 'GENERAL') {
          await sql`
            INSERT INTO question_tags (question_id, tag)
            VALUES (${insertedQ.id}, ${codeTag})
            ON CONFLICT DO NOTHING
          `;
        }
      }

      // Commit transaction
      await sql`COMMIT`;
      console.log(`[Neon] Successfully saved ${questions.length} questions`);

    } catch (innerError) {
      // Rollback on any error
      await sql`ROLLBACK`;
      throw innerError;
    }

  } catch (error: any) {
    console.error('Neon DB Error:', error);
    if (error.message?.includes('value too long')) {
      throw new Error('Teks terlalu panjang untuk database.');
    }
    if (error.message?.includes('duplicate key')) {
      throw new Error('Kode pertanyaan sudah ada di database.');
    }
    if (error.message?.includes('foreign key')) {
      throw new Error('Referensi data tidak valid.');
    }
    throw new Error(`Gagal menyimpan ke database: ${error.message}`);
  }
};