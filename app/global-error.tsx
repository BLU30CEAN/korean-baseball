"use client";

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  return (
    <html lang="ko">
      <body>
        <main className="loadingState">
          <div className="loadingCard">
            <div className="spinner" />
            <h1 className="heroTitle">문제가 생겼다</h1>
            <p className="heroCopy">
              {error.message || "앱을 다시 불러오면 해결될 수 있다."}
            </p>
            <button type="button" className="key" style={{ width: "100%", marginTop: 12 }} onClick={reset}>
              다시 시도
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
