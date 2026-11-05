import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api, dateShort, money } from "../lib/api";
import { useAuth } from "../lib/auth";
import Modal from "../components/Modal";
import { LoadingButton, LoadingState } from "../components/Loading";

export default function Account() {
  const { user, loading, updateProfile } = useAuth();
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const [profile, setProfile] = useState({ name: "", phone: "" });

  function editProfile() {
    setProfile({ name: user.name || "", phone: user.phone || "" });
    setProfileError("");
    setProfileNotice("");
    setProfileOpen(true);
  }

  async function saveProfile(event) {
    event.preventDefault();
    setProfileBusy(true);
    setProfileError("");
    try {
      await updateProfile(profile);
      setProfileNotice("Your contact details have been updated.");
      setProfileOpen(false);
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileBusy(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    let active = true;
    setOrdersLoading(true);
    api("/orders")
      .then((res) => active && setOrders(res.orders))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setOrdersLoading(false));
    return () => {
      active = false;
    };
  }, [user]);

  if (loading) return <div className="container page"><LoadingState label="Loading your account…" /></div>;
  if (!user) {
    return (
      <div className="container page narrow">
        <p className="eyebrow">My account</p>
        <h1>Sign in to continue</h1>
        <p className="lede">Your orders, quotes, and payment history are available after you sign in.</p>
        <Link
          className="btn primary"
          to="/login"
          state={{ next: "/account", backgroundLocation: location }}
        >
          Sign in
        </Link>
      </div>
    );
  }

  const open = orders.filter((o) => !["delivered", "cancelled"].includes(o.status));
  const closed = orders.filter((o) => ["delivered", "cancelled"].includes(o.status));

  const table = (list) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Reference</th><th>Engines</th><th>Status</th><th>Requested</th><th>Total</th><th>Balance</th><th /></tr>
        </thead>
        <tbody>
          {list.map((order) => (
            <tr key={order.id}>
              <td className="mono"><strong>{order.reference}</strong></td>
              <td>{order.items.map((i) => `${i.model_code} ×${i.quantity}`).join(", ")}</td>
              <td><span className={`status ${order.status}`}>{order.status_label}</span></td>
              <td className="mono small">{dateShort(order.created_at)}</td>
              <td className="mono">{money(order.breakdown.total)}</td>
              <td className="mono">{money(order.breakdown.balance_due)}</td>
              <td><Link className="link-btn" to={`/orders/${order.reference}`}>Open</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <p className="eyebrow">My account</p>
          <h1>{user.name}</h1>
          <p className="muted">{user.email} · {user.phone || "no phone on file"}</p>
        </div>
        <div className="hero-actions">
          <button className="btn" type="button" onClick={editProfile}>Edit contact details</button>
          <Link className="btn primary" to="/engines">Request another engine</Link>
        </div>
      </div>

      {profileNotice && <p className="success" role="status">{profileNotice}</p>}
      {error && <p className="alert">{error}</p>}

      {profileOpen && (
        <Modal title="Edit contact details" onClose={() => setProfileOpen(false)} className="auth-dialog">
          <div className="auth-card">
            <p className="eyebrow">Account details</p>
            <h2>Keep your contact details current</h2>
            <p className="muted">We use these details for quotes and updates about your requests.</p>
            {profileError && <p className="alert" role="alert">{profileError}</p>}
            <form className="stack-form" onSubmit={saveProfile}>
              <label>
                Full name
                <input
                  autoComplete="name"
                  required
                  minLength={2}
                  value={profile.name}
                  onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                Mobile / WhatsApp number
                <input
                  autoComplete="tel"
                  type="tel"
                  required
                  value={profile.phone}
                  onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))}
                />
              </label>
              <p className="small muted">Email address: {user.email} (cannot be changed here)</p>
              <LoadingButton className="btn primary full" loading={profileBusy} loadingLabel="Saving details…">
                Save contact details
              </LoadingButton>
            </form>
          </div>
        </Modal>
      )}

      {ordersLoading ? (
        <LoadingState label="Loading your orders…" />
      ) : orders.length === 0 ? (
        <div className="empty">
          <h3>No requests yet</h3>
          <p className="muted" style={{ maxWidth: "42ch", margin: "0 auto 1.5rem" }}>
            Pick the engine type you need and we&apos;ll quote the landed cost.
          </p>
          <Link className="btn primary" to="/engines">Browse engines</Link>
        </div>
      ) : (
        <>
          <div className="section-head">
            <div><p className="eyebrow">Active</p><h2 style={{ fontSize: "1.6rem" }}>Open requests</h2></div>
            <span className="meta">{open.length} open</span>
          </div>
          {open.length ? table(open) : <p className="muted">Nothing in progress.</p>}

          {closed.length > 0 && (
            <>
              <div className="section-head" style={{ marginTop: "3rem" }}>
                <div><p className="eyebrow">Archive</p><h2 style={{ fontSize: "1.6rem" }}>Completed</h2></div>
              </div>
              {table(closed)}
            </>
          )}
        </>
      )}
    </div>
  );
}
