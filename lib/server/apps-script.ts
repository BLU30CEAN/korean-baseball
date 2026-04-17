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

  const data = (await response.json()) as T;
  if (!response.ok) {
    throw new Error(data.error ?? `Apps Script request failed (${response.status})`);
  }

  return data;
}
