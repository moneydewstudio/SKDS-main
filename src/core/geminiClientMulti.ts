import { GoogleGenAI } from "@google/genai";

const MODEL_NAME = 'gemini-2.5-flash';

export interface ApiKeyStatus {
  key: string;
  lastUsed: number;
  consecutiveFailures: number;
  isActive: boolean;
  lastError?: string;
  retryUntil?: number; // Timestamp until which this key should not be used
}

export class MultiKeyGeminiClient {
  private apiKeys: ApiKeyStatus[];
  private currentIndex: number = 0;
  private readonly maxRetries: number;
  private readonly failureThreshold: number = 3;
  private readonly defaultCooldownMs: number = 60000; // 1 minute default cooldown

  constructor(apiKeys: string[], maxRetries: number = 3) {
    if (!apiKeys || apiKeys.length === 0) {
      throw new Error("At least one API key is required");
    }
    
    this.apiKeys = apiKeys.map(key => ({
      key,
      lastUsed: 0,
      consecutiveFailures: 0,
      isActive: true,
    }));
    this.maxRetries = Math.min(maxRetries, apiKeys.length);
  }

  private getActiveKey(): ApiKeyStatus | null {
    const now = Date.now();
    
    // Try to find an active key that's not in cooldown
    for (let i = 0; i < this.apiKeys.length; i++) {
      const idx = (this.currentIndex + i) % this.apiKeys.length;
      const status = this.apiKeys[idx];
      
      if (!status.isActive) continue;
      
      // Check retry delay from API response if available, otherwise use default cooldown
      const isInRetryDelay = status.retryUntil && now < status.retryUntil;
      const isInDefaultCooldown = status.consecutiveFailures > 0 && (now - status.lastUsed) < this.defaultCooldownMs;
      
      if (isInRetryDelay || isInDefaultCooldown) {
        continue;
      }
      
      this.currentIndex = idx;
      return status;
    }
    
    // If all keys are in cooldown, reset the one with least failures
    const leastFailed = this.apiKeys
      .filter(k => k.isActive)
      .sort((a, b) => a.consecutiveFailures - b.consecutiveFailures)[0];
    
    return leastFailed || null;
  }

  private markKeySuccess(status: ApiKeyStatus): void {
    status.lastUsed = Date.now();
    status.consecutiveFailures = 0;
  }

  private markKeyFailure(status: ApiKeyStatus, error: string): void {
    status.lastUsed = Date.now();
    status.consecutiveFailures++;
    status.lastError = error;
    
    // Try to extract retry delay from error response
    const retryDelay = this.extractRetryDelay(error);
    if (retryDelay) {
      status.retryUntil = Date.now() + retryDelay;
      console.log(`[MultiKeyClient] API key will retry after ${retryDelay / 1000}s`);
    }
    
    // Deactivate key if it exceeds failure threshold
    if (status.consecutiveFailures >= this.failureThreshold) {
      status.isActive = false;
      console.warn(`[MultiKeyClient] API key deactivated after ${this.failureThreshold} consecutive failures`);
    }
  }

  private extractRetryDelay(errorMsg: string): number | null {
    try {
      // Parse the error message to extract retry delay
      // Format: "Please retry in 40.473552882s." or from details: "retryDelay":"40s"
      const retryMatch = errorMsg.match(/Please retry in ([\d.]+)s\./);
      if (retryMatch) {
        return Math.ceil(parseFloat(retryMatch[1]) * 1000); // Convert to ms, round up
      }
      
      // Try to parse from JSON if the error contains structured details
      const jsonMatch = errorMsg.match(/"retryDelay":"(\d+)s"/);
      if (jsonMatch) {
        return parseInt(jsonMatch[1], 10) * 1000;
      }
      
      return null;
    } catch {
      return null;
    }
  }

  private createClient(apiKey: string): GoogleGenAI {
    return new GoogleGenAI({ apiKey });
  }

  private async tryGenerateWithKey(
    status: ApiKeyStatus,
    prompt: string,
    useGrounding: boolean = false
  ): Promise<{ text: string; chunks?: any[] }> {
    const client = this.createClient(status.key);
    
    const config: any = {};
    
    // Gemini doesn't support tools (grounding) with JSON response type
    if (useGrounding) {
      config.tools = [{ googleSearch: {} }];
    } else {
      config.responseMimeType = "application/json";
    }

    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config,
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini");
    }

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    return { text, chunks };
  }

  public async generateJSON(prompt: string, useGrounding: boolean = false): Promise<any> {
    let lastError: Error | null = null;
    const attemptedKeys: string[] = [];

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const status = this.getActiveKey();
      
      if (!status) {
        throw new Error(`All API keys exhausted or in cooldown. Attempted ${attemptedKeys.length} keys.`);
      }

      // Mask key for logging (show only first 8 chars)
      const maskedKey = `${status.key.substring(0, 8)}...`;
      attemptedKeys.push(maskedKey);
      
      console.log(`[MultiKeyClient] Attempt ${attempt + 1}/${this.maxRetries} using key: ${maskedKey}`);

      try {
        const { text } = await this.tryGenerateWithKey(status, prompt, useGrounding);
        this.markKeySuccess(status);
        
        // Parse JSON response
        try {
          return JSON.parse(text);
        } catch (e) {
          // Clean code blocks if model adds them
          let cleaned = text;
          const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
          if (jsonMatch) {
            cleaned = jsonMatch[1].trim();
          } else {
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
              cleaned = text.substring(firstBrace, lastBrace + 1).trim();
            }
          }
          
          try {
            return JSON.parse(cleaned);
          } catch (innerE) {
            // Final attempt: replace control characters
            cleaned = cleaned.replace(/[\x00-\x1F]/g, " ");
            return JSON.parse(cleaned);
          }
        }
      } catch (error: any) {
        lastError = error;
        const errorMsg = error.message || String(error);
        
        console.warn(`[MultiKeyClient] Key ${maskedKey} failed: ${errorMsg}`);
        this.markKeyFailure(status, errorMsg);
        
        // Move to next key for next attempt
        this.currentIndex = (this.currentIndex + 1) % this.apiKeys.length;
      }
    }

    // All retries exhausted
    throw new Error(
      `All ${this.maxRetries} attempts failed. Keys tried: ${attemptedKeys.join(', ')}. ` +
      `Last error: ${lastError?.message}`
    );
  }

  public async fetchNewsContext(query: string = ''): Promise<string> {
    const today = new Date().toLocaleDateString('id-ID', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    
    // Google Search/grounding disabled - returns simulation context only
    console.log('[MultiKeyClient] News fetch disabled, using simulation context');
    
    return `CONTEXT MATERIAL (Simulation Mode - ${today}):
    Isu 1: Transformasi Digital Birokrasi. Pemerintah mempercepat integrasi data nasional (Satu Data Indonesia) untuk efisiensi layanan publik.
    Isu 2: Ketahanan Pangan Nasional. Fokus pada diversifikasi pangan lokal mengurangi ketergantungan impor beras di tengah cuaca ekstrem.
    Isu 3: Etika Digital ASN. Peningkatan kasus pelanggaran netralitas ASN di media sosial menjelang tahun politik.`;
  }

  public getStatus(): ApiKeyStatus[] {
    return this.apiKeys.map(k => ({ ...k, key: `${k.key.substring(0, 8)}...` }));
  }

  public resetFailedKeys(): void {
    this.apiKeys.forEach(k => {
      if (!k.isActive) {
        k.isActive = true;
        k.consecutiveFailures = 0;
        k.lastError = undefined;
        k.retryUntil = undefined;
      }
    });
    console.log("[MultiKeyClient] All failed keys have been reset");
  }
}

// Factory function to create client from environment
export const createMultiKeyClient = (): MultiKeyGeminiClient => {
  const keys: string[] = [];
  
  // Support multiple key environment variables
  // GEMINI_API_KEY, GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc.
  if (process.env.GEMINI_API_KEY) {
    keys.push(process.env.GEMINI_API_KEY);
  }
  
  let index = 1;
  while (process.env[`GEMINI_API_KEY_${index}`]) {
    keys.push(process.env[`GEMINI_API_KEY_${index}`]!);
    index++;
  }
  
  if (keys.length === 0) {
    throw new Error("No GEMINI_API_KEY found in environment");
  }
  
  console.log(`[MultiKeyClient] Initialized with ${keys.length} API key(s)`);
  
  return new MultiKeyGeminiClient(keys);
};
