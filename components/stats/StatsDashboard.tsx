"use client";

import { useMemo, useState } from "react";

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

interface StatsResponse {
  ok: boolean;
  error?: string;
  members?: string[];
  ranking?: RankingRow[];
  detailLogs?: DetailLogRow[];
}

export default function StatsDashboard() {
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [nicknameFilter, setNicknameFilter] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [detailLogs, setDetailLogs] = useState<DetailLogRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const currentMemberOptions = useMemo(() => members.filter(Boolean), [members]);

  const fetchStats = async (withNickname?: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/stats/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password,
          nickname: withNickname ?? "",
        }),
      });
      const data = (await response.json()) as StatsResponse;
      if (!response.ok || !data.ok) {
        setError(data.error ?? "통계를 불러오지 못했다.");
        setAuthorized(false);
        return;
      }

      setAuthorized(true);
      setMembers(data.members ?? []);
      setRanking(data.ranking ?? []);
      setDetailLogs(data.detailLogs ?? []);
    } catch {
      setError("통계를 불러오는 중 네트워크 오류가 발생했다.");
      setAuthorized(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pageShell">
      <section className="gameCard statsCard" aria-label="통계 대시보드">
        <header className="hero">
          <h1 className="heroTitle">통계</h1>
          <p className="heroCopy">통계 비밀번호를 입력하면 닉네임 랭킹과 상세 로그를 확인할 수 있다.</p>
        </header>

        <div className="body">
          {!authorized ? (
            <div className="authCard">
              <input
                className="authInput"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="통계 비밀번호"
                type="password"
              />
              <button
                type="button"
                className={`key actionButton${loading ? " key--disabled" : ""}`}
                disabled={loading}
                onClick={() => void fetchStats()}
              >
                {loading ? (
                  <span className="buttonLoading">
                    <span className="spinnerInline" />
                    확인 중...
                  </span>
                ) : (
                  "통계 진입"
                )}
              </button>
              {error ? <p className="authError">{error}</p> : null}
            </div>
          ) : (
            <>
              <div className="statsFilterRow">
                <select
                  className="authInput"
                  value={nicknameFilter}
                  onChange={(event) => setNicknameFilter(event.target.value)}
                >
                  <option value="">닉네임 선택</option>
                  {currentMemberOptions.map((member) => (
                    <option key={member} value={member}>
                      {member}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={`key actionButton${loading ? " key--disabled" : ""}`}
                  disabled={loading || !nicknameFilter}
                  onClick={() => void fetchStats(nicknameFilter)}
                >
                  {loading ? (
                    <span className="buttonLoading">
                      <span className="spinnerInline" />
                      조회 중...
                    </span>
                  ) : (
                    "상세 조회"
                  )}
                </button>
              </div>

              <div className="statsTableWrap">
                <table className="statsTable">
                  <thead>
                    <tr>
                      <th>순위</th>
                      <th>닉네임</th>
                      <th>승</th>
                      <th>패</th>
                      <th>승률</th>
                      <th>최소시도</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((row, index) => (
                      <tr key={`${row.nickname}-${index}`}>
                        <td>{index + 1}</td>
                        <td>{row.nickname}</td>
                        <td>{row.wins}</td>
                        <td>{row.losses}</td>
                        <td>{row.winRate}%</td>
                        <td>{row.bestAttemptCount || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="statsTableWrap">
                <table className="statsTable">
                  <thead>
                    <tr>
                      <th>시각</th>
                      <th>닉네임</th>
                      <th>유형</th>
                      <th>시도</th>
                      <th>입력값</th>
                      <th>결과</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailLogs.map((row, index) => (
                      <tr key={`${row.problemNo}-${row.rowType}-${index}`}>
                        <td>{row.timestamp}</td>
                        <td>{row.nickname}</td>
                        <td>{row.rowType}</td>
                        <td>{row.attemptNo}</td>
                        <td>{row.guess}</td>
                        <td>{row.outcome}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {error ? <p className="authError">{error}</p> : null}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
