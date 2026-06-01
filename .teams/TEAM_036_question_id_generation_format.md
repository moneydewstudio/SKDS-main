# TEAM_036: Question ID Generation Format Change (ROLLED BACK)

## Team Purpose
Update question ID generation to use timestamp-based format (DDMMYYHHMM) instead of UUID/SERIAL.

## ROLLBACK DECISION
**Status**: ROLLED BACK to legacy SERIAL/UUID ID generation method

**Reason**: The DDMMYYHHMM format approach was deemed potentially destructive due to:
- ALTER TABLE migrations could fail on existing databases
- Mixed ID formats (legacy UUID/SERIAL + new timestamp) create complexity
- Risk of data loss during schema migrations

**Alternative Solution**: Keep legacy ID generation (SERIAL/UUID) and add duplicate question checking to prevent replacement of existing questions.

## Rollback Changes

### 1. Schema Reversion
- **services/neonService.ts**: Reverted `id TEXT PRIMARY KEY` back to `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- **services/neonService.ts**: Reverted question_id foreign keys from TEXT back to UUID in related tables
- **src/core/neonWriter.ts**: Reverted `id TEXT PRIMARY KEY` back to `id SERIAL PRIMARY KEY`
- **src/core/neonWriter.ts**: Reverted question_id foreign keys from TEXT back to INTEGER in related tables

### 2. ID Generation Logic Removal
- Removed DDMMYYHHMM timestamp generation from both files
- Removed ALTER TABLE migration logic for type conversion

### 3. Duplicate Prevention (New)
- Added duplicate question checker before insertion in both files
- Checks for existing questions by `question_text` to prevent replacement
- Skips insertion if question with same text already exists
- Logs skipped duplicates for visibility

## Duplicate Checker Implementation
```typescript
// Check for duplicate question by question_text to prevent replacement
const existingQuestion = await sql`
  SELECT id FROM questions
  WHERE question_text = ${q.content.question_text}
  LIMIT 1
`;

if (existingQuestion && existingQuestion.length > 0) {
  console.log(`[Neon] Skipping duplicate question: ${q.content.question_text.substring(0, 50)}...`);
  continue; // Skip this question if it already exists
}
```

## Benefits of Rollback Approach
- No schema migration risks - existing databases remain stable
- No mixed ID format complexity
- Duplicate prevention ensures data integrity without destructive changes
- Legacy SERIAL/UUID generation is battle-tested and reliable

## Files Modified (Rollback)
- services/neonService.ts (schema reverted + duplicate checker added)
- src/core/neonWriter.ts (schema reverted + duplicate checker added)

## Team Members
- AI Assistant (Cascade)

## Date Created
2026-06-01

## Status
ROLLED BACK - Using legacy SERIAL/UUID ID generation with duplicate prevention
