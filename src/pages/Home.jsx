import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import EngineFinder from "../components/EngineFinder";
import { api, money } from "../lib/api";
import { useAuth } from "../lib/auth";
import { LoadingState } from "../components/Loading";

const STEPS = [
  ["Tell us what you need", "Send the model, engine code or the vehicle it goes in. A screenshot or VIN is enough."],
  ["We confirm availability", "Our Dubai desk verifies supplier stock, inspects the unit and issues a proforma invoice."],
  ["Reserve with a deposit", "Paynow, RTGS or cash on delivery. The deposit secures sourcing — nothing is taken up front."],
  ["We ship, clear and deliver", "Export, sea freight, ZIMRA duty, clearing and delivery — tracked at every step."],
];

const TRUST = [
  ["Inspection before export", "Compression test, oil-pressure check and a video walk-around for every unit."],
  ["Duty shown, not hidden", "Duty, VAT, surtax, clearing and inland delivery are itemised before you pay."],
  ["Proof of sourcing", "Supplier, lot and serial number recorded against your line once purchased."],
  ["One desk, two countries", "Dubai sourcing and Zimbabwe delivery handled by the same team."],
];

export default function Home() {
  const { site, companyName } = useAuth();
  const [featured, setFeatured] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState("");

  useEffect(() => {
    let active = true;
    api("/engines?sort=featured")
      .then((res) => active && setFeatured(res.engines.slice(0, 3)))
      .catch((err) => active && setFeaturedError(err.message))
      .finally(() => active && setFeaturedLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <section className="hero">
        <div className="container">
          <div className="hero-grid">
            <div>
              <div className="hero-kicker">
                <span>Dubai sourcing desk</span>
                <span>Zimbabwe delivery</span>
                <span>Pre-order only</span>
              </div>
              <h1>
                <span className="line">The right engine,</span>
                <span className="line serif">sourced from Dubai,</span>
                <span className="line">landed at your door.</span>
              </h1>
              <p className="hero-copy">
                {companyName} sources complete engines to order. You choose the engine, we verify
                it in Dubai and quote the full landed cost — freight, duty, clearance and delivery
                — before a deposit is paid.
              </p>
              <div className="hero-actions">
                <Link className="btn primary large" to="/engines">Browse engine types</Link>
                <Link className="btn large" to="/calculator">Build a landed-cost quote</Link>
              </div>
            </div>

            <aside className="specimen">
              <div className="specimen-head">
                <h3>Toyota 1HZ</h3>
                <span className="code">4164 cc · diesel</span>
              </div>
              <ul className="specimen-rows">
                <li><span>Supplier price, Dubai</span><strong>USD 4,200</strong></li>
                <li><span>Sea freight + insurance</span><strong>USD 697</strong></li>
                <li><span>Duty, VAT, surtax</span><strong>USD 1,469</strong></li>
                <li><span>Clearing + inland</span><strong>USD 800</strong></li>
                <li className="total"><span>Landed in Harare</span><strong>USD 7,166</strong></li>
              </ul>
              <div className="specimen-foot">
                <span>Deposit 50% · USD 3,583</span>
                <Link className="textlink" to="/calculator">Adjust</Link>
              </div>
            </aside>
          </div>

          <div style={{ paddingBottom: "2.5rem" }}>
            <EngineFinder />
          </div>

          <div className="metrics">
            <div><strong>72h</strong><span>Quote turnaround</span></div>
            <div><strong>7–45d</strong><span>Typical lead time</span></div>
            <div><strong>100%</strong><span>Landed cost stated</span></div>
            <div><strong>3</strong><span>Ways to pay</span></div>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="editorial">
          <div>
            <p className="eyebrow">Why we exist</p>
            <h2>
              Engines are the
              <br />
              <span className="serif">hard part</span> of importing.
            </h2>
          </div>
          <div className="editorial-body">
            <p>
              A vehicle can be inspected. An engine cannot — not from a photograph, not from a
              listing, not after it has crossed an ocean. Most importers sell you a price and hope
              the unit matches it. We do the opposite: the unit is found, tested and recorded in
              Dubai first, then quoted with every cost that follows it.
            </p>
            <p>
              That means the figure you agree to is the figure you pay. Freight, ZIMRA duty, VAT,
              surtax, clearing agent and inland delivery are itemised line by line. If a unit is
              not inspectable, it does not enter the catalogue.
            </p>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <div>
            <p className="eyebrow">The process</p>
            <h2>Four steps to a landed engine</h2>
          </div>
          <span className="meta">No stock held · nothing to clear</span>
        </div>
        <div className="process">
          {STEPS.map(([title, body], i) => (
            <div className="process-step" key={title}>
              <span className="num">{String(i + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {featuredLoading ? (
        <section className="container section">
          <LoadingState compact label="Loading featured engines…" />
        </section>
      ) : featuredError ? (
        <section className="container section">
          <p className="alert" role="status">{featuredError}</p>
        </section>
      ) : featured.length > 0 && (
        <section className="container section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Most requested</p>
              <h2>Engine types we source</h2>
            </div>
            <Link className="textlink" to="/engines">All engine types</Link>
          </div>
          <div className="engine-grid">
            {featured.map((e) => (
              <Link className="engine-card" key={e.id} to={`/engines/${e.id}`}>
                <div className="engine-card-top">
                  <span className="engine-code">{e.make} · {e.model_code}</span>
                  <span className="pill ok">{e.warranty_days || 90}d warranty</span>
                </div>
                <h3>{e.title}</h3>
                <p className="engine-spec">
                  {e.displacement_cc?.toLocaleString()} cc · {e.fuel} · {e.cylinders || "—"} cyl
                </p>
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

      <section className="container section">
        <div className="section-head">
          <div>
            <p className="eyebrow">What you get</p>
            <h2>Proof, not promises</h2>
          </div>
          <span className="meta">{site?.warranty_summary ? "90-day start-up warranty" : ""}</span>
        </div>
        <div className="trust-grid">
          {TRUST.map(([title, body]) => (
            <div className="trust-item" key={title}>
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3Z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="closing">
          <div>
            <p className="eyebrow" style={{ color: "#8f8a7e" }}>Ready to start</p>
            <h2>Send us the engine. We&apos;ll price it landed.</h2>
            <p>
              No payment until you have seen the proforma. If we cannot find the unit, we tell you
              what it would take to get it.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
            <Link className="btn large" to="/checkout">Request a quote</Link>
            {site?.whatsapp_link && (
              <a className="btn large" href={site.whatsapp_link} target="_blank" rel="noreferrer">
                WhatsApp us
              </a>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
