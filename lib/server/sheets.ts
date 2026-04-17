import { google } from "googleapis";

const USERS_SHEET = "wbg_member";
const GAME_LOGS_SHEET = "wbg_history";

const USER_HEADERS = ["nickname", "createdAt", "lastSeenAt"] as const;
const GAME_LOG_HEADERS = [
  "timestamp",
  "nickname",
  "problemNo",
  "rowType",
  "attemptNo",
  "guess",
  "marks",
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
  rowType: "attempt" | "result";
  attemptNo: number;
  guess: string;
  marks: string;
  answerWord: string;
  answerJamo: string;
  outcome: "won" | "lost" | "attempt";
  reason: "solved" | "exhausted" | "give-up" | "attempt";
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

export interface StoredGameLogRow {
  timestamp: string;
  nickname: string;
  problemNo: string;
  rowType: "attempt" | "result";
  attemptNo: number;
  guess: string;
  marks: string;
  answerWord: string;
  answerJamo: string;
  outcome: "won" | "lost" | "attempt";
  reason: "solved" | "exhausted" | "give-up" | "attempt";
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

  const gameRows = await readRows(`${GAME_LOGS_SHEET}!A1:T1`);
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
    range: `${GAME_LOGS_SHEET}!A:T`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          new Date().toISOString(),
          payload.nickname,
          payload.problemNo,
          payload.rowType,
          String(payload.attemptNo),
          payload.guess,
          payload.marks,
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

export async function listMemberNicknames(): Promise<string[]> {
  const rows = await readRows(`${USERS_SHEET}!A2:A`);
  return rows.map((row) => row[0]).filter(Boolean);
}

export async function listGameLogs(): Promise<StoredGameLogRow[]> {
  const rows = await readRows(`${GAME_LOGS_SHEET}!A2:T`);

  return rows.map((row) => ({
    timestamp: row[0] ?? "",
    nickname: row[1] ?? "",
    problemNo: row[2] ?? "",
    rowType: row[3] === "attempt" ? "attempt" : "result",
    attemptNo: Number.isFinite(Number(row[4])) ? Number(row[4]) : 0,
    guess: row[5] ?? "",
    marks: row[6] ?? "",
    answerWord: row[7] ?? "",
    answerJamo: row[8] ?? "",
    outcome: row[9] === "won" || row[9] === "attempt" ? row[9] : "lost",
    reason:
      row[10] === "solved" || row[10] === "exhausted" || row[10] === "give-up" || row[10] === "attempt"
        ? row[10]
        : "attempt",
    attemptCount: Number.isFinite(Number(row[11])) ? Number(row[11]) : 0,
    hintRemoveUsed: Number.isFinite(Number(row[12])) ? Number(row[12]) : 0,
    hintYellowUsed: Number.isFinite(Number(row[13])) ? Number(row[13]) : 0,
    hintGreenUsed: Number.isFinite(Number(row[14])) ? Number(row[14]) : 0,
    securityRetryErrors: Number.isFinite(Number(row[15])) ? Number(row[15]) : 0,
    securityPhonePrefix: row[16] ?? "",
    securityMiddle4: row[17] ?? "",
    securityAccount2: row[18] ?? "",
    attemptGuesses: row[19] ?? "",
  }));
}
