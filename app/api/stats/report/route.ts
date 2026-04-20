import { NextResponse } from "next/server";
import { callAppsScript } from "@/lib/server/apps-script";

interface StatsRequestBody {
  password?: string;
  nickname?: string;
}

interface RankingRow {
  nickname: string;
  wins: number;
  losses: number;
  totalGames: number;
  winRate: number;
  bestAttemptCount: number;
}

interface DetailLogRow {
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
  hintCoreUsed: number;
  securityRetryErrors: number;
  securityPhonePrefix: string;
  securityMiddle4: string;
  securityAccount2: string;
  attemptGuesses: string;
}

function getStatsPassword(): string {
  const value = process.env.STATS_PASSWORD;
  if (!value) {
    throw new Error("Missing environment variable: STATS_PASSWORD");
  }
  return value;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StatsRequestBody;
    const password = String(body.password ?? "");
    const filterNickname = String(body.nickname ?? "").trim();

    if (password !== getStatsPassword()) {
      return NextResponse.json({ ok: false, error: "비밀번호가 올바르지 않다." }, { status: 401 });
    }

    const source = await callAppsScript<{
      ok?: boolean;
      error?: string;
      members?: string[];
      logs?: DetailLogRow[];
    }>("fetchStatsData", {});

    if (!source.ok) {
      return NextResponse.json({ ok: false, error: source.error ?? "통계 조회 실패" }, { status: 400 });
    }

    const members = source.members ?? [];
    const allLogs = source.logs ?? [];
    const resultLogs = allLogs.filter((row) => row.outcome === "won" || row.outcome === "lost");

    const byNickname = new Map<string, RankingRow>();
    for (const row of resultLogs) {
      const current =
        byNickname.get(row.nickname) ??
        ({
          nickname: row.nickname,
          wins: 0,
          losses: 0,
          totalGames: 0,
          winRate: 0,
          bestAttemptCount: Number.POSITIVE_INFINITY,
        } as RankingRow);

      current.totalGames += 1;
      if (row.outcome === "won") {
        current.wins += 1;
      } else if (row.outcome === "lost") {
        current.losses += 1;
      }

      if (row.attemptCount > 0 && row.attemptCount < current.bestAttemptCount) {
        current.bestAttemptCount = row.attemptCount;
      }

      byNickname.set(row.nickname, current);
    }

    const ranking = [...byNickname.values()]
      .map((entry) => ({
        ...entry,
        winRate: entry.totalGames > 0 ? Number(((entry.wins / entry.totalGames) * 100).toFixed(1)) : 0,
        bestAttemptCount: Number.isFinite(entry.bestAttemptCount) ? entry.bestAttemptCount : 0,
      }))
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return a.nickname.localeCompare(b.nickname, "ko");
      });

    const detailLogs = filterNickname
      ? allLogs.filter((row) => row.nickname === filterNickname).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      : [];

    return NextResponse.json({
      ok: true,
      members,
      ranking,
      detailLogs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
