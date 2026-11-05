import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { LoadingButton } from "../components/Loading";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(form.email, form.password);
      navigate(
        location.state?.next || location.state?.backgroundLocation || "/account",
        { replace: Boolean(location.state?.backgroundLocation) }
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container auth-wrap">
      <div className="auth-card">
        <div className="brand">
          <img src="/static/brand/logo.svg" alt="ZimOsaka AutoSpares" />
        </div>
        <p className="eyebrow">Account</p>
        <h1 style={{ fontSize: "2.2rem" }}>Sign in</h1>
        <p className="muted">Track sourcing requests, quotes and payments.</p>
        <form className="stack-form" onSubmit={submit}>
          <label>
            Email
            <input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>
            Password
            <input type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </label>
          {error && <p className="alert">{error}</p>}
          <LoadingButton className="btn primary full" loading={busy} loadingLabel="Signing in…">
            Sign in
          </LoadingButton>
        </form>
        <p className="auth-alt">
          New here? <Link to="/register" state={location.state}>Create an account</Link>
        </p>
      </div>
    </div>
  );
}
