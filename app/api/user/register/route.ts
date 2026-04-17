import { NextResponse } from "next/server";
import { callAppsScript } from "@/lib/server/apps-script";

interface RegisterBody {
  nickname?: string;
  isNewUser?: boolean;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterBody;
    const nickname = String(body.nickname ?? "").trim().replace(/\s+/g, " ");
    const isNewUser = Boolean(body.isNewUser);

    if (!nickname || nickname.length < 2 || nickname.length > 20) {
      return NextResponse.json(
        { ok: false, error: "닉네임은 2~20자로 입력해야 한다." },
        { status: 400 },
      );
    }

    const result = await callAppsScript<{
      ok?: boolean;
      error?: string;
      created?: boolean;
    }>("registerNickname", {
      nickname,
      isNewUser,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "닉네임 인증에 실패했다." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      nickname,
      created: Boolean(result.created),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "서버 오류";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
