import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import CostBreakdown from "../components/CostBreakdown";
import { EngineArt } from "../components/EngineFinder";
import Modal from "../components/Modal";
import { api, money } from "../lib/api";
import { useCart } from "../lib/cart";
import { LoadingState } from "../components/Loading";

export default function EngineDetail() {
  const { id } = useParams();
  const { add } = useCart();
  const [engine, setEngine] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [fits, setFits] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api(`/engines/${id}`)
      .then(async (res) => {
        if (!active) return;
        setEngine(res.engine);
        const est = await api("/quote-estimate", {
          method: "POST",
          body: { goods_total: res.engine.guide_price_usd },
        });
        if (!active) return;
        setEstimate(est.estimate);
        const matches = await api(`/fitment?make=${encodeURIComponent(res.engine.make)}`);
        if (active) setFits(matches.engines.filter((e) => e.id !== res.engine.id).slice(0, 4));
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  if (error) return <div className="container page"><p className="alert">{error}</p></div>;
  if (loading || !engine) return <div className="container page"><LoadingState label="Loading engine details…" /></div>;

  function addToRequest() {
    add(engine, quantity);
    setAdded({ title: engine.title, quantity });
  }

  return (
    <>
    <div className="container page">
      <Link to="/engines" className="back">← Catalogue</Link>

      <div className="page-head">
        <div>
          <p className="eyebrow">
            {engine.make} · {engine.model_code}
          </p>
          <h1>{engine.title}</h1>
          <p className="lede">{engine.description}</p>
        </div>
        <div className="meta" style={{ textAlign: "right" }}>
          <div className="mono" style={{ fontSize: "1.05rem" }}>{engine.condition.replace("_", " ")}</div>
          <span className="small muted">{engine.typical_lead_days} days typical</span>
        </div>
      </div>

      <div className="detail-grid">
        <section>
          <div className="engine-art-block">
            <EngineArt engine={engine} className="engine-art-large" />
            <span className="art-caption">Reference illustration — real unit photos are supplied in your proforma</span>
          </div>

          <dl className="specs">
            <div><dt>Model code</dt><dd>{engine.model_code}</dd></div>
            <div><dt>Displacement</dt><dd>{engine.displacement_cc ? `${engine.displacement_cc.toLocaleString()} cc` : "—"}</dd></div>
            <div><dt>Fuel</dt><dd>{engine.fuel}</dd></div>
            <div><dt>Cylinders</dt><dd>{engine.cylinders || "—"}</dd></div>
            <div><dt>Transmission</dt><dd>{engine.transmission || "—"}</dd></div>
            <div><dt>Condition</dt><dd>{engine.condition_grade ? `Grade ${engine.condition_grade}` : engine.condition.replace("_", " ")}</dd></div>
            <div><dt>Warranty</dt><dd>{engine.warranty_days || 90} days</dd></div>
            <div><dt>Supplier guide</dt><dd>{money(engine.guide_price_usd)}</dd></div>
          </dl>

          {engine.includes.length > 0 && (
            <>
              <h3 style={{ marginTop: "2rem" }}>Included in supply</h3>
              <ul className="chips">
                {engine.includes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          )}

          {engine.fits.length > 0 && (
            <>
              <h3 style={{ marginTop: "1.4rem" }}>Fits</h3>
              <ul className="chips">
                {engine.fits.map((vehicle) => (
                  <li key={vehicle}>{vehicle}</li>
                ))}
              </ul>
            </>
          )}

          {engine.warranty_note && (
            <p className="notice" style={{ marginTop: "1.4rem" }}>{engine.warranty_note}</p>
          )}

          <div className="add-row">
            <label>
              Quantity
              <input
                type="number"
                min="1"
                max="20"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(Number(e.target.value) || 1, 20)))}
              />
            </label>
            <button className="btn primary" onClick={addToRequest}>
              Add to request
            </button>
            <Link className="btn" to="/checkout">Review request</Link>
          </div>
          <p className="fineprint">
            Adding to your request does not commit you to buy. We confirm availability, then issue a
            proforma invoice with the final landed cost.
          </p>
        </section>

        <aside>
          <CostBreakdown breakdown={estimate} title="Landed estimate" />
          <div className="trust-item" style={{ marginTop: "1.2rem" }}>
            <h3>What happens next</h3>
            <p>
              We confirm the unit in Dubai, record its supplier, lot and serial number, and issue a
              proforma. Payment opens once that proforma is accepted.
            </p>
          </div>
        </aside>
      </div>

      {fits.length > 0 && (
        <section className="section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Also sourced</p>
              <h2>Other {engine.make} engines</h2>
            </div>
            <Link className="textlink" to={`/engines?make=${encodeURIComponent(engine.make)}`}>
              All {engine.make}
            </Link>
          </div>
          <div className="engine-grid">
            {fits.map((e) => (
              <Link className="engine-card" key={e.id} to={`/engines/${e.id}`}>
                <div className="engine-card-top">
                  <span className="engine-code">{e.make} · {e.model_code}</span>
                </div>
                <h3>{e.title}</h3>
                <p className="engine-desc">{e.description}</p>
                <div className="engine-bottom">
                  <div className="engine-price">
                    <span className="label">Supplier guide</span>
                    <strong>{money(e.guide_price_usd)}</strong>
                  </div>
                  <span className="engine-arrow">↗</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
    {added && (
      <Modal title="Added to your request" onClose={() => setAdded(null)} className="notice-dialog">
        <div className="dialog-content">
          <p className="eyebrow">Request updated</p>
          <h2>Added to your request</h2>
          <p><strong>{added.title}</strong> · quantity {added.quantity}</p>
          <p className="muted">Your request is saved on this device. Review it when you’re ready; nothing is ordered until you submit the quote request.</p>
          <div className="dialog-actions">
            <Link className="btn primary" to="/checkout">Review request</Link>
            <button className="btn" type="button" onClick={() => setAdded(null)}>Keep browsing</button>
          </div>
        </div>
      </Modal>
    )}
    </>
  );
}
