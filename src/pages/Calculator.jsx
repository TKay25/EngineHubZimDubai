import { useEffect, useState } from "react";
import CostBreakdown from "../components/CostBreakdown";
import { api, money } from "../lib/api";
import { useCart } from "../lib/cart";
import { LoadingButton, LoadingState } from "../components/Loading";

export default function Calculator() {
  const { items, total, add, clear } = useCart();
  const [engines, setEngines] = useState([]);
  const [form, setForm] = useState({ goods_total: "", freight: "", insurance: "", clearing: "", inland: "" });
  const [estimate, setEstimate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      api("/engines").then((res) => active && setEngines(res.engines)),
      api("/quote-estimate", { method: "POST", body: { goods_total: 4200 } })
        .then((res) => active && setEstimate(res.estimate)),
    ])
      .catch((err) => active && setError(err.message))
      .finally(() => active && setInitialLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const goodsTotal = Number(form.goods_total) || total;

  async function calculate(e) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = { goods_total: goodsTotal };
      ["freight", "insurance", "clearing", "inland"].forEach((k) => {
        if (form[k] !== "") body[k] = Number(form[k]);
      });
      const res = await api("/quote-estimate", { method: "POST", body });
      setEstimate(res.estimate);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const pick = (e) => {
    const engine = engines.find((x) => String(x.id) === e.target.value);
    if (engine) {
      add(engine, 1);
      setForm((f) => ({ ...f, goods_total: "" }));
      e.target.value = "";
    }
  };

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Landed-cost calculator</p>
          <h1>
            What it costs
            <br />
            <span className="serif">to land it.</span>
          </h1>
          <p className="lede">
            Start from the supplier price and add every cost that follows the engine: freight,
            insurance, ZIMRA duty, VAT, surtax, clearing and inland delivery.
          </p>
        </div>
      </div>

      <div className="detail-grid">
        <section>
          <h2 style={{ marginTop: 0 }}>01 · Engines</h2>
          <div className="cart-lines">
            {items.length === 0 && (
              <p className="muted" style={{ padding: "1rem 0" }}>
                No engines selected — add one below, or type a supplier price directly.
              </p>
            )}
            {items.map((item) => (
              <div className="cart-line" key={item.engine.id}>
                <div>
                  <strong>{item.engine.title}</strong>
                  <div className="muted small">× {item.quantity}</div>
                </div>
                <span className="mono">{money(item.engine.guide_price_usd * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="inline-form">
            <select defaultValue="" onChange={pick} aria-label="Add engine">
              <option value="" disabled>Add an engine type…</option>
              {engines.map((e) => (
                <option key={e.id} value={e.id}>{e.title} — {money(e.guide_price_usd)}</option>
              ))}
            </select>
            {items.length > 0 && <button type="button" className="btn small" onClick={clear}>Clear</button>}
          </div>
          {initialLoading && <LoadingState compact label="Loading calculator…" />}

          <h2 style={{ marginTop: "2.5rem" }}>02 · Assumptions</h2>
          <p className="muted small">
            Leave a field blank to use our current default. Duty, VAT and surtax come from company
            settings.
          </p>
          <form className="calc-form" onSubmit={calculate}>
            <label>
              Supplier price (USD)
              <input type="number" min="0" step="0.01" placeholder={total ? total.toFixed(2) : "4200"} value={form.goods_total} onChange={set("goods_total")} />
            </label>
            <label>
              Freight
              <input type="number" min="0" step="0.01" placeholder="auto" value={form.freight} onChange={set("freight")} />
            </label>
            <label>
              Insurance
              <input type="number" min="0" step="0.01" placeholder="auto" value={form.insurance} onChange={set("insurance")} />
            </label>
            <label>
              Clearing
              <input type="number" min="0" step="0.01" placeholder="auto" value={form.clearing} onChange={set("clearing")} />
            </label>
            <label>
              Inland delivery
              <input type="number" min="0" step="0.01" placeholder="auto" value={form.inland} onChange={set("inland")} />
            </label>
            <LoadingButton className="btn primary" loading={busy} loadingLabel="Calculating…" disabled={!goodsTotal}>
              Calculate
            </LoadingButton>
          </form>
          {error && <p className="alert">{error}</p>}
        </section>

        <aside>
          <CostBreakdown breakdown={estimate} title="03 · Estimate" />
        </aside>
      </div>
    </div>
  );
}
