import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import CostBreakdown from "../components/CostBreakdown";
import { api, money } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useCart } from "../lib/cart";
import { LoadingButton, LoadingState } from "../components/Loading";

export default function Checkout() {
  const { items, total, setQuantity, remove, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [estimate, setEstimate] = useState(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [form, setForm] = useState({ fulfillment: "delivered_zimbabwe", destination_city: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [customBusy, setCustomBusy] = useState(false);
  const [error, setError] = useState("");
  const [custom, setCustom] = useState({ name: "", phone: "", make: "", details: "" });
  const [customSent, setCustomSent] = useState(false);

  useEffect(() => {
    if (!total) {
      setEstimate(null);
      setEstimateLoading(false);
      return;
    }
    let active = true;
    setEstimateLoading(true);
    api("/quote-estimate", { method: "POST", body: { goods_total: total } })
      .then((res) => active && setEstimate(res.estimate))
      .catch((err) => {
        if (active) {
          setEstimate(null);
          setError(err.message);
        }
      })
      .finally(() => active && setEstimateLoading(false));
    return () => {
      active = false;
    };
  }, [total]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api("/orders", {
        method: "POST",
        body: {
          items: items.map((i) => ({ engine_id: i.engine.id, quantity: i.quantity })),
          fulfillment: form.fulfillment,
          destination_city: form.destination_city,
          notes: form.notes,
        },
      });
      clear();
      navigate(`/orders/${res.order.reference}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendCustom(e) {
    e.preventDefault();
    setError("");
    setCustomBusy(true);
    try {
      await api("/leads", { method: "POST", body: custom });
      setCustomSent(true);
      setCustom({ name: "", phone: "", make: "", details: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setCustomBusy(false);
    }
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setC = (key) => (e) => setCustom((c) => ({ ...c, [key]: e.target.value }));
  const bump = (id, delta) => {
    const item = items.find((i) => i.engine.id === id);
    if (item) setQuantity(id, item.quantity + delta);
  };

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Sourcing request</p>
          <h1>Request a quote</h1>
          <p className="lede">
            No payment is taken now. We confirm availability and send a proforma with the full
            landed cost.
          </p>
        </div>
      </div>

      <div className="detail-grid">
        <section>
          {items.length === 0 ? (
            <div className="empty">
              <h3>Your request is empty</h3>
              <p className="muted" style={{ maxWidth: "42ch", margin: "0 auto 1.5rem" }}>
                Add the engine types you need, or describe a custom unit below.
              </p>
              <Link className="btn primary" to="/engines">Browse engine types</Link>
            </div>
          ) : (
            <>
              <div className="cart-lines">
                {items.map((item) => (
                  <div className="cart-line" key={item.engine.id}>
                    <div>
                      <strong>{item.engine.title}</strong>
                      <div className="muted small">
                        {item.engine.make} · {item.engine.model_code} · guide{" "}
                        {money(item.engine.guide_price_usd)}
                      </div>
                    </div>
                    <div className="qty">
                      <button className="icon-stepper" onClick={() => bump(item.engine.id, -1)} aria-label="Decrease">−</button>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={item.quantity}
                        onChange={(e) => setQuantity(item.engine.id, Number(e.target.value))}
                        aria-label={`Quantity for ${item.engine.title}`}
                      />
                      <button className="icon-stepper" onClick={() => bump(item.engine.id, 1)} aria-label="Increase">+</button>
                      <button className="link-btn" onClick={() => remove(item.engine.id)}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="cart-total">
                <span className="eyebrow" style={{ margin: 0 }}>Guide goods total</span>
                <strong>{money(total)}</strong>
              </div>

              <form className="stack-form" onSubmit={submit}>
                <label>
                  Fulfilment
                  <select value={form.fulfillment} onChange={set("fulfillment")}>
                    <option value="delivered_zimbabwe">Deliver to Zimbabwe (duty + clearing included)</option>
                    <option value="collected_dubai">Collect in Dubai (export paperwork only)</option>
                  </select>
                </label>
                <label>
                  Destination city
                  <input value={form.destination_city} onChange={set("destination_city")} placeholder="Harare, Bulawayo, Mutare…" />
                </label>
                <label>
                  Anything specific?
                  <textarea
                    rows="3"
                    value={form.notes}
                    onChange={set("notes")}
                    placeholder="e.g. need ECU and harness, specific year, delivery to Msasa"
                  />
                </label>
                {!user && (
                  <p className="notice">
                    Sign in so we can quote and track your order.{" "}
                    <Link to="/login" state={{ next: "/checkout" }}>Sign in</Link> or{" "}
                    <Link to="/register" state={{ next: "/checkout" }}>create an account</Link>.
                  </p>
                )}
                {error && <p className="alert">{error}</p>}
                <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
                  <LoadingButton className="btn primary" loading={busy} loadingLabel="Submitting request…" disabled={!user || items.length === 0}>
                    Submit sourcing request
                  </LoadingButton>
                  <Link className="btn" to="/engines">Add another engine</Link>
                </div>
              </form>
            </>
          )}
        </section>

        <aside>
          {estimateLoading ? <LoadingState compact label="Updating landed estimate…" /> : <CostBreakdown breakdown={estimate} title="Landed estimate" />}

          <div className="trust-item" style={{ marginTop: "1.2rem" }}>
            <h3>Can&apos;t find your engine?</h3>
            <p style={{ marginBottom: "0.9rem" }}>
              Send the details and our Dubai desk will source it.
            </p>
            {customSent ? (
              <p className="success" style={{ margin: 0 }}>Request sent. We&apos;ll be in touch.</p>
            ) : (
              <form className="stack-form" onSubmit={sendCustom}>
                <input required placeholder="Your name" value={custom.name} onChange={setC("name")} />
                <input required placeholder="WhatsApp number" value={custom.phone} onChange={setC("phone")} />
                <input placeholder="Vehicle / make" value={custom.make} onChange={setC("make")} />
                <textarea rows="3" placeholder="Engine details (model code, year, new or used)" value={custom.details} onChange={setC("details")} />
                <LoadingButton className="btn small" loading={customBusy} loadingLabel="Sending request…">
                  Send request
                </LoadingButton>
              </form>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
