import Link from "next/link";
import SharedResultView from "@/components/game/SharedResultView";
import { decodeShareSnapshot } from "@/lib/game/share";

export const dynamic = "force-dynamic";

function InvalidShareView() {
  return (
    <main className="pageShell">
      <section className="gameCard" aria-label="잘못된 공유 링크">
        <header className="hero">
          <h1 className="heroTitle">공유 링크가 올바르지 않다</h1>
          <p className="heroCopy">이 링크는 더 이상 읽을 수 없거나 변조되었다.</p>
        </header>

        <div className="body">
          <div className="banner">
            <h2 className="bannerTitle">스냅샷을 불러오지 못했다</h2>
            <p className="bannerCopy">원본 게임으로 돌아가서 새로 시작하면 된다.</p>
          </div>

          <div className="shareActions">
            <Link href="/" className="key actionButton">
              새 게임 시작
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{
    payload?: string | string[];
  }> | {
    payload?: string | string[];
  };
}) {
  const resolvedSearchParams = await searchParams;
  const payload = Array.isArray(resolvedSearchParams.payload)
    ? resolvedSearchParams.payload[0]
    : resolvedSearchParams.payload;
  const snapshot = payload ? decodeShareSnapshot(payload) : null;

  if (!snapshot) {
    return <InvalidShareView />;
  }

  return <SharedResultView snapshot={snapshot} />;
}
