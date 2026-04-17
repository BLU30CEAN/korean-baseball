import { google } from "googleapis";

const USERS_SHEET = "wbg_member";
const GAME_LOGS_SHEET = "wbg_history";

const USER_HEADERS = ["nickname", "createdAt", "lastSeenAt"] as const;
const GAME_LOG_HEADERS = [
  "timestamp",
  "nickname",
  "problemNo",
  "answerWord",
  "answerJamo",
  "outcome",
  "reason",
  "attemptCount",
  "hintRemoveUsed",
  "hintYellowUsed",
  "hintGreenUsed",
  "securityRetryErrors",
  "securityPhonePrefix",
  "securityMiddle4",
  "securityAccount2",
  "attemptGuesses",
] as const;

export interface GameLogPayload {
  nickname: string;
  problemNo: string;
  answerWord: string;
  answerJamo: string;
  outcome: "won" | "lost";
  reason: "solved" | "exhausted" | "give-up";
  attemptCount: number;
  hintRemoveUsed: number;
  hintYellowUsed: number;
  hintGreenUsed: number;
  securityRetryErrors: number;
  securityPhonePrefix: string;
  securityMiddle4: string;
  securityAccount2: string;
  attemptGuesses: string;
}

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getSheetsClient() {
  const email = getEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = getEnv("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = getEnv("GOOGLE_SHEETS_ID");

  return { sheets, spreadsheetId };
}

async function readRows(range: string): Promise<string[][]> {
  const { sheets, spreadsheetId } = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return (response.data.values ?? []) as string[][];
}

async function writeHeaders(sheetName: string, headers: readonly string[]) {
  const { sheets, spreadsheetId } = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [Array.from(headers)],
    },
  });
}

export async function ensureSheetsSchema() {
  const userRows = await readRows(`${USERS_SHEET}!A1:C1`);
  if (userRows.length === 0) {
    await writeHeaders(USERS_SHEET, USER_HEADERS);
  }

  const gameRows = await readRows(`${GAME_LOGS_SHEET}!A1:P1`);
  if (gameRows.length === 0) {
    await writeHeaders(GAME_LOGS_SHEET, GAME_LOG_HEADERS);
  }
}

export function normalizeNickname(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

export async function hasNickname(nickname: string): Promise<boolean> {
  const rows = await readRows(`${USERS_SHEET}!A2:A`);
  return rows.some((row) => row[0] === nickname);
}

export async function registerNickname(nickname: string) {
  const { sheets, spreadsheetId } = getSheetsClient();
  const now = new Date().toISOString();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${USERS_SHEET}!A:C`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[nickname, now, now]],
    },
  });
}

export async function updateLastSeen(nickname: string) {
  const { sheets, spreadsheetId } = getSheetsClient();
  const rows = await readRows(`${USERS_SHEET}!A2:C`);
  const rowIndex = rows.findIndex((row) => row[0] === nickname);

  if (rowIndex < 0) {
    return;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${USERS_SHEET}!C${rowIndex + 2}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[new Date().toISOString()]],
    },
  });
}

export async function appendGameLog(payload: GameLogPayload) {
  const { sheets, spreadsheetId } = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${GAME_LOGS_SHEET}!A:P`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          new Date().toISOString(),
          payload.nickname,
          payload.problemNo,
          payload.answerWord,
          payload.answerJamo,
          payload.outcome,
          payload.reason,
          String(payload.attemptCount),
          String(payload.hintRemoveUsed),
          String(payload.hintYellowUsed),
          String(payload.hintGreenUsed),
          String(payload.securityRetryErrors),
          payload.securityPhonePrefix,
          payload.securityMiddle4,
          payload.securityAccount2,
          payload.attemptGuesses,
        ],
      ],
    },
  });
}
