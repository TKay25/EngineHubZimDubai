import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import CostBreakdown from "../components/CostBreakdown";
import StatusTimeline from "../components/StatusTimeline";
import { api, dateTime, money } from "../lib/api";
import { useAuth } from "../lib/auth";
import { LoadingButton, LoadingState } from "../components/Loading";

export default function OrderDetail() {
  const { reference } = useParams();
  const { user, site } = useAuth();
  const [order, setOrder] = useState(null);
  const [methods, setMethods] = useState([]);
  const [form, setForm] = useState({ method: "bank_transfer", amount_usd: "" });
  const [file, setFile] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [methodsLoading, setMethodsLoading] = useState(true);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setOrder((current) => current?.reference === reference ? current : null);
    try {
      const res = await api(`/orders/${reference}`);
      setOrder(res.order);
      setError("");
      return res.order;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [reference]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);
  useEffect(() => {
    let active = true;
    api("/payment-methods")
      .then((res) => active && setMethods(res.methods))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setMethodsLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (error && !order) return <div className="container page"><p className="alert">{error}</p></div>;
  if (loading && !order) return <div className="container page"><LoadingState label="Loading your order…" /></div>;
  if (!order) return null;

  const canPay = !["quote_requested", "cancelled", "delivered"].includes(order.status);
  const latest = order.payments[order.payments.length - 1];

  async function pay(e) {
    e.preventDefault();
    setPaymentBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await api(`/orders/${order.reference}/payments`, {
        method: "POST",
        body: { method: form.method, amount_usd: form.amount_usd || order.breakdown.deposit_due },
      });
      if (res.redirect_url) {
        window.location.href = res.redirect_url;
        return;
      }
      setNotice(
        res.payment.method === "bank_transfer"
          ? "Payment logged. Upload your proof of payment below so we can confirm it."
          : "Payment logged. It will be confirmed on delivery."
      );
      setForm({ method: form.method, amount_usd: "" });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setPaymentBusy(false);
    }
  }

  async function upload(e) {
    e.preventDefault();
    if (!file || !latest) return;
    const data = new FormData();
    data.append("proof", file);
    setUploadBusy(true);
    try {
      await api(`/orders/${order.reference}/payments/${latest.id}/proof`, { method: "POST", form: data });
      setNotice("Proof uploaded. Our team will confirm it shortly.");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <div className="container page">
      <Link to="/account" className="back">← My orders</Link>

      <div className="page-head">
        <div>
          <p className="eyebrow">Request {order.reference}</p>
          <h1>{order.status_label}</h1>
          <p className="muted">
            Requested {dateTime(order.created_at)}
            {order.destination_city ? ` · ${order.destination_city}` : ""} ·{" "}
            {order.fulfillment === "collected_dubai" ? "Collect in Dubai" : "Delivered to Zimbabwe"}
          </p>
        </div>
        <span className={`status ${order.status}`}>{order.status_label}</span>
      </div>

      {notice && <p className="success">{notice}</p>}
      {error && <p className="alert">{error}</p>}

      <div className="detail-grid">
        <section>
          <h2 style={{ marginTop: 0 }}>Engines</h2>
          <div className="cart-lines">
            {order.items.map((item) => (
              <div className="cart-line" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <div className="muted small">× {item.quantity} · sourcing: {item.sourcing_state.replace("_", " ")}</div>
                  {(item.lot_number || item.serial_number) && (
                    <div className="mono small" style={{ marginTop: "0.3rem" }}>
                      {item.lot_number && <>lot {item.lot_number} </>}
                      {item.serial_number && <>· serial {item.serial_number}</>}
                    </div>
                  )}
                </div>
                <span className="mono">{money(item.line_total)}</span>
              </div>
            ))}
          </div>

          {order.notes && (
            <>
              <h3>Your notes</h3>
              <p className="muted">{order.notes}</p>
            </>
          )}

          <h2 style={{ marginTop: "2.5rem" }}>Progress</h2>
          <StatusTimeline events={order.events} current={order.status} />

          {order.payments.length > 0 && (
            <>
              <h2 style={{ marginTop: "2.5rem" }}>Payments</h2>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Method</th><th>Amount</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {order.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="mono small">{dateTime(p.created_at)}</td>
                        <td>{p.method_label}</td>
                        <td className="mono">{money(p.amount_usd)}</td>
                        <td><span className={`status ${p.status}`}>{p.status.replace("_", " ")}</span></td>
                        <td>
                          {p.has_proof && (
                            <a className="link-btn" href={`/api/orders/${order.reference}/payments/${p.id}/proof`}>Proof</a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <aside>
          <CostBreakdown breakdown={order.breakdown} title="Landed cost" />

          {canPay && (
            <div className="trust-item" style={{ marginTop: "1.2rem" }}>
              <h3>Pay deposit or balance</h3>
              <form className="stack-form" onSubmit={pay}>
                <label>
                  Method
                  <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} disabled={methodsLoading}>
                    {methodsLoading && <option value="bank_transfer">Loading payment methods…</option>}
                    {methods.map((m) => (
                      <option key={m.value} value={m.value} disabled={!m.ready}>
                        {m.label}{m.ready ? "" : " — not enabled"}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Amount (USD)
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder={String(order.breakdown.deposit_due)}
                    value={form.amount_usd}
                    onChange={(e) => setForm({ ...form, amount_usd: e.target.value })}
                  />
                </label>
                <LoadingButton
                  className="btn primary"
                  loading={paymentBusy}
                  loadingLabel={form.method === "paynow" ? "Connecting to Paynow…" : "Recording payment…"}
                >
                  {form.method === "paynow" ? "Pay with Paynow" : "Record payment"}
                </LoadingButton>
                {site?.bank_details && form.method === "bank_transfer" && (
                  <p className="info" style={{ margin: 0 }}>{site.bank_details}</p>
                )}
                {site?.paynow_note && form.method === "paynow" && (
                  <p className="info" style={{ margin: 0 }}>{site.paynow_note}</p>
                )}
              </form>

              {latest && latest.method === "bank_transfer" && latest.status !== "confirmed" && (
                <form className="stack-form" onSubmit={upload} style={{ marginTop: "0.9rem" }}>
                  <label>
                    Proof of payment
                    <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setFile(e.target.files[0])} />
                  </label>
                  <LoadingButton className="btn small" disabled={!file} loading={uploadBusy} loadingLabel="Uploading proof…">
                    Upload proof
                  </LoadingButton>
                </form>
              )}
            </div>
          )}

          {order.status === "quote_requested" && (
            <p className="notice" style={{ marginTop: "1.2rem" }}>
              We are confirming supplier availability. You&apos;ll receive a proforma invoice by
              email and WhatsApp — payment opens once the quote is issued.
            </p>
          )}

          {user?.is_admin && (
            <p className="fineprint">
              Need to edit this quote? <Link to="/admin">Open the admin console</Link>.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
