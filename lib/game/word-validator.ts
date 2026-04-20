import { composeHangulWord, isHangulWord } from "@/lib/game/hangul";
import { lookupKrdictWord } from "@/lib/krdict/lookup";

interface ValidationResult {
  isValid: boolean;
  definition?: string;
  fromCache: boolean;
}

type ApiValidateBody = {
  isValid?: boolean;
  definition?: string;
  fromCache?: boolean;
  reason?: string;
  error?: string;
};

async function validateViaProxy(composed: string): Promise<ValidationResult> {
  const callProxy = () =>
    fetch("/api/krdict/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: composed }),
    });

  let response = await callProxy();
  if (!response.ok && response.status >= 500) {
    // transient upstream/router failure: retry once
    response = await callProxy();
  }

  const data = (await response.json()) as ApiValidateBody;

  if (response.status === 429) {
    throw new Error("rate_limited");
  }

  if (data.reason === "server_key_missing") {
    const legacy = process.env.NEXT_PUBLIC_KRDICT_KEY?.trim() ?? "";
    if (legacy) {
      const direct = await lookupKrdictWord(composed, legacy);
      return { ...direct, fromCache: false };
    }
    throw new Error("krdict_key_missing");
  }

  if (!response.ok) {
    throw new Error(data.error ?? `validate_api_${response.status}`);
  }

  return {
    isValid: Boolean(data.isValid),
    definition: typeof data.definition === "string" ? data.definition : undefined,
    fromCache: Boolean(data.fromCache),
  };
}

export async function validateWordRealtime(word: string): Promise<ValidationResult> {
  const normalized = word.normalize("NFC").trim();
  const composed = isHangulWord(normalized) ? normalized : composeHangulWord(normalized);
  if (!composed || !isHangulWord(composed)) {
    return {
      isValid: false,
      fromCache: false,
    };
  }

  if (typeof window === "undefined") {
    const serverKey = process.env.KRDICT_KEY?.trim() ?? "";
    if (!serverKey) {
      return { isValid: false, fromCache: false };
    }
    const direct = await lookupKrdictWord(composed, serverKey);
    return { ...direct, fromCache: false };
  }

  return validateViaProxy(composed);
}

export type { ValidationResult };
