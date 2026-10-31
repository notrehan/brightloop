import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updatePassword } from "../actions";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=Open%20the%20password%20reset%20link%20from%20your%20email%20first");
  return <main className="auth-page"><section className="auth-card"><Link className="brand" href="/login"><span className="brand-mark">b</span><span>brightloop</span></Link><div className="auth-heading"><p className="eyebrow">ACCOUNT SECURITY</p><h1>Choose a new password</h1><p>Use more than 8 characters, with uppercase, lowercase, and a special character.</p></div>{error && <div className="alert error" role="alert">{error}</div>}<form action={updatePassword} className="form-stack"><label>New password<input name="password" type="password" minLength={9} required autoComplete="new-password" /></label><button className="button primary full" type="submit">Update password</button></form></section></main>;
}
