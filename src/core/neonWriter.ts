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

    // Create tables (same schema as original neonService)
    // Use CREATE TABLE IF NOT EXISTS for idempotency
    await sql`
      CREATE TABLE IF NOT EXISTS topics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS subtopics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        topic_id UUID,
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
      console.log('[Neon] Note: subtopics code column:', e.message);
    }

    // FIXED: Themes table with proper UUID type
    await sql`
    CREATE TABLE IF NOT EXISTS themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subtopic_id INTEGER NOT NULL,  -- Match existing subtopics.id type
    name TEXT NOT NULL,
    code TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(subtopic_id, name)
  )
    `;

    console.log('[Neon] Themes table ready (UUID-based)');

    await sql`
      CREATE TABLE IF NOT EXISTS questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        topic_id UUID,
        subtopic_id UUID,
        theme_id UUID,  -- NEW: 3rd level
        question_text TEXT NOT NULL,
        difficulty INT DEFAULT 3,
        question_type VARCHAR(50) NOT NULL,
        time_limit_seconds INT DEFAULT 60,
        source TEXT,
        code TEXT,  -- question code from pipeline
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS question_options (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
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
        question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
        level VARCHAR(20) DEFAULT 'free',
        explanation_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(question_id, level)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS question_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
        tag TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Insert questions
    for (const q of questions) {
      const categoryName = q.content.category;
      
      // Insert topic (Level 1: TWK/TIU/TKP)
      const [topic] = await sql`
        INSERT INTO topics (name) 
        VALUES (${categoryName})
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `;

      // Insert subtopic (Level 2: e.g., Numerik, Verbal, Pancasila)
      const subtopicName = q.content.topic || 'General';
      const subtopicCode = q.meta.subtopic_code || null;
      const [subtopic] = await sql`
        INSERT INTO subtopics (topic_id, name, code)
        VALUES (${topic.id}, ${subtopicName}, ${subtopicCode})
        ON CONFLICT (topic_id, name) DO UPDATE SET 
          name = EXCLUDED.name,
          code = EXCLUDED.code
        RETURNING id
      `;

      // Insert theme (Level 3) - ONLY for TIU, null for TWK/TKP
      let themeId = null;
      const category = q.content.category;
      
      if (category === 'TIU') {
        // TIU has 3-level hierarchy with themes
        const themeName = q.content.subtopic || 'General';
        const themeCode = q.meta.theme_code || null;
        
        // FIXED: Use subtopic.id directly (UUID → UUID)
        const [theme] = await sql`
          INSERT INTO themes (subtopic_id, name, code)
          VALUES (${subtopic.id}, ${themeName}, ${themeCode})
          ON CONFLICT (subtopic_id, name) DO UPDATE SET 
            code = EXCLUDED.code
          RETURNING id
        `;
        themeId = theme.id;
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

      // Insert question with theme_id (null for TWK/TKP)
      // Insert question with theme_id (null for TWK/TKP) - handle duplicates
      const [insertedQ] = await sql`
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
          difficulty = EXCLUDED.difficulty
        RETURNING id
      `;

      // Insert options
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
      `;
      
      // Also insert theme_code as separate tag for metadata compliance
      if (codeTag !== 'GENERAL') {
        await sql`
          INSERT INTO question_tags (question_id, tag)
          VALUES (${insertedQ.id}, ${codeTag})
        `;
      }
    }

    console.log(`[Neon] Successfully saved ${questions.length} questions`);

  } catch (error: any) {
    console.error('Neon DB Error:', error);
    if (error.message?.includes('value too long')) {
      throw new Error('Teks terlalu panjang untuk database.');
    }
    throw new Error(`Gagal menyimpan ke database: ${error.message}`);
  }
};