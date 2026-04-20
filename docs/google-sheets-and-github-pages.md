# Google Sheets + GitHub Pages 배포 체크

## 현재 상태
- Apps Script Web App 호출용 서버 프록시 준비됨:
  - `app/api/user/register/route.ts`
  - `app/api/game-log/route.ts`
  - `app/api/stats/report/route.ts`
  - `lib/server/apps-script.ts`
- 시트 탭은 `wbg_member`, `wbg_history`로 사용한다.
- `.env` / `.env.example`에 Apps Script URL + 통계 비밀번호 템플릿 준비됨.

## 중요한 제한
- **GitHub Pages는 정적 호스팅**이라 Next.js API Route(`app/api/*`)를 실행할 수 없음.
- 즉, 현재 구조 그대로 GitHub Pages에 올리면 Sheets 연동 API는 동작하지 않음.

## 선택지
1. **Vercel로 배포 (권장)**
   - 지금 코드 그대로 사용 가능.
   - Vercel 환경변수에 `APPS_SCRIPT_WEB_APP_URL`, `STATS_PASSWORD` 등록하면 됨.

2. **GitHub Pages 유지**
   - Next.js API Route는 실행되지 않으므로 `/api/*` 경로를 직접 Apps Script URL 호출로 바꿔야 함.

## 환경변수 (현재 코드 기준)
```env
APPS_SCRIPT_WEB_APP_URL=https://script.google.com/macros/s/배포ID/exec
STATS_PASSWORD=813
```

## 시트 준비
- 시트 탭 이름:
  - `wbg_member`
  - `wbg_history`
- Apps Script가 접근할 수 있는 스프레드시트로 설정한다.
- `wbg_history` 컬럼에 `hintCoreUsed`(마지막 시도 핵심 힌트 사용 여부, 0/1) 포함.
