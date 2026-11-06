import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { LoadingButton } from "./Loading";

/**
 * Shows an uploaded catalogue reference photo when available, otherwise an illustration.
 * Catalogue photos represent an engine type and do not indicate current stock.
 */
export function EngineArt({ engine, className = "" }) {
  if (engine?.image_url) {
    return <img className={className} src={engine.image_url} alt={engine.title} loading="lazy" />;
  }
  const label = (engine?.make || "Engine").toUpperCase();
  return (
    <div className={`engine-art ${className}`} role="img" aria-label={`${label} engine illustration`}>
      <svg viewBox="0 0 200 120" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="26" y="42" width="148" height="46" rx="4" />
          <rect x="14" y="56" width="14" height="18" rx="2" />
          <rect x="174" y="56" width="14" height="18" rx="2" />
          <path d="M52 42v-12h22v12M126 42v-12h22v12" />
          <path d="M40 88v14M70 88v14M130 88v14M160 88v14" />
          <circle cx="100" cy="65" r="16" />
          <circle cx="100" cy="65" r="5" />
          <path d="M100 49v-8M100 81v8M84 65h-8M116 65h8" />
          <path d="M88 53l-5-5M112 77l5 5M112 53l5-5M88 77l-5 5" />
        </g>
        <text x="100" y="112" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7" letterSpacing="2" fill="currentColor">
          {label}
        </text>
      </svg>
    </div>
  );
}

export default function EngineFinder({ compact = false }) {
  const navigate = useNavigate();
  const [facets, setFacets] = useState({ makes: [], models: [] });
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api("/engines/facets")
      .then((res) => active && setFacets(res))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  function submit(e) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    navigate(`/engines${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <form className="finder" onSubmit={submit}>
      <div className="finder-title">
        <span>Find the engine for your vehicle</span>
        <span className="mono">01</span>
      </div>
      <div className="finder-fields">
        <input
          list="vehicle-models"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Vehicle or engine code"
          aria-label="Vehicle or engine code"
        />
        <datalist id="vehicle-models">
          {facets.models.map((m) => (
            <option key={m} value={m} />
          ))}
          {facets.makes.map((m) => (
            <option key={`make-${m}`} value={m} />
          ))}
        </datalist>
        <select aria-label="Make" onChange={(e) => setQ(e.target.value)} defaultValue="">
          <option value="">Any make</option>
          {facets.makes.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <LoadingButton className="btn primary" disabled={loading} loading={loading} loadingLabel="Loading…">
          Find my engine
        </LoadingButton>
        {!compact && (
          <span className="finder-hint">
            Type a model (Hilux), a code (1KD-FTV) or a truck (NQR).
          </span>
        )}
        {error && <span className="finder-hint" role="status">{error}</span>}
      </div>
    </form>
  );
}
