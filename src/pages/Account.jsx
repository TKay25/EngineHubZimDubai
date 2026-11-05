import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, dateShort, money } from "../lib/api";
import { useAuth } from "../lib/auth";
import { LoadingState } from "../components/Loading";

export default function Account() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate("/login", { state: { next: "/account" } });
  }, [loading, user, navigate]);

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

  if (loading || !user) return <div className="container page"><LoadingState label="Loading your account…" /></div>;

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
        <Link className="btn primary" to="/engines">Request another engine</Link>
      </div>

      {error && <p className="alert">{error}</p>}

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
