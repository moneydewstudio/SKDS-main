# Pipeline System

This directory contains **data-first pipeline specifications** for the multi-pipeline question generator. **All pipelines are compliant with questions_structure_data.json**.

## Hierarchy Structure

The database uses a **variable-level hierarchy** based on category:

| Category | Levels | Structure |
|----------|--------|-----------|
| **TWK** | 2 | `topic` → `subtopic` (theme = null) |
| **TIU** | 3 | `topic` → `subtopic` → `theme` |
| **TKP** | 2 | `topic` → `subtopic` (theme = null) |

## Pipeline Structure

```
pipelines/
├── twk/          # Tes Wawasan Kebangsaan (9 subtopics)
│   ├── twk-pancasila.json
│   ├── twk-uud1945.json
│   ├── twk-nkri.json
│   ├── twk-bhinneka.json
│   ├── twk-nasionalisme.json
│   ├── twk-bela-negara.json
│   ├── twk-anti-radikalisme.json
│   ├── twk-pilar-negara.json
│   └── twk-bahasa-negara.json
├── tiu/          # Tes Intelegensia Umum (5+5 themes)
│   ├── tiu-verbal-analogi.json
│   ├── tiu-verbal-sinonim.json
│   ├── tiu-verbal-antonim.json
│   ├── tiu-verbal-silogisme.json
│   ├── tiu-verbal-logika.json
│   ├── tiu-numerik-deret.json
│   ├── tiu-numerik-aritmatika.json
│   ├── tiu-numerik-perbandingan.json
│   ├── tiu-numerik-cerita.json
│   └── tiu-numerik-aljabar.json
└── tkp/          # Tes Karakteristik Pribadi (7 subtopics)
    ├── tkp-pelayanan-publik.json
    ├── tkp-jejaring-kerja.json
    ├── tkp-sosial-budaya.json
    ├── tkp-profesionalisme.json
    ├── tkp-anti-radikalisme.json
    ├── tkp-integritas.json
    └── tkp-tik.json
```

## Metadata-Compliant Structure

Pipelines follow the hierarchy from `questions_structure_data.json`:

### 2-Level Hierarchy (TWK & TKP)
Theme fields are `null` for 2-level hierarchies:

```json
{
  "category": "TWK",
  "topicCode": "TWK",
  "topicName": "Tes Wawasan Kebangsaan",
  "subtopicCode": "TWK_PANCASILA",
  "subtopicName": "Pancasila",
  "themeCode": null,           // NULL for 2-level
  "themeName": null,           // NULL for 2-level
  "topic": "Tes Wawasan Kebangsaan",  // Maps to topicName
  "subtopic": "Pancasila"             // Maps to subtopicName
}
```

### 3-Level Hierarchy (TIU)
TIU has full 3-level hierarchy with themes:

```json
{
  "category": "TIU",
  "topicCode": "TIU",
  "topicName": "Tes Intelegensia Umum",
  "subtopicCode": "TIU_NUMERIK",
  "subtopicName": "Numerik",
  "themeCode": "NUMERIK_DERET_ANGKA",
  "themeName": "Deret Angka",
  "topic": "Numerik",          // Maps to subtopicName
  "subtopic": "Deret Angka"    // Maps to themeName
}
```

## Complete Pipeline Specification

```json
{
  "id": "tiu-numerik-deret",
  
  // Level 1: Topic
  "category": "TIU",
  "topicCode": "TIU",
  "topicName": "Tes Intelegensia Umum",
  
  // Level 2: Subtopic
  "subtopicCode": "TIU_NUMERIK",
  "subtopicName": "Numerik",
  
  // Level 3: Theme (Granular subject)
  "themeCode": "NUMERIK_DERET_ANGKA",
  "themeName": "Deret Angka",
  
  // Legacy mapping (for backward compatibility)
  "topic": "Numerik",
  "subtopic": "Deret Angka",
  
  // Generation config
  "syllabus": "Mengenali pola bilangan dalam deret angka...",
  "contextSource": "bank",     // news | bank | syllabus
  "promptTemplate": "Prompt with {{placeholders}}",
  "examples": [...],
  "difficultySchedule": { "0": 3, "1": 4, ... }
}
```

## Metadata Mapping by Category

### TIU (3-Level)
| Database Field | Pipeline Field | Example |
|----------------|----------------|---------|
| `topicCode` | `category`, `topicCode` | "TIU" |
| `topicName` | `topicName` | "Tes Intelegensia Umum" |
| `subtopicCode` | `subtopicCode` | "TIU_NUMERIK" |
| `subtopicName` | `subtopicName` | "Numerik" |
| `themeCode` | `themeCode` | "NUMERIK_DERET_ANGKA" |
| `themeName` | `themeName` | "Deret Angka" |
| `topic` (legacy) | `topic` | "Numerik" (subtopicName) |
| `subtopic` (legacy) | `subtopic` | "Deret Angka" (themeName) |

### TWK/TKP (2-Level)
| Database Field | Pipeline Field | Example |
|----------------|----------------|---------|
| `topicCode` | `category`, `topicCode` | "TWK" |
| `topicName` | `topicName` | "Tes Wawasan Kebangsaan" |
| `subtopicCode` | `subtopicCode` | "TWK_PANCASILA" |
| `subtopicName` | `subtopicName` | "Pancasila" |
| `themeCode` | `themeCode` | `null` |
| `themeName` | `themeName` | `null` |
| `topic` (legacy) | `topic` | "Tes Wawasan Kebangsaan" (topicName) |
| `subtopic` (legacy) | `subtopic` | "Pancasila" (subtopicName) |

## Placeholders in promptTemplate

### TIU (3-Level)
- `{{topic}}` - subtopicName (e.g., "Numerik")
- `{{subtopic}}` - themeName (e.g., "Deret Angka")

### TWK/TKP (2-Level)
- `{{topic}}` - topicName (e.g., "Tes Wawasan Kebangsaan")
- `{{subtopic}}` - subtopicName (e.g., "Pancasila")
- `{{syllabus}}` - Syllabus description
- `{{difficulty}}` - Difficulty level (1-5)
- `{{examples}}` - Formatted example questions
- `{{contextMaterial}}` - Dynamic context (news, bank soal, etc.)

## Difficulty Schedule

Maps hour buckets to difficulty levels:
```json
{
  "0": 3,   // Hour 0 (00:00) = difficulty 3
  "1": 4,   // Hour 1 (01:00) = difficulty 4
  ...
  "23": 4   // Hour 23 (23:00) = difficulty 4
}
```

The worker uses: `difficulty = difficultySchedule[epochHour % 24]`

## Context Sources

- `news` - Uses Gemini with Google Search grounding to fetch trending news
- `bank` - Uses static BANK_SOAL_1 from constants
- `syllabus` - Uses structured syllabus reference only

## Available Pipelines (30 Total - 100% Coverage)

### TWK (Tes Wawasan Kebangsaan) - 9 Subtopics
| subtopic_id | Subtopic | Pipeline | Status |
|-------------|----------|----------|--------|
| 1 | Pancasila | `twk-pancasila.json` | ✅ |
| 2 | UUD 1945 | `twk-uud1945.json` | ✅ |
| 3 | NKRI | `twk-nkri.json` | ✅ |
| 4 | Bhinneka Tunggal Ika | `twk-bhinneka.json` | ✅ |
| 5 | Nasionalisme | `twk-nasionalisme.json` | ✅ |
| 7 | Bela Negara | `twk-bela-negara.json` | ✅ |
| 8 | Anti Radikalisme | `twk-anti-radikalisme.json` | ✅ |
| 76 | Pilar Negara | `twk-pilar-negara.json` | ✅ |
| 1236 | Bahasa Negara | `twk-bahasa-negara.json` | ✅ |

### TIU (Tes Intelegensia Umum) - 10 Themes
**Subtopic: Verbal (subtopic_id: 9)**
| theme_id | Theme | Pipeline | Status |
|----------|-------|----------|--------|
| 1 | Analogi | `tiu-verbal-analogi.json` | ✅ |
| 2 | Sinonim | `tiu-verbal-sinonim.json` | ✅ |
| 3 | Antonim | `tiu-verbal-antonim.json` | ✅ |
| 4 | Silogisme | `tiu-verbal-silogisme.json` | ✅ |
| 5 | Logika Analitis | `tiu-verbal-logika.json` | ✅ |

**Subtopic: Numerik (subtopic_id: 10)**
| theme_id | Theme | Pipeline | Status |
|----------|-------|----------|--------|
| 6 | Aritmatika Pecahan | `tiu-numerik-aritmatika.json` | ✅ |
| 7 | Deret Angka | `tiu-numerik-deret.json` | ✅ |
| 8 | Perbandingan | `tiu-numerik-perbandingan.json` | ✅ |
| 9 | Soal Cerita | `tiu-numerik-cerita.json` | ✅ |
| 10 | Aljabar | `tiu-numerik-aljabar.json` | ✅ |
| 11 | Logika Matematika | `tiu-numerik-logika.json` | ✅ |
| 12 | Geometri | `tiu-numerik-geometri.json` | ✅ |

### TKP (Tes Karakteristik Pribadi) - 7 Subtopics
| subtopic_id | Subtopic | Pipeline | Status |
|-------------|----------|----------|--------|
| 13 | Pelayanan Publik | `tkp-pelayanan-publik.json` | ✅ |
| 14 | Jejaring Kerja | `tkp-jejaring-kerja.json` | ✅ |
| 15 | Sosial Budaya | `tkp-sosial-budaya.json` | ✅ |
| 17 | Profesionalisme | `tkp-profesionalisme.json` | ✅ |
| 18 | Anti Radikalisme | `tkp-anti-radikalisme.json` | ✅ |
| 48 | Integritas | `tkp-integritas.json` | ✅ |
| 227 | TIK | `tkp-tik.json` | ✅ |

**Coverage: 30/30 (100%) 🎉 COMPLETE!**

## Routing Logic

The router selects 1 pipeline per category per hour:
```
twkPipeline = twkPipelines[epochHour % twkCount]
tiuPipeline = tiuPipelines[epochHour % tiuCount]
tkpPipeline = tkpPipelines[epochHour % tkpCount]
```

This ensures deterministic rotation across all pipelines.

## Adding New Pipelines

1. Check `questions_structure_data.json` for available `subtopic_id`/`theme_id`
2. For **TWK/TKP** (2-level): Set `themeCode: null`, `themeName: null`
3. For **TIU** (3-level): Use full hierarchy with `themeCode` and `themeName`
4. Follow naming: `{topic}-{subtopic}[-{theme}].json`
5. Test locally: `npm run worker -- --force`
6. Commit and push

## Pipeline Validation

All pipelines must include:
- [ ] `topicCode` matching database
- [ ] `subtopicCode` matching database
- [ ] `themeCode`: code for TIU, `null` for TWK/TKP
- [ ] `topic`/`subtopic`: Properly mapped based on hierarchy level
- [ ] `difficultySchedule` with 24 entries (hours 0-23)
- [ ] At least 1 example with complete Q&A
- [ ] Valid `contextSource` (news/bank/syllabus)

## Status

✅ **All 30 metadata-compliant pipelines created and ready for use!**

The pipeline system now provides complete coverage of the database structure with proper 2-level (TWK/TKP) and 3-level (TIU) hierarchy support.
