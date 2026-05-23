# Multi-Key API Fallback System

## Overview

The system now supports **automatic fallback** across multiple Gemini API keys. When one key fails (rate limit, quota exceeded, or error), the system automatically tries the next available key.

## Features

### 1. Automatic Key Rotation
- Primary key: `GEMINI_API_KEY`
- Backup keys: `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, ... (unlimited)
- Keys are tried in order until one succeeds or all fail

### 2. Smart Failure Handling
- **Failure Threshold**: Key deactivated after 3 consecutive failures
- **Dynamic Retry Delay**: Parses retry delay from API error response (e.g., "Please retry in 40s")
- **Fallback Cooldown**: 1 minute default cooldown if API doesn't provide retry delay
- **Automatic Recovery**: Keys re-enter rotation after cooldown/retry delay
- **Logging**: All key attempts logged with masked keys for security

### 3. Health Monitoring
Check key status anytime:
```bash
npm run worker:status
```

Output example:
```
[API Key Status]
  Key 1: AIzaSyA...
    Active: true
    Failures: 0
    Last Used: 2024-01-15T08:30:00.000Z
  Key 2: AIzaSyB...
    Active: false
    Failures: 3
    Last Used: 2024-01-15T08:25:00.000Z
    Last Error: Rate limit exceeded
```

### 4. Manual Reset
Reactivate all failed keys:
```bash
npm run worker:reset-keys
```

## Configuration

### Environment Variables

```bash
# Required: Primary key
GEMINI_API_KEY=AIzaSyA...

# Optional: Backup keys
GEMINI_API_KEY_1=AIzaSyB...
GEMINI_API_KEY_2=AIzaSyC...
GEMINI_API_KEY_3=AIzaSyD...
# ... as many as needed
```

### GitHub Actions Secrets

For the hourly worker in GitHub Actions, add all keys as secrets:

1. Go to Repository Settings → Secrets and Variables → Actions
2. Add secrets:
   - `GEMINI_API_KEY` (primary)
   - `GEMINI_API_KEY_1` (backup 1)
   - `GEMINI_API_KEY_2` (backup 2)
   - etc.

Update `.github/workflows/hourly-generator.yml` if you have multiple keys:

```yaml
env:
  GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  GEMINI_API_KEY_1: ${{ secrets.GEMINI_API_KEY_1 }}
  GEMINI_API_KEY_2: ${{ secrets.GEMINI_API_KEY_2 }}
  NEON_CONNECTION_STRING: ${{ secrets.NEON_CONNECTION_STRING }}
```

## Use Cases

### 1. Rate Limit Management
When you hit Gemini's rate limits, the system automatically switches to the next key without interrupting generation.

### 2. Quota Distribution
Spread quota across multiple Google Cloud projects by using keys from different projects.

### 3. High Availability
Ensure generation continues even if one API key is revoked or expires.

### 4. Testing Multiple Models
Use different Gemini API versions by configuring keys from different projects with different model settings.

## Architecture

```
┌─────────────────────────────────────────┐
│          MultiKeyGeminiClient           │
├─────────────────────────────────────────┤
│  - Maintains array of ApiKeyStatus      │
│  - Tracks failures and cooldowns        │
│  - Implements round-robin fallback      │
└─────────────────────────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    ▼              ▼              ▼
┌───────┐    ┌───────┐    ┌───────┐
│ Key 1 │───▶│ Key 2 │───▶│ Key 3 │───▶ ...
└───────┘    └───────┘    └───────┘
   │            │            │
   ▼            ▼            ▼
 Success?    Success?    Success?
   │            │            │
   Yes          Yes          Yes
   │            │            │
   ▼            ▼            ▼
  Return      Return       Return
   Result      Result       Result
```

## Implementation Details

### Dynamic Retry Delay Parsing
When the API returns a quota/rate limit error, the system extracts the retry delay from the error message:
- Format: `"Please retry in 40.473552882s."`
- Also parses from JSON: `"retryDelay":"40s"`
- Converts to milliseconds and stores as `retryUntil` timestamp
- Falls back to 1-minute cooldown if parsing fails

This ensures the system respects the API's guidance on when to retry, reducing unnecessary failed attempts.

### Key Masking
For security, logs only show the first 8 characters of each key:
```
Using key: AIzaSyA...
```

### Failure Types That Trigger Fallback
- Rate limit exceeded (429) - Uses API-provided retry delay
- Quota exceeded (403) - Uses API-provided retry delay
- Network errors - Uses default 1-minute cooldown
- Timeout errors - Uses default 1-minute cooldown
- Invalid API key errors - Uses default 1-minute cooldown

### What Does NOT Trigger Fallback
- Content policy violations (these are input issues)
- JSON parsing errors (these are model output issues)
- Prompt-related errors (these are configuration issues)

## Testing

### Test with Single Key
```bash
npm run worker:force
```

### Test with Multiple Keys
```bash
# Set up multiple keys in .env.local, then:
npm run worker:force
```

### Simulate Key Failure
To test fallback behavior, temporarily invalidate one key:
```bash
# In .env.local, corrupt one key:
GEMINI_API_KEY_1=invalid_key_here

# Run worker - it should fallback to next key
npm run worker:force
```

## Monitoring in Production

### Check Key Health
```bash
npm run worker:status
```

### View Logs in GitHub Actions
Failed keys are logged in workflow output:
```
[MultiKeyClient] Key AIzaSyA... failed: Rate limit exceeded
[MultiKeyClient] Key AIzaSyA... deactivated after 3 consecutive failures
[MultiKeyClient] Attempt 2/3 using key: AIzaSyB...
```

### Reset Failed Keys
If all keys become inactive:
```bash
npm run worker:reset-keys
```

Or trigger the workflow with `--reset-keys` flag (if configured in GitHub Actions).

## Best Practices

1. **Use Different Projects**: Keys from different Google Cloud projects have independent quotas
2. **Monitor Usage**: Set up alerts for quota usage across all projects
3. **Rotate Keys**: Periodically refresh keys for security
4. **Test Failover**: Regularly test that fallback works by temporarily disabling one key
5. **Log Review**: Check worker logs to identify which keys are failing most often

## Comparison: Single vs Multi-Key

| Scenario | Single Key | Multi-Key Fallback |
|----------|-----------|-------------------|
| Rate limit hit | ❌ Generation stops | ✅ Switches to next key |
| Quota exceeded | ❌ Generation stops | ✅ Switches to next key |
| Key revoked | ❌ Generation stops | ✅ Switches to next key |
| All keys fail | ❌ Generation stops | ❌ Generation stops (no keys left) |
| Maintenance | Manual intervention | Automatic recovery |

## Troubleshooting

### Issue: All keys showing inactive
**Cause**: All keys hit failure threshold
**Fix**: 
```bash
npm run worker:reset-keys
```

### Issue: Keys not being used
**Cause**: Environment variables not loaded
**Fix**: Check `.env.local` exists and `dotenv` is configured

### Issue: Same key always used
**Cause**: First key always succeeds, no need for fallback
**Fix**: This is normal behavior - fallback only activates on failure

### Issue: GitHub Actions not using multiple keys
**Cause**: Secrets not passed to workflow
**Fix**: Update workflow YAML to include all `GEMINI_API_KEY_N` secrets

## Future Enhancements

- [ ] Support for different LLM providers (OpenAI, Anthropic as fallback)
- [ ] Weighted key selection (some keys preferred over others)
- [ ] Cost-based routing (use cheaper keys first)
- [ ] Geographic routing (use closest region)
- [ ] Automatic key refresh via API
