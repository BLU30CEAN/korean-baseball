# Google Sheets + GitHub Pages 배포 체크

## 현재 상태
- Google Sheets 저장용 서버 코드 준비됨:
  - `app/api/user/register/route.ts`
  - `app/api/game-log/route.ts`
  - `lib/server/sheets.ts`
- 시트 테이블(wbg_member, wbg_history) 자동 헤더 생성 로직 포함됨.
- `.env` / `.env.example` 키 템플릿 준비됨.

## 중요한 제한
- **GitHub Pages는 정적 호스팅**이라 Next.js API Route(`app/api/*`)를 실행할 수 없음.
- 즉, 현재 구조 그대로 GitHub Pages에 올리면 Sheets 연동 API는 동작하지 않음.

## 선택지
1. **Vercel로 배포 (권장)**
   - 지금 코드 거의 그대로 사용 가능.
   - Vercel 환경변수에 `GOOGLE_*` 3개만 등록하면 됨.

2. **GitHub Pages 유지 + 백엔드 분리**
   - 별도 서버(Cloudflare Workers, Render, Railway, Firebase Functions 등)에
     `register` / `game-log` API를 만들고,
     프론트에서 그 URL로 호출하도록 변경 필요.

3. **GitHub Pages 유지 + Google Apps Script Web App**
   - Apps Script를 배포해 엔드포인트를 만들고,
     프론트가 그 URL로 직접 POST.
   - 이 경우 `app/api/*`는 제거/우회해야 함.

## 환경변수
```env
GOOGLE_SHEETS_ID=스프레드시트ID
GOOGLE_SERVICE_ACCOUNT_EMAIL=서비스계정이메일
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## 시트 준비
- 시트 탭 이름:
  - `wbg_member`
  - `wbg_history`
- 서비스 계정 이메일을 시트 편집자로 공유.
