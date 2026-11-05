import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, money } from "../lib/api";
import { LoadingState } from "../components/Loading";

const SORTS = [
  ["featured", "Recommended"],
  ["price_asc", "Price ↑"],
  ["price_desc", "Price ↓"],
  ["lead_time", "Fastest lead"],
];

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const [engines, setEngines] = useState([]);
  const [facets, setFacets] = useState({ makes: [], fuels: [], conditions: [], models: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filters = useMemo(
    () => ({
      q: params.get("q") || "",
      make: params.get("make") || "",
      fuel: params.get("fuel") || "",
      condition: params.get("condition") || "",
      sort: params.get("sort") || "featured",
    }),
    [params]
  );

  useEffect(() => {
    api("/engines/facets")
      .then(setFacets)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && qs.set(k, v));
    api(`/engines?${qs}`)
      .then((res) => alive && setEngines(res.engines))
      .catch((err) => alive && setError(err.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [filters]);

  function set(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const activeCount = ["q", "make", "fuel", "condition"].filter((k) => filters[k]).length;

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Sourcing catalogue</p>
          <h1>Engines</h1>
          <p className="lede">
            Families we source regularly from Dubai. Nothing is held in stock — request a type and
            we confirm availability, inspect the unit and quote the landed cost.
          </p>
        </div>
        <div className="meta" style={{ textAlign: "right" }}>
          <div className="mono" style={{ fontSize: "1.6rem", fontWeight: 700 }}>
            {loading ? "—" : String(engines.length).padStart(2, "0")}
          </div>
          <span className="small muted">engine types shown</span>
        </div>
      </div>

      <div className="filterbar">
        <input
          placeholder="Search by code, model or vehicle — e.g. 1KD, Hilux, J08E"
          value={filters.q}
          onChange={(e) => set("q", e.target.value)}
          aria-label="Search"
        />
        <select value={filters.make} onChange={(e) => set("make", e.target.value)} aria-label="Make">
          <option value="">All makes</option>
          {facets.makes.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select value={filters.fuel} onChange={(e) => set("fuel", e.target.value)} aria-label="Fuel">
          <option value="">Any fuel</option>
          {(facets.fuels.length ? facets.fuels : ["diesel", "petrol"]).map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <select value={filters.condition} onChange={(e) => set("condition", e.target.value)} aria-label="Condition">
          <option value="">Any condition</option>
          {(facets.conditions.length ? facets.conditions : ["used_jdm", "reconditioned", "new"]).map((c) => (
            <option key={c} value={c}>{c.replace("_", " ")}</option>
          ))}
        </select>
        <select value={filters.sort} onChange={(e) => set("sort", e.target.value)} aria-label="Sort">
          {SORTS.map(([v, label]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
      </div>

      {error && <p className="alert">{error}</p>}

      {loading ? (
        <LoadingState label="Loading engine catalogue…" />
      ) : engines.length === 0 ? (
        <div className="empty">
          <h3>Nothing in the catalogue matches that</h3>
          <p className="muted" style={{ maxWidth: "46ch", margin: "0 auto 1.5rem" }}>
            We can still source it. Send the make, model code or VIN and our Dubai desk will quote
            it.
          </p>
          <div style={{ display: "flex", gap: "0.7rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link className="btn primary" to="/checkout">Request this engine</Link>
            {activeCount > 0 && (
              <button className="btn" onClick={() => setParams({}, { replace: true })}>
                Clear filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="engine-grid">
          {engines.map((engine) => (
            <Link className="engine-card" key={engine.id} to={`/engines/${engine.id}`}>
              <div className="engine-card-top">
                <span className="engine-code">{engine.make} · {engine.model_code}</span>
                {engine.sourcing_available ? (
                  <span className="pill ok">Sourcing</span>
                ) : (
                  <span className="pill muted">Paused</span>
                )}
              </div>
              <h3>{engine.title}</h3>
              <p className="engine-spec">
                {engine.displacement_cc ? `${engine.displacement_cc.toLocaleString()} cc` : "—"} ·{" "}
                {engine.fuel} · {engine.cylinders || "—"} cyl · {engine.condition.replace("_", " ")}
              </p>
              <p className="engine-desc">{engine.description}</p>
              <div className="engine-bottom">
                <div className="engine-price">
                  <span className="label">Supplier guide</span>
                  <strong>{money(engine.guide_price_usd)}</strong>
                </div>
                <span className="mono small muted">{engine.typical_lead_days}d</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
