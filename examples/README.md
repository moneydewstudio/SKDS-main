# Examples System

This directory contains **external example files** for pipeline specifications. These examples provide AI models with reference patterns for generating questions.

## Directory Structure

```
examples/
├── tiu/          # Tes Intelegensia Umum examples
│   ├── tiu-numerik-logika.examples.json
│   └── ...
├── twk/          # Tes Wawasan Kebangsaan examples
│   ├── twk-pancasila.examples.json
│   └── ...
└── tkp/          # Tes Karakteristik Pribadi examples
    ├── tkp-pelayanan-publik.examples.json
    └── ...
```

## File Naming Convention

```
{pipeline-id}.examples.json
```

Example: `tiu-numerik-logika.examples.json`

## Example File Format

Each `.examples.json` file contains an array of 5+ example questions:

```json
[
  {
    "question": "Full question text here...",
    "options": {
      "A": "First option",
      "B": "Second option",
      "C": "Third option",
      "D": "Fourth option",
      "E": "Fifth option"
    },
    "answer": "B",
    "explanation": "Detailed explanation of why B is correct and why others are wrong"
  },
  ...
]
```

## Minimum Requirements

- **At least 5 examples** per pipeline
- **Varying difficulty** levels (2-5)
- **Clear explanations** for each answer
- **Diverse question patterns** to guide AI creativity

## Using External Examples in Pipelines

In your pipeline JSON, use `examplesFile` instead of inline `examples`:

```json
{
  "id": "tiu-numerik-logika",
  "category": "TIU",
  "topicCode": "TIU",
  "topicName": "Tes Intelegensia Umum",
  "subtopicCode": "TIU_NUMERIK",
  "subtopicName": "Numerik",
  "themeCode": "NUMERIK_LOGIKA_MATEMATIKA",
  "themeName": "Logika Matematika",
  "topic": "Numerik",
  "subtopic": "Logika Matematika",
  "syllabus": "Menguji kemampuan...",
  "contextSource": "bank",
  "promptTemplate": "...",
  "examplesFile": "tiu-numerik-logika.examples.json",
  "difficultySchedule": {
    "0": 2, "1": 2, "2": 3, ...
  }
}
```

## Benefits of External Examples

1. **Cleaner pipeline specs** - Config separate from content
2. **Easier editing** - Non-technical team can update examples
3. **Example reuse** - Same examples usable across similar pipelines
4. **Better version control** - Track example changes separately
5. **Scalable** - Easy to add more examples without bloating pipeline JSON

## Loading Process

The `pipelineLoader.ts` automatically:
1. Loads pipeline spec JSON
2. Checks if `examplesFile` is specified (and `examples` is empty)
3. Loads examples from `examples/{category}/{examplesFile}`
4. Injects examples into the spec before returning

## Migration Guide

To migrate existing pipelines:

1. Create `{pipeline-id}.examples.json` file
2. Copy existing `examples` array to new file
3. Remove `examples` array from pipeline JSON
4. Add `"examplesFile": "{filename}.examples.json"`

## Example Templates

### TIU (Numerical/Verbal)
Focus on: calculation steps, logic patterns, reasoning processes

### TWK (Knowledge)
Focus on: concept explanation, factual accuracy, context relevance

### TKP (Character)
Focus on: scoring rationale (1-5 points per option), situational judgment

## Quality Guidelines

- **Accurate**: Correct answers must be 100% accurate
- **Clear**: Explanations should teach the concept
- **Varied**: Different question patterns and difficulty levels
- **Relevant**: Match current syllabus and exam format
- **Complete**: All options explained, not just correct answer
