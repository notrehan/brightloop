"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const go = (key: string, value: string, next?: string | null) =>
  redirect(`/login?${key}=${encodeURIComponent(value)}${next ? `&next=${encodeURIComponent(next)}` : ""}`);

function safePortalTarget(value: unknown): string | null {
  if (typeof value !== "string" || value.startsWith("//") || value.includes("\\")) return null;
  if (value !== "/portal" && !value.startsWith("/portal/")) return null;
  try {
    const parsed = new URL(value, "http://brightloop.local");
    if (parsed.origin !== "http://brightloop.local") return null;
    if (parsed.pathname !== "/portal" && !parsed.pathname.startsWith("/portal/")) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export async function signIn(f: FormData) {
  const email = String(f.get("email") || "").trim().toLowerCase();
  const password = String(f.get("password") || "");
  const next = safePortalTarget(f.get("next"));
  const s = await createClient();
  const { error } = await s.auth.signInWithPassword({ email, password });
  if (error) go("error", error.message, next);
  redirect(next || "/dashboard");
}

export async function signUp(f: FormData) {
  const email = String(f.get("email") || "").trim().toLowerCase();
  const password = String(f.get("password") || "");
  const name = String(f.get("full_name") || "").trim();
  const next = safePortalTarget(f.get("next"));
  if (!name || password.length < 8) go("error", "Enter your name and a password with at least 8 characters.", next);

  const s = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const callback = new URL("/auth/callback", origin);
  if (next) callback.searchParams.set("next", next);
  const { data, error } = await s.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: callback.toString(), data: { full_name: name } },
  });
  if (error) go("error", error.message, next);
  if (data.session) redirect(next || "/dashboard");

  const message = "Account created. Check your email to confirm it, then sign in.";
  redirect(`/login?message=${encodeURIComponent(message)}${next ? `&next=${encodeURIComponent(next)}` : ""}`);
}

export async function requestPasswordReset(f: FormData) {
  const email = String(f.get("email") || "").trim();
  if (!email) go("error", "Enter your account email.");
  const s = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { error } = await s.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/login/reset-password`,
  });
  if (error) go("error", error.message);
  go("message", "If that account exists, a reset link has been sent.");
}

export async function updatePassword(f: FormData) {
  const password = String(f.get("password") || "");
  if (password.length < 8) redirect("/login/reset-password?error=Use%20at%20least%208%20characters");
  const s = await createClient();
  const { error } = await s.auth.updateUser({ password });
  if (error) redirect(`/login/reset-password?error=${encodeURIComponent(error.message)}`);
  go("message", "Password updated. Sign in with your new password.");
}
