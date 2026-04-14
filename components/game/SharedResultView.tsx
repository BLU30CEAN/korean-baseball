import Link from "next/link";
import { MAX_ATTEMPTS, WORD_LENGTH } from "@/lib/game/keymap";
import type { Mark, SharedGameSnapshot } from "@/lib/game/types";

function getTileClass(mark?: Mark): string {
  if (!mark) {
    return "tile tile--empty";
  }

  return `tile tile--${mark}`;
}

export default function SharedResultView({ snapshot }: { snapshot: SharedGameSnapshot }) {
  const resultLabel =
    snapshot.reason === "give-up"
      ? "포기한 결과"
      : snapshot.outcome === "won"
        ? "성공한 결과"
        : "실패한 결과";

  const resultCopy =
    snapshot.reason === "give-up"
      ? "포기 버튼으로 게임을 종료했다."
      : snapshot.outcome === "won"
        ? "정답을 맞췄다."
        : `${MAX_ATTEMPTS}회 안에 맞히지 못했다.`;

  const definitionCopy = snapshot.answer.definition ? `뜻풀이: ${snapshot.answer.definition}` : null;

  return (
    <main className="pageShell">
      <section className="gameCard" aria-label="공유된 한글 야구 결과">
        <header className="hero">
          <h1 className="heroTitle">한글 야구 결과</h1>
          <p className="heroCopy">
            이 결과는 공유 링크로 열린 스냅샷이다. 현재 보드와 정답이 그대로 보인다.
          </p>

          <div className="statsRow" aria-label="공유 결과 상태">
            <span className="statChip">{resultLabel}</span>
            <span className="statChip">연승 {snapshot.stats.currentStreak}</span>
            <span className="statChip">최고 {snapshot.stats.bestStreak}</span>
            <span className="statChip">시도 {snapshot.attempts.length} / {MAX_ATTEMPTS}</span>
          </div>
        </header>

        <div className="body">
          <div className="banner">
            <h2 className="bannerTitle">{resultLabel}</h2>
            <p className="bannerCopy">
              {resultCopy} 정답은 {snapshot.answer.word} ({snapshot.answer.jamo})이다.
            </p>
            {definitionCopy && <p className="bannerCopy">{definitionCopy}</p>}
          </div>

          <div className="board" aria-label="공유된 시도 보드">
            {Array.from({ length: MAX_ATTEMPTS }, (_, rowIndex) => {
              const attempt = snapshot.attempts[rowIndex];
              const letters = attempt?.guess.split("") ?? [];
              const marks = attempt?.marks ?? [];

              return (
                <div key={`share-row-${rowIndex}`} className="boardRow">
                  {Array.from({ length: WORD_LENGTH }, (_, cellIndex) => {
                    const letter = letters[cellIndex];
                    const mark = marks[cellIndex];

                    return (
                      <div
                        key={cellIndex}
                        className={`${getTileClass(mark)}${letter ? " tile--filled" : ""}`}
                        aria-label={
                          letter ? `${cellIndex + 1}번째 칸 ${letter}` : `${cellIndex + 1}번째 빈 칸`
                        }
                      >
                        {letter ?? ""}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <div className="shareActions">
            <Link href="/" className="key actionButton">
              새 게임 시작
            </Link>
          </div>

          <p className="footerHint">
            이 링크는 결과 스냅샷이라 새로고침해도 같은 판이 열린다.
          </p>
        </div>
      </section>
    </main>
  );
}
