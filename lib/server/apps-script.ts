interface AppsScriptBaseResponse {
  ok?: boolean;
  error?: string;
  [key: string]: unknown;
}

function getAppsScriptUrl(): string {
  const value = process.env.APPS_SCRIPT_WEB_APP_URL;
  if (!value) {
    throw new Error("Missing environment variable: APPS_SCRIPT_WEB_APP_URL");
  }
  return value;
}

function getAppsScriptTimeoutMs(): number {
  const raw = process.env.APPS_SCRIPT_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 8000;
  }
  return parsed;
}

export async function callAppsScript<T extends AppsScriptBaseResponse>(
  action: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getAppsScriptTimeoutMs());
  let response: Response;

  try {
    response = await fetch(getAppsScriptUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        ...payload,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Apps Script 응답 시간 초과다. 잠시 뒤 다시 시도해라.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const raw = await response.text();
  let data: T;

  try {
    data = JSON.parse(raw) as T;
  } catch {
    const preview = raw.slice(0, 120).replace(/\s+/g, " ").trim();
    throw new Error(
      `Apps Script가 JSON이 아닌 응답을 반환했다. Web App URL(/exec)과 공개 권한을 확인해라. status=${response.status}, body=${preview}`,
    );
  }

  if (!response.ok) {
    throw new Error(data.error ?? `Apps Script request failed (${response.status})`);
  }

  return data;
}
