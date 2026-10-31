import Link from "next/link";
import { signIn, signUp, requestPasswordReset } from "./actions";

type LoginSearchParams = Promise<{ error?: string; message?: string; next?: string }>;

function safePortalTarget(value?: string) {
  if (!value || value.startsWith("//") || value.includes("\\")) return "";
  return value === "/portal" || value.startsWith("/portal/") ? value : "";
}

export default async function LoginPage({ searchParams }: { searchParams: LoginSearchParams }) {
  const p = await searchParams;
  const next = safePortalTarget(p.next);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="brand" href="/">
          <span className="brand-mark">b</span>
          <span>brightloop</span>
        </Link>
        <div className="auth-heading">
          <p className="eyebrow">SUBSCRIPTION OPERATIONS</p>
          <h1>Welcome to Brightloop</h1>
          <p>Manage your customers, plans, billing and recurring revenue.</p>
        </div>
        {p.error && <div className="alert error">{p.error}</div>}
        {p.message && <div className="alert success">{p.message}</div>}
        <form action={signIn} className="form-stack">
          <input type="hidden" name="next" value={next} />
          <label>
            Email address
            <input name="email" type="email" autoComplete="email" placeholder="you@company.com" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="button primary full">Sign in <span>→</span></button>
        </form>
        <details className="reset-details">
          <summary>Forgot password?</summary>
          <form action={requestPasswordReset} className="reset-form">
            <input name="email" type="email" placeholder="Account email" required />
            <button className="small-button">Send link</button>
          </form>
        </details>
        <div className="auth-divider"><span>New to Brightloop?</span></div>
        <form action={signUp} className="form-stack signup-form">
          <input type="hidden" name="next" value={next} />
          <label>Full name<input name="full_name" placeholder="Your name" required /></label>
          <label>Work email<input name="email" type="email" placeholder="you@company.com" required /></label>
          <label>Password<input name="password" type="password" placeholder="At least 8 characters" minLength={8} required /></label>
          <button className="button secondary full">Create account</button>
        </form>
        <p className="auth-footnote">The first account becomes the workspace administrator. Subsequent accounts are customer portal users.</p>
      </section>
    </main>
  );
}
