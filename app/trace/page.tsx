import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACCESS_TOKEN_COOKIE } from "../../lib/auth-cookies";
import { TracePageShell } from "./TracePageShell";

export default function TracePage() {
  const accessToken = cookies().get(ACCESS_TOKEN_COOKIE)?.value ?? null;

  if (!accessToken) {
    redirect("/sign-in");
  }

  return <TracePageShell initialAccessToken={accessToken} />;
}
