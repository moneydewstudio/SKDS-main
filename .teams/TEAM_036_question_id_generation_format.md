# TEAM_036: Question ID Generation Format Change

## Team Purpose
Update question ID generation to use timestamp-based format (DDMMYYHHMM) instead of UUID/SERIAL.

## Change Summary
Changed question ID generation from UUID (neonService.ts) and SERIAL (neonWriter.ts) to a timestamp-based format: DDMMYYHHMM.

## New ID Format
- **Format**: DDMMYYHHMM (10 digits)
- **Example**: 0106260556
  - 01 = day
  - 06 = month
  - 26 = year (2026)
  - 05 = hour
  - 56 = minutes

## Files Modified

### 1. services/neonService.ts
- **Schema Change**: Changed `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` to `id TEXT PRIMARY KEY`
- **Insertion Logic**: Added timestamp generation before question insertion:
  ```typescript
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const questionId = `${day}${month}${year}${hour}${minute}`;
  ```

### 2. src/core/neonWriter.ts
- **Schema Change**: Changed `id SERIAL PRIMARY KEY` to `id TEXT PRIMARY KEY`
- **Insertion Logic**: Added same timestamp generation before question insertion

## Benefits
- Human-readable IDs that show when a question was generated
- Easier to track and identify questions by creation time
- No dependency on database auto-increment or UUID generation
- Consistent format across both question insertion paths

## Migration Notes
- Existing questions with UUID/SERIAL IDs will need to be migrated if this change is applied to production
- The schema change requires dropping and recreating the questions table or using ALTER TABLE
- Foreign key references to questions.id may need adjustment if they expect UUID/INTEGER types

## Team Members
- AI Assistant (Cascade)

## Date Created
2026-06-01
