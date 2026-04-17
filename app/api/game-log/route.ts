import { NextResponse } from "next/server";
import {
  appendGameLog,
  ensureSheetsSchema,
  hasNickname,
  normalizeNickname,
  type GameLogPayload,
} from "@/lib/server/sheets";

interface GameLogBody extends Partial<GameLogPayload> {}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GameLogBody;
    const nickname = normalizeNickname(body.nickname ?? "");

    if (!nickname) {
      return NextResponse.json({ ok: false, error: "닉네임이 필요하다." }, { status: 400 });
    }

    await ensureSheetsSchema();

    if (!(await hasNickname(nickname))) {
      return NextResponse.json({ ok: false, error: "등록되지 않은 닉네임이다." }, { status: 404 });
    }

    const payload: GameLogPayload = {
      nickname,
      problemNo: String(body.problemNo ?? ""),
      answerWord: String(body.answerWord ?? ""),
      answerJamo: String(body.answerJamo ?? ""),
      outcome: body.outcome === "won" ? "won" : "lost",
      reason:
        body.reason === "solved" || body.reason === "exhausted" || body.reason === "give-up"
          ? body.reason
          : "exhausted",
      attemptCount: Number.isFinite(body.attemptCount) ? Number(body.attemptCount) : 0,
      hintRemoveUsed: Number.isFinite(body.hintRemoveUsed) ? Number(body.hintRemoveUsed) : 0,
      hintYellowUsed: Number.isFinite(body.hintYellowUsed) ? Number(body.hintYellowUsed) : 0,
      hintGreenUsed: Number.isFinite(body.hintGreenUsed) ? Number(body.hintGreenUsed) : 0,
      securityRetryErrors: Number.isFinite(body.securityRetryErrors) ? Number(body.securityRetryErrors) : 0,
      securityPhonePrefix: String(body.securityPhonePrefix ?? ""),
      securityMiddle4: String(body.securityMiddle4 ?? ""),
      securityAccount2: String(body.securityAccount2 ?? ""),
      attemptGuesses: String(body.attemptGuesses ?? ""),
    };

    await appendGameLog(payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
