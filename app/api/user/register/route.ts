import { NextResponse } from "next/server";
import {
  ensureSheetsSchema,
  hasNickname,
  normalizeNickname,
  registerNickname,
  updateLastSeen,
} from "@/lib/server/sheets";

interface RegisterBody {
  nickname?: string;
  isNewUser?: boolean;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterBody;
    const nickname = normalizeNickname(body.nickname ?? "");
    const isNewUser = Boolean(body.isNewUser);

    if (!nickname || nickname.length < 2 || nickname.length > 20) {
      return NextResponse.json(
        { ok: false, error: "닉네임은 2~20자로 입력해야 한다." },
        { status: 400 },
      );
    }

    await ensureSheetsSchema();
    const exists = await hasNickname(nickname);

    if (isNewUser) {
      if (exists) {
        return NextResponse.json(
          { ok: false, error: "이미 사용 중인 닉네임이다." },
          { status: 409 },
        );
      }

      await registerNickname(nickname);
      return NextResponse.json({ ok: true, nickname, created: true });
    }

    if (!exists) {
      return NextResponse.json(
        { ok: false, error: "등록되지 않은 닉네임이다. 신규 사용자로 가입해라." },
        { status: 404 },
      );
    }

    await updateLastSeen(nickname);
    return NextResponse.json({ ok: true, nickname, created: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
