import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SharePage({
  params,
}: {
  params: Promise<{
    payload: string;
  }> | {
    payload: string;
  };
}) {
  const resolvedParams = await params;
  redirect(`/share?payload=${encodeURIComponent(resolvedParams.payload)}`);
}
