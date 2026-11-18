import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import RouterView from "@/components/router-view";
import { COOKIE_NAME, getUserByToken } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function Page({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  if (!path.length) redirect("/today");
  const isPublic = [
    "sign-in",
    "sign-up",
    "forgot-password",
    "reset-password",
  ].includes(path[0]);
  const cookieStore = await cookies();
  const user = getUserByToken(cookieStore.get(COOKIE_NAME)?.value);
  if (!user && !isPublic) redirect("/sign-in");
  return <RouterView path={path} />;
}
