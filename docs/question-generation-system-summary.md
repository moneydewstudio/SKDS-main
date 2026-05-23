# Question Generation System Summary

## Overview
This document summarizes the complete architecture and workflow of the question generation system for SKDS (Sistem Kebijakan Digital Sipil).

## Database Hierarchy

The database uses a hierarchical taxonomy for organizing questions:

- **question_topics** (TWK, TIU, TKP) - Added in TEAM_019
- **question_categories** - Links topics to categories  
- **question_subtopics** - Specific subtopics like "Verbal", "Numerik"
- **question_themes** - Optional themes under subtopics (e.g., "Sinonim", "Antonim") - Added in TEAM_035
- **questions** - Main table with actual questions

## Historical Evolution

### TEAM_001: Initial Import
- Questions were imported from external data sources
- Schema alignment issues were fixed to match Neon database structure
- Used `question_options.label/text` → `question_options.option_key/option_text`

### TEAM_019: Topic-Based Categorization
- Created `question_topics` table with mapping: 1=TWK, 2=TIU, 3=TKP
- Updated questions to have `topicId` field for proper categorization
- Fixed category leakage where TWK drills contained TIU/TKP questions
- Imported topic_id data from `questions.json` to populate question records

### TEAM_035: Theme Layer Addition
- Added optional `question_themes` table under subtopics
- Created nullable `questions.theme_id` field
- Generated seed SQL via `db/scripts/generate_question_themes_seed.mjs`
- Process reads metadata JSON and creates SQL upserts for themes and question assignments

## Current Workflow

### For New Questions:
1. **Metadata Preparation**: Create JSON with topic/subtopic/theme hierarchy
2. **Seed Generation**: Run generator script to create SQL seed files
3. **Database Migration**: Apply migration SQL for schema changes
4. **Seed Application**: Run generated seed SQL to populate data

### Question Generation Process

#### Context Source Modes
- **News Mode** (DEPRECATED): Previously fetched real-time news with simulation fallback
- **Bank Mode** (CURRENT): Uses question examples from `examples/` JSON files and bank soal reference
- **Syllabus Mode**: Uses predefined syllabus content

#### Recent Changes (2026-05-12)
- Removed simulation mode fallback from `src/core/promptBuilder.ts`
- Changed all pipeline `contextSource` from `"news"` to `"bank"` for reliable offline generation
- Updated pipeline files to use examples-based generation instead of news fetching

## Key Technical Details

### Database Operations
- Uses idempotent `ON CONFLICT DO UPDATE` patterns
- Prefers offline SQL generation over runtime admin endpoints
- Seed files generated via `db/scripts/generate_question_themes_seed.mjs`
- Hierarchical organization from broad topics to specific themes
- `topicId` for main categorization, `themeId` for fine-grained organization

### Pipeline Configuration
- Pipeline files located in `pipelines/tiu/`, `pipelines/tkp/`, `pipelines/twk/`
- Each pipeline has `contextSource`, `promptTemplate`, `examplesFile`, and `difficultySchedule`
- Examples JSON files in `examples/` directory provide reference questions
- Bank soal reference in `constants/bankSoal.ts` provides additional context

## File Locations

### Database
- `db/migrations/` - Schema changes (topics, themes, etc.)
- `db/seed/` - Generated SQL seed files
- `db/scripts/` - Generator scripts for creating seeds

### API & Schema
- `api/src/schema.ts` - Drizzle ORM schema definitions
- `api/src/validation-queries.sql` - Data integrity validation

### Core Generation
- `src/core/promptBuilder.ts` - Context building and prompt generation
- `src/core/types.ts` - TypeScript interfaces for pipeline and question types
- `src/core/neonWriter.ts` - Database insertion logic

### Pipeline Configuration
- `pipelines/tiu/` - TIU (Tes Intelegensia Umum) pipeline configurations
- `pipelines/tkp/` - TKP (Tes Karakteristik Pribadi) pipeline configurations
- `pipelines/twk/` - TWK (Tes Wawasan Kebangsaan) pipeline configurations

### Examples & Reference
- `examples/tiu/` - TIU example questions
- `examples/tkp/` - TKP example questions
- `examples/twk/` - TWK example questions
- `constants/bankSoal.ts` - Large question bank reference

## Architecture Decisions

### Why Bank Mode Over News Mode
- **No External Dependencies**: Doesn't need internet/news APIs
- **Consistent Quality**: Uses proven question patterns from existing examples
- **Faster Generation**: No network latency from news fetching
- **Reliable**: Works offline, no API failures
- **Better Control**: Predictable context material for question generation

### Hierarchical Organization
- Topics (TWK/TIU/TKP) provide high-level categorization
- Subtopics provide domain-specific grouping
- Themes (optional) provide fine-grained organization
- This structure supports both broad and specific question organization

## Team Documentation

### Team Files
- `.teams/TEAM_001_question_generation_process.md` - Main documentation
- `.teams/TEAM_019_*` - Topic-based categorization changes
- `.teams/TEAM_035_*` - Theme layer implementation

### Key Team Rules
- Single Source of Truth (SSOT) for all planning
- Behavioral regression protection with baseline tests
- Modular refactoring with clear separation of concerns
- TODO tracking for incomplete work
- Handoff documentation for team continuity

## Current Status

### Completed (2026-05-12)
- ✅ Removed simulation mode fallback from promptBuilder.ts
- ✅ Updated multiple pipeline files to use bank context source
- ✅ Migration from news-based to examples-based generation

### Remaining Work
- Complete updating remaining pipeline files to bank context source
- Remove fetchNewsContext calls and related code
- Update prompt templates to remove news context references
- Verify all pipelines work correctly with bank mode

## References

### Related Documentation
- TEAM_001: Question Generation Process Documentation
- TEAM_019: Topic-Based Categorization Implementation
- TEAM_035: Theme Layer Addition
- 2026-05-12-question-themes-reliability.md: Theme insertion reliability analysis

### Technical Specifications
- Drizzle ORM for database operations
- Neon PostgreSQL database
- TypeScript for type safety
- JSON-based pipeline configuration
- Examples-driven question generation
