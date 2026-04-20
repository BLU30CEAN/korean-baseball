import { composeHangulWord, isHangulWord } from "@/lib/game/hangul";

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

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-fA-F]+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function extractXmlTagValue(block: string, tagName: string): string | undefined {
  const pattern = new RegExp(String.raw`<${tagName}>([\s\S]*?)<\/${tagName}>`);
  const match = block.match(pattern);
  if (!match) {
    return undefined;
  }

  return decodeXml(match[1].trim());
}

class WordValidator {
  private cache = new Map<string, ValidationResult>();
  private apiKey: string;
  private baseUrl = "https://krdict.korean.go.kr/api/search";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async validateWord(word: string): Promise<ValidationResult> {
    const normalized = word.normalize("NFC").trim();

    // Check cache first
    const cached = this.cache.get(normalized);
    if (cached) {
      return { ...cached, fromCache: true };
    }

    if (!isHangulWord(normalized)) {
      const result: ValidationResult = { isValid: false, fromCache: false };
      this.cache.set(normalized, result);
      return result;
    }

    try {
      const url = new URL(this.baseUrl);
      url.searchParams.set("key", this.apiKey);
      url.searchParams.set("q", normalized);
      url.searchParams.set("req_type", "xml");
      url.searchParams.set("part", "word");
      url.searchParams.set("method", "exact");
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
      const items = xmlText.match(/<item>[\s\S]*?<\/item>/g) ?? [];

      for (const item of items) {
        const itemWord = extractXmlTagValue(item, "word")?.normalize("NFC").trim();
        if (itemWord !== normalized) {
          continue;
        }

        const definition = extractXmlTagValue(item, "definition");
        const result: ValidationResult = {
          isValid: true,
          definition,
          fromCache: false,
        };
        this.cache.set(normalized, result);
        return result;
      }

      const totalMatch = xmlText.match(/<total>(\d+)<\/total>/);
      const total = totalMatch ? Number.parseInt(totalMatch[1], 10) : 0;
      const result: ValidationResult = {
        isValid: total > 0,
        fromCache: false,
      };
      this.cache.set(normalized, result);
      return result;

    } catch (error) {
      console.warn("Word validation failed:", error);
      const result: ValidationResult = {
        isValid: true,
        fromCache: false,
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
  const normalized = word.normalize("NFC").trim();
  const composed = isHangulWord(normalized)
    ? normalized
    : composeHangulWord(normalized);
  if (!composed || !isHangulWord(composed)) {
    return {
      isValid: false,
      fromCache: false,
    };
  }

  const validatorInstance = getWordValidator();

  if (!validatorInstance) {
    return {
      isValid: true,
      fromCache: false,
    };
  }

  return validatorInstance.validateWord(composed);
}

export type { ValidationResult };