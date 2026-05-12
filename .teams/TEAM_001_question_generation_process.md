# TEAM_001: Question Generation Process Documentation

## Team Purpose
Documenting how questions are actually generated and inserted into the database based on historical team logs and analysis.

## Question Insertion Process Analysis

### Current Database Structure
The database uses a hierarchical taxonomy:
- **question_topics** (TWK, TIU, TKP) - Added in TEAM_019
- **question_categories** - Links topics to categories  
- **question_subtopics** (formerly subcategories) - Specific subtopics like "Verbal", "Numerik"
- **question_themes** - Optional themes under subtopics (e.g., "Sinonim", "Antonim") - Added in TEAM_035
- **questions** - Main table with actual questions

### Historical Insertion Methods

#### 1. Initial Question Import (TEAM_001)
- Questions were imported from external data sources
- Schema alignment issues were fixed to match Neon database structure
- Used `question_options.label/text` → `question_options.option_key/option_text` 

#### 2. Topic-Based Categorization (TEAM_019) 
- Created `question_topics` table with mapping: 1=TWK, 2=TIU, 3=TKP
- Updated questions to have `topicId` field for proper categorization
- Fixed category leakage where TWK drills contained TIU/TKP questions
- Imported topic_id data from `questions.json` to populate question records

#### 3. Theme Layer Addition (TEAM_035)
- Added optional `question_themes` table under subtopics
- Created nullable `questions.theme_id` field
- Generated seed SQL via `db/scripts/generate_question_themes_seed.mjs` 
- Process reads metadata JSON and creates SQL upserts for themes and question assignments

### Current Insertion Workflow

#### For New Questions:
1. **Metadata Preparation**: Create JSON with topic/subtopic/theme hierarchy
2. **Seed Generation**: Run generator script to create SQL seed files
3. **Database Migration**: Apply migration SQL for schema changes
4. **Seed Application**: Run generated seed SQL to populate data

#### Example Seed Generation:
```bash
node db/scripts/generate_question_themes_seed.mjs sample_metadata.json
```

#### SQL Pattern:
```sql
-- Insert themes
INSERT INTO question_themes (subtopic_id, code, name)
SELECT qst.id, 'VERBAL_ANALOGI', 'Analogi'
FROM subtopics qst
WHERE upper(qst.name) = upper('VERBAL')
ON CONFLICT (subtopic_id, code) DO UPDATE SET name = excluded.name;

-- Assign themes to questions
UPDATE questions q SET theme_id = qth.id
FROM question_subtopics qst
JOIN question_themes qth ON qth.subtopic_id = qst.id
WHERE q.id = [question_id];
```

### Key Files for Question Insertion

- **db/migrations/** - Schema changes (topics, themes, etc.)
- **db/seed/** - Generated SQL seed files
- **db/scripts/** - Generator scripts for creating seeds
- **api/src/schema.ts** - Drizzle ORM schema definitions
- **api/src/validation-queries.sql** - Validation queries for data integrity

### Important Notes

- Questions use `topicId` for main categorization (TWK/TIU/TKP)
- `themeId` is optional and used for finer-grained organization
- All insertions use idempotent `ON CONFLICT DO UPDATE` patterns
- Seed files are generated offline, not via runtime API endpoints
- The system prefers offline SQL generation over runtime admin endpoints for data integrity

This structured approach ensures consistent categorization and allows for hierarchical organization from broad topics down to specific themes.

## Team Members
- AI Assistant (Cascade)

## Date Created
2026-05-12

## Hypothesis for Question Themes Insertion Reliability

### Current Implementation Analysis

Based on the codebase analysis, the current `neonWriter.ts` implementation has several **critical vulnerabilities** in theme insertion:

#### 1. **Race Condition Vulnerability**
```typescript
// Lines 175-183: Theme insertion without transaction protection
const [theme] = await sql`
  INSERT INTO themes (subtopic_id, name, code)
  VALUES (${subtopicIdStr}, ${themeName}, ${themeCode})
  ON CONFLICT (subtopic_id, name) DO UPDATE SET 
    name = EXCLUDED.name,
    code = EXCLUDED.code
  RETURNING id
`;
```
**Problem**: Theme insertion happens outside of any transaction boundary. If the subsequent question insertion fails, the theme record remains orphaned.

#### 2. **Data Type Inconsistency**
```typescript
// Line 174: Unsafe type conversion
const subtopicIdStr = String(subtopic.id);
```
**Problem**: Converting UUID to string creates potential foreign key mismatches. The `themes.subtopic_id` column is TEXT but should match the actual data type.

#### 3. **Missing Cascade Protection**
```sql
-- Lines 68-76: Themes table lacks proper foreign key constraints
CREATE TABLE IF NOT EXISTS themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subtopic_id TEXT,  -- TEXT supports both INTEGER and UUID foreign keys
  name TEXT NOT NULL,
  code TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(subtopic_id, name)
)
```
**Problem**: No foreign key constraint ensures referential integrity. Orphaned themes can exist if subtopics are deleted.

#### 4. **Sequential Insertion Pattern**
```typescript
// Lines 140-279: Each question processed sequentially without batching
for (const q of questions) {
  // Insert topic
  // Insert subtopic  
  // Insert theme (if TIU)
  // Insert question
  // Insert options
  // Insert explanation
  // Insert tags
}
```
**Problem**: Sequential processing is slow and vulnerable to partial failures mid-batch.

### Root Cause Hypothesis

**Primary Issue**: The theme insertion process lacks **atomic transaction protection** and **proper foreign key relationships**, leading to potential data inconsistency during concurrent operations or failures.

**Secondary Issues**:
1. Type safety problems with UUID/TEXT mixing
2. No batch processing for performance
3. Missing validation of theme hierarchy integrity
4. No rollback mechanism for failed insertions

### Proposed Solution Architecture

#### 1. **Transaction-Wrapped Batch Processing**
```typescript
await db.transaction(async (tx) => {
  // Process all questions in single atomic transaction
  // All or nothing - rollback on any failure
});
```

#### 2. **Proper Foreign Key Schema**
```sql
ALTER TABLE themes 
ADD COLUMN subtopic_id UUID REFERENCES subtopics(id) ON DELETE CASCADE;
```

#### 3. **Type-Safe Insertion Pattern**
```typescript
// Use proper UUID handling, no string conversion
const [theme] = await tx.insert(themes).values({
  subtopicId: subtopic.id, // UUID type preserved
  name: themeName,
  code: themeCode
}).onConflictDoUpdate().returning();
```

#### 4. **Hierarchical Validation**
```typescript
// Validate theme exists under correct subtopic before question insertion
const themeExists = await validateThemeHierarchy(subtopicId, themeName);
if (!themeExists) throw new Error('Invalid theme hierarchy');
```

### Implementation Strategy

The solution requires **three coordinated changes**:

1. **Schema Migration**: Fix foreign key constraints and data types
2. **Transaction Refactoring**: Wrap entire batch processing in atomic transactions  
3. **Validation Layer**: Add hierarchy validation before insertion

This approach ensures **ACID compliance** and prevents orphaned themes while maintaining performance through batch operations.

## Status
Completed - Documentation of question generation process based on historical analysis
Updated - Added hypothesis for theme insertion reliability issues and proposed solution architecture
