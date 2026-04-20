import { isHangulWord } from "@/lib/game/hangul";

export type KrdictLookupResult = {
  isValid: boolean;
  definition?: string;
};

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-fA-F]+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function extractXmlTagValue(block: string, tagName: string): string | undefined {
  const pattern = new RegExp(String.raw`<${tagName}>([\s\S]*?)<\/${tagName}>`);
  const match = block.match(pattern);
  if (!match) {
    return undefined;
  }

  return decodeXml(match[1].trim());
}

const KRDICT_SEARCH_URL = "https://krdict.korean.go.kr/api/search";

/**
 * KRDICT exact word search (XML). Caller supplies a composed Hangul surface form.
 */
export async function lookupKrdictWord(
  composedWord: string,
  apiKey: string,
): Promise<KrdictLookupResult> {
  const normalized = composedWord.normalize("NFC").trim();

  if (!isHangulWord(normalized)) {
    return { isValid: false };
  }

  const url = new URL(KRDICT_SEARCH_URL);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", normalized);
  url.searchParams.set("req_type", "xml");
  url.searchParams.set("part", "word");
  url.searchParams.set("method", "exact");
  url.searchParams.set("num", "1");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/xml",
      "User-Agent": "WBG-KrdictLookup/1.0",
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
    return {
      isValid: true,
      definition,
    };
  }

  const totalMatch = xmlText.match(/<total>(\d+)<\/total>/);
  const total = totalMatch ? Number.parseInt(totalMatch[1], 10) : 0;
  return {
    isValid: total > 0,
  };
}
