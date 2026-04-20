interface KrdictItem {
  word?: string;
  sense?: {
    definition?: string;
    pos?: string;
  };
}

interface KrdictResponse {
  channel?: {
    total?: number;
    item?: KrdictItem | KrdictItem[];
  };
  error?: {
    error_code?: string | number;
    message?: string;
  };
}

interface ValidationResult {
  isValid: boolean;
  definition?: string;
  fromCache: boolean;
}

class WordValidator {
  private cache = new Map<string, ValidationResult>();
  private apiKey: string;
  private baseUrl = "https://krdict.korean.go.kr/api/search";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async validateWord(word: string): Promise<ValidationResult> {
    // Check cache first
    const cached = this.cache.get(word);
    if (cached) {
      return { ...cached, fromCache: true };
    }

    // Basic Korean word pattern check
    if (!/^[가-힣]+$/u.test(word)) {
      const result: ValidationResult = { isValid: false, fromCache: false };
      this.cache.set(word, result);
      return result;
    }

    try {
      const url = new URL(this.baseUrl);
      url.searchParams.set("key", this.apiKey);
      url.searchParams.set("q", word);
      url.searchParams.set("req_type", "xml");
      url.searchParams.set("num", "1");

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Accept": "application/xml",
          "User-Agent": "WBG-WordValidator/1.0",
        },
      });

      if (!response.ok) {
        throw new Error(`KRDICT API failed: ${response.status}`);
      }

      const xmlText = await response.text();
      
      // Parse XML response
      const totalMatch = xmlText.match(/<total>(\d+)<\/total>/);
      const total = totalMatch ? parseInt(totalMatch[1], 10) : 0;

      if (total === 0) {
        const result: ValidationResult = { isValid: false, fromCache: false };
        this.cache.set(word, result);
        return result;
      }

      // Extract definition if available
      const definitionMatch = xmlText.match(/<definition><!\[CDATA\[(.*?)\]\]><\/definition>/);
      const definition = definitionMatch ? definitionMatch[1] : undefined;

      const result: ValidationResult = { 
        isValid: true, 
        definition, 
        fromCache: false 
      };
      this.cache.set(word, result);
      return result;

    } catch (error) {
      console.warn("Word validation failed:", error);
      
      // Fallback: allow Korean words but mark as unverified
      const result: ValidationResult = { 
        isValid: true, // Allow through as fallback
        fromCache: false 
      };
      return result;
    }
  }

  // Preload common words into cache
  async preloadCommonWords(words: string[]): Promise<void> {
    const batchSize = 5;
    for (let i = 0; i < words.length; i += batchSize) {
      const batch = words.slice(i, i + batchSize);
      await Promise.all(batch.map(word => this.validateWord(word)));
      
      // Rate limiting: wait 100ms between batches
      if (i + batchSize < words.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0 // We'd need to track hits/misses to calculate this
    };
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Singleton instance
let validator: WordValidator | null = null;

export function getWordValidator(): WordValidator | null {
  if (typeof window === "undefined") {
    return null; // Server-side
  }

  if (!validator) {
    // Try to get API key from environment or fallback
    const apiKey = process.env.NEXT_PUBLIC_KRDICT_KEY || "";
    if (apiKey) {
      validator = new WordValidator(apiKey);
    }
  }

  return validator;
}

export async function validateWordRealtime(word: string): Promise<ValidationResult> {
  const validatorInstance = getWordValidator();
  
  if (!validatorInstance) {
    // Fallback: basic pattern check
    return {
      isValid: /^[가-힣]+$/u.test(word),
      fromCache: false
    };
  }

  return validatorInstance.validateWord(word);
}

export type { ValidationResult };