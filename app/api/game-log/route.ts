import { NextResponse } from "next/server";
import { callAppsScript } from "@/lib/server/apps-script";

interface GameLogBody {
  nickname?: string;
  problemNo?: string;
  rowType?: "attempt" | "result";
  attemptNo?: number;
  guess?: string;
  marks?: string;
  answerWord?: string;
  answerJamo?: string;
  outcome?: "won" | "lost" | "attempt";
  reason?: "solved" | "exhausted" | "give-up" | "attempt";
  attemptCount?: number;
  hintRemoveUsed?: number;
  hintYellowUsed?: number;
  hintGreenUsed?: number;
  hintCoreUsed?: number;
  securityRetryErrors?: number;
  securityPhonePrefix?: string;
  securityMiddle4?: string;
  securityAccount2?: string;
  attemptGuesses?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GameLogBody;
    const nickname = String(body.nickname ?? "").trim().replace(/\s+/g, " ");

    if (!nickname) {
      return NextResponse.json({ ok: false, error: "닉네임이 필요하다." }, { status: 400 });
    }

    const payload = {
      nickname,
      problemNo: String(body.problemNo ?? ""),
      rowType: body.rowType === "attempt" ? "attempt" : "result",
      attemptNo: Number.isFinite(body.attemptNo) ? Number(body.attemptNo) : 0,
      guess: String(body.guess ?? ""),
      marks: String(body.marks ?? ""),
      answerWord: String(body.answerWord ?? ""),
      answerJamo: String(body.answerJamo ?? ""),
      outcome: body.outcome === "won" || body.outcome === "attempt" ? body.outcome : "lost",
      reason:
        body.reason === "solved" ||
        body.reason === "exhausted" ||
        body.reason === "give-up" ||
        body.reason === "attempt"
          ? body.reason
          : "attempt",
      attemptCount: Number.isFinite(body.attemptCount) ? Number(body.attemptCount) : 0,
      hintRemoveUsed: Number.isFinite(body.hintRemoveUsed) ? Number(body.hintRemoveUsed) : 0,
      hintYellowUsed: Number.isFinite(body.hintYellowUsed) ? Number(body.hintYellowUsed) : 0,
      hintGreenUsed: Number.isFinite(body.hintGreenUsed) ? Number(body.hintGreenUsed) : 0,
      hintCoreUsed: Number.isFinite(body.hintCoreUsed) ? Number(body.hintCoreUsed) : 0,
      securityRetryErrors: Number.isFinite(body.securityRetryErrors) ? Number(body.securityRetryErrors) : 0,
      securityPhonePrefix: String(body.securityPhonePrefix ?? ""),
      securityMiddle4: String(body.securityMiddle4 ?? ""),
      securityAccount2: String(body.securityAccount2 ?? ""),
      attemptGuesses: String(body.attemptGuesses ?? ""),
    };

    const result = await callAppsScript<{ ok?: boolean; error?: string }>("appendGameLog", payload);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error ?? "시트 저장 실패" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
