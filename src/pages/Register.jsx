import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { LoadingButton } from "../components/Loading";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await register(form);
      navigate(location.state?.next || "/account");
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
        <h1 style={{ fontSize: "2.2rem" }}>Create an account</h1>
        <p className="muted">For quotes, tracking and WhatsApp updates.</p>
        <form className="stack-form" onSubmit={submit}>
          <label>
            Full name
            <input required value={form.name} onChange={set("name")} autoComplete="name" />
          </label>
          <label>
            Email
            <input type="email" required value={form.email} onChange={set("email")} autoComplete="email" />
          </label>
          <label>
            WhatsApp / mobile
            <input required value={form.phone} onChange={set("phone")} placeholder="0771 234 567" autoComplete="tel" />
          </label>
          <label>
            Password
            <input type="password" required minLength="8" value={form.password} onChange={set("password")} autoComplete="new-password" />
          </label>
          {error && <p className="alert">{error}</p>}
          <LoadingButton className="btn primary full" loading={busy} loadingLabel="Creating account…">
            Create account
          </LoadingButton>
        </form>
        <p className="auth-alt">
          Already registered? <Link to="/login" state={location.state}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
