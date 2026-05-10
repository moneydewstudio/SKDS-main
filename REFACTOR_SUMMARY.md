# Multi-Pipeline Hourly Generator - Refactor Summary

## What Changed

### Architecture
- **Before:** Single-question client-side generator (Vite/React only)
- **After:** Multi-pipeline hourly generator with GitHub Actions worker + UI viewer

### Key Additions

1. **`src/core/`** - Pure TypeScript modules (no browser deps)
   - `types.ts` - Shared types including PipelineSpec
   - `geminiClient.ts` - Gemini API wrapper with Grounding
   - `pipelineLoader.ts` - Load and validate pipeline JSONs
   - `router.ts` - Stateless deterministic pipeline selection
   - `promptBuilder.ts` - Assemble prompts from templates
   - `qc.ts` - Quality control / validation
   - `neonWriter.ts` - Database persistence

2. **`pipelines/`** - Data-first pipeline specifications
   - `tiu/numerik-deret.json` - TIU Numerik Deret Angka
   - `tiu/numerik-aritmetika.json` - TIU Numerik Aritmetika
   - `twk/nasionalisme.json` - TWK Nasionalisme
   - `tkp/sosial-kultural.json` - TKP Sosial Kultural
   - JSON schema with prompt templates, examples, difficulty schedules

3. **`scripts/hourlyWorker.ts`** - GitHub Actions entry point
   - Loads pipelines, selects 1 per category (TWK/TIU/TKP)
   - Runs generation with idempotency check (skips if hour already processed)
   - Supports `--force` flag to override

4. **`.github/workflows/hourly-generator.yml`** - Cron workflow
   - Runs every hour (`0 * * * *`)
   - Supports `workflow_dispatch` with force/query inputs

5. **Security improvements**
   - Removed `GEMINI_API_KEY` from `vite.config.ts` (no longer exposed to client)
   - API keys only in GitHub Secrets for worker

### Updated Dependencies
```json
"dotenv": "^16.4.5"        // For worker environment
"ts-node": "^10.9.2"       // Run TypeScript directly
```

## How It Works

### Hourly Generation Flow
1. GitHub Actions triggers every hour
2. Worker calculates `epochHour = Math.floor(Date.now() / 3600000)`
3. Check idempotency: skip if `hour-{epochHour}` exists in DB
4. Load all pipelines from `pipelines/` directory
5. Select 1 pipeline per category using modulo rotation:
   - `twk = twkPipelines[epochHour % twkCount]`
   - `tiu = tiuPipelines[epochHour % tiuCount]`
   - `tkp = tkpPipelines[epochHour % tkpCount]`
6. For each pipeline:
   - Fetch context (news/bank/syllabus)
   - Determine difficulty from schedule
   - Build prompt from template
   - Generate with Gemini
   - Apply QC validation
7. Save all 3 questions to Neon DB with `source = hour-{epochHour}`

### Manual Testing
```bash
# Install new dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your keys

# Run worker locally (with idempotency check)
npm run worker

# Force run (ignore idempotency)
npm run worker:force

# Test specific query
npx ts-node scripts/hourlyWorker.ts --query="Pemilu 2024"
```

## Configuration Required

### GitHub Repository Secrets
Go to Settings > Secrets and variables > Actions, add:
- `GEMINI_API_KEY` - Your Gemini API key
- `NEON_CONNECTION_STRING` - Neon database connection string

### Local Development
Create `.env.local`:
```
GEMINI_API_KEY=your_key
NEON_CONNECTION_STRING=your_connection_string
```

## UI Changes
- UI still shows generated questions (reads from Neon)
- Manual generation can call same core modules via API endpoint (future enhancement)
- Pipeline config UI can be added to view/edit JSON specs

## Next Steps / TODO
1. Add more pipeline JSONs for complete coverage
2. Create API endpoint for UI manual trigger
3. Add pipeline validation schema (AJV)
4. Add pipeline config UI in React
5. Add monitoring/alerting for failed generations
6. Add retry logic with exponential backoff
