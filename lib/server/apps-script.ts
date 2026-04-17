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

export async function callAppsScript<T extends AppsScriptBaseResponse>(
  action: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(getAppsScriptUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      ...payload,
    }),
    cache: "no-store",
  });

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
