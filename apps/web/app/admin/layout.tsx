import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACCESS_TOKEN_COOKIE } from "../../lib/auth-cookies";
import { fetchSupabaseUser, getSupabaseAnonConfig, isAdminUser } from "../../lib/supabase";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabaseConfig = getSupabaseAnonConfig();
  const accessToken = cookies().get(ACCESS_TOKEN_COOKIE)?.value ?? null;

  if (!supabaseConfig || !accessToken) {
    redirect("/");
  }

  const user = await fetchSupabaseUser(accessToken, supabaseConfig);

  if (!isAdminUser(user)) {
    redirect("/");
  }

  return <>{children}</>;
}
