import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Modal from "../components/Modal";
import { api, dateShort, money } from "../lib/api";
import { useAuth } from "../lib/auth";
import { LoadingButton, LoadingState } from "../components/Loading";

const TABS = [
  ["orders", "Requests"],
  ["catalog", "Catalogue"],
  ["payments", "Payments"],
  ["leads", "Quote requests"],
  ["customers", "Customers"],
  ["settings", "Settings"],
];

const STATUS_FLOW = [
  "quote_requested", "quoted", "deposit_paid", "sourcing", "purchased",
  "shipped", "customs_clearing", "delivered", "cancelled",
];

const EMPTY_ENGINE = {
  make: "", model_code: "", title: "", displacement_cc: "", fuel: "diesel",
  cylinders: "", transmission: "manual", condition: "used_jdm", condition_grade: "",
  warranty_days: 90, warranty_note: "", typical_lead_days: 30, guide_price_usd: "",
  description: "", includes: "", fits_vehicles: "", image_url: "",
  sourcing_available: true, featured: false,
};

function Stat({ label, value, highlight }) {
  return (
    <div className={`stat ${highlight ? "highlight" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function Admin() {
  const { user, loading, loadSite } = useAuth();
  const location = useLocation();
  const [tab, setTab] = useState("orders");
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [engines, setEngines] = useState([]);
  const [leads, setLeads] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [workingLeadId, setWorkingLeadId] = useState(null);

  const load = useCallback(async () => {
    if (!user?.is_admin) return;
    setError("");
    setLoadingData(true);
    try {
      const [s, o] = await Promise.all([
        api("/admin/stats"),
        api(`/admin/orders${filter ? `?status=${filter}` : ""}`),
      ]);
      setStats(s);
      setOrders(o.orders);
      setStatuses(o.statuses);
      if (tab === "catalog") setEngines((await api("/admin/engines")).engines);
      if (tab === "leads") setLeads((await api("/admin/leads")).leads);
      if (tab === "customers") setCustomers((await api("/admin/customers")).customers);
      if (tab === "settings") setSettings((await api("/admin/settings")).settings);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingData(false);
    }
  }, [user, filter, tab]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="container page"><LoadingState label="Loading operations console…" /></div>;
  if (!user?.is_admin) {
    return (
      <div className="container page">
        <p className="alert">Administrator access required. <Link to="/login" state={{ backgroundLocation: location }}>Sign in</Link>.</p>
      </div>
    );
  }

  return (
    <div className="container wide page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Operations</p>
          <h1>Console</h1>
        </div>
        <LoadingButton className="btn small" onClick={load} loading={loadingData} loadingLabel="Refreshing…">
          Refresh
        </LoadingButton>
      </div>

      {stats && (
        <div className="stats">
          <Stat label="Open requests" value={stats.open_orders} highlight />
          <Stat label="Payments confirmed" value={money(stats.confirmed_payments_usd)} />
          <Stat label="Freight booked" value={money(stats.freight_booked_usd)} />
          <Stat label="Quote requests" value={stats.unhandled_leads} />
          <Stat label="Customers" value={stats.customers} />
        </div>
      )}

      <div className="tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {error && <p className="alert">{error}</p>}
      {notice && <p className="success">{notice}</p>}

      <div className={`admin-content${loadingData ? " is-loading" : ""}`} aria-busy={loadingData}>
      {loadingData && <LoadingState label={`Loading ${tab === "orders" ? "requests" : tab}…`} />}
      {tab === "orders" && (
        <>
          <div className="toolbar">
            <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter status">
              <option value="">All statuses</option>
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ref</th><th>Customer</th><th>Engines</th><th>Status</th>
                  <th>Total</th><th>Deposit</th><th>Paid</th><th>Created</th><th />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="mono"><strong>{o.reference}</strong></td>
                    <td>
                      {o.customer?.name}
                      <div className="muted small">{o.customer?.phone}</div>
                    </td>
                    <td className="small">{o.items.map((i) => `${i.model_code} ×${i.quantity}`).join(", ")}</td>
                    <td><span className={`status ${o.status}`}>{o.status_label}</span></td>
                    <td className="mono">{money(o.breakdown.total)}</td>
                    <td className="mono">{money(o.breakdown.deposit_due)}</td>
                    <td className="mono">{money(o.breakdown.paid_total)}</td>
                    <td className="mono small">{dateShort(o.created_at)}</td>
                    <td>
                      <button className="link-btn" onClick={() => setOpen(open?.id === o.id ? null : o)}>
                        {open?.id === o.id ? "Close" : "Manage"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {open && (
            <Modal title={`Manage request ${open.reference}`} onClose={() => setOpen(null)} className="admin-dialog">
              <OrderPanel
                order={open}
                onDone={(msg, updated) => {
                  setNotice(msg);
                  if (updated) setOpen(updated);
                  load();
                }}
                onError={setError}
              />
            </Modal>
          )}
        </>
      )}

      {tab === "catalog" && (
        <CatalogAdmin
          engines={engines}
          onDone={(msg) => {
            setNotice(msg);
            load();
          }}
          onError={setError}
        />
      )}

      {tab === "payments" && <PaymentsPanel onDone={setNotice} onError={setError} />}

      {tab === "leads" && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Name</th><th>Phone</th><th>Engine</th><th>Details</th><th>Channel</th><th /></tr></thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="mono small">{dateShort(lead.created_at)}</td>
                  <td>{lead.name}</td>
                  <td className="mono small">{lead.phone}</td>
                  <td>{lead.make || "—"}</td>
                  <td className="wrap small">{lead.details || "—"}</td>
                  <td className="small">{lead.channel}</td>
                  <td>
                    {lead.handled ? (
                      <span className="pill ok">Handled</span>
                    ) : (
                      <button
                        className="link-btn"
                        disabled={workingLeadId === lead.id}
                        onClick={async () => {
                          setWorkingLeadId(lead.id);
                          try {
                            await api(`/admin/leads/${lead.id}`, { method: "PATCH", body: { handled: true } });
                            await load();
                          } catch (err) {
                            setError(err.message);
                          } finally {
                            setWorkingLeadId(null);
                          }
                        }}
                      >
                        {workingLeadId === lead.id && <span className="spinner" aria-hidden="true" />}
                        {workingLeadId === lead.id ? "Updating…" : "Mark handled"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "customers" && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Orders</th></tr></thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="small">{c.email}</td>
                  <td className="mono small">{c.phone}</td>
                  <td className="mono">{c.order_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "settings" && settings && (
        <SettingsAdmin
          settings={settings}
          onSaved={async (msg) => {
            setNotice(msg);
            await loadSite();
            load();
          }}
          onError={setError}
        />
      )}
      </div>
    </div>
  );
}

function CatalogAdmin({ engines, onDone, onError }) {
  const [draft, setDraft] = useState(EMPTY_ENGINE);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const set = (key) => (e) =>
    setDraft((d) => ({
      ...d,
      [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  function edit(engine) {
    setEditing(engine.id);
    setDraft({ ...EMPTY_ENGINE, ...engine, includes: (engine.includes || []).join(", "), fits_vehicles: (engine.fits || []).join(", ") });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setEditing(null);
    setDraft(EMPTY_ENGINE);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await api(`/admin/engines/${editing}`, { method: "PATCH", body: draft });
        onDone("Engine type updated.");
      } else {
        await api("/admin/engines", { method: "POST", body: draft });
        onDone("Engine type added to the catalogue.");
      }
      reset();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(engine) {
    setDeletingId(engine.id);
    try {
      await api(`/admin/engines/${engine.id}`, { method: "DELETE" });
      onDone("Engine type deleted.");
      setDeleteTarget(null);
    } catch (err) {
      onError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
    <div className="panel">
      <div className="section-head" style={{ marginBottom: "1.5rem" }}>
        <div>
          <p className="eyebrow">{editing ? "Editing" : "New"}</p>
          <h2 style={{ fontSize: "1.8rem" }}>{editing ? "Edit engine type" : "Add an engine type"}</h2>
        </div>
        <span className="meta">{engines.length} in catalogue</span>
      </div>
      <form onSubmit={save} className="stack-form">
        <div className="editor-grid">
          <label>Make<input required value={draft.make} onChange={set("make")} placeholder="Toyota" /></label>
          <label>Model code<input required value={draft.model_code} onChange={set("model_code")} placeholder="1HZ" /></label>
          <label>Title<input required value={draft.title} onChange={set("title")} placeholder="Toyota 1HZ 4.2L Diesel" /></label>
          <label>Displacement (cc)<input type="number" min="0" value={draft.displacement_cc} onChange={set("displacement_cc")} /></label>
          <label>Fuel<select value={draft.fuel} onChange={set("fuel")}><option value="diesel">Diesel</option><option value="petrol">Petrol</option></select></label>
          <label>Cylinders<input type="number" min="0" max="16" value={draft.cylinders} onChange={set("cylinders")} /></label>
          <label>Transmission<select value={draft.transmission} onChange={set("transmission")}><option value="manual">Manual</option><option value="automatic">Automatic</option></select></label>
          <label>Condition<select value={draft.condition} onChange={set("condition")}><option value="used_jdm">Used JDM</option><option value="reconditioned">Reconditioned</option><option value="new">New</option></select></label>
          <label>Grade<input value={draft.condition_grade} onChange={set("condition_grade")} placeholder="A" /></label>
          <label>Warranty (days)<input type="number" min="0" value={draft.warranty_days} onChange={set("warranty_days")} /></label>
          <label>Lead time (days)<input type="number" min="1" value={draft.typical_lead_days} onChange={set("typical_lead_days")} /></label>
          <label>Guide price (USD)<input required type="number" min="0.01" step="0.01" value={draft.guide_price_usd} onChange={set("guide_price_usd")} /></label>
          <label>Fits vehicles (comma separated)<input value={draft.fits_vehicles} onChange={set("fits_vehicles")} placeholder="Hilux, Fortuner, Hiace" /></label>
          <label>Includes (comma separated)<input value={draft.includes} onChange={set("includes")} placeholder="Turbo, injectors, ECU" /></label>
          <label>Image URL (optional)<input value={draft.image_url} onChange={set("image_url")} placeholder="https://…" /></label>
          <label>Description<input value={draft.description} onChange={set("description")} /></label>
          <label>Warranty note<input value={draft.warranty_note} onChange={set("warranty_note")} placeholder="90-day start-up warranty" /></label>
        </div>
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
            <input type="checkbox" checked={draft.sourcing_available} onChange={set("sourcing_available")} />
            Available to source
          </label>
          <label style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
            <input type="checkbox" checked={draft.featured} onChange={set("featured")} />
            Feature on home
          </label>
          <div style={{ marginLeft: "auto", display: "flex", gap: "0.6rem" }}>
            {editing && <button type="button" className="btn small" onClick={reset}>Cancel</button>}
            <LoadingButton className="btn primary small" loading={busy} loadingLabel={editing ? "Saving…" : "Adding…"}>
              {editing ? "Save changes" : "Add to catalogue"}
            </LoadingButton>
          </div>
        </div>
      </form>

      <div className="table-wrap" style={{ marginTop: "2.5rem" }}>
        <table>
          <thead><tr><th>Make</th><th>Model</th><th>Title</th><th>Guide</th><th>Lead</th><th>Status</th><th /></tr></thead>
          <tbody>
            {engines.map((e) => (
              <tr key={e.id}>
                <td>{e.make}</td>
                <td className="mono small">{e.model_code}</td>
                <td className="small">{e.title}</td>
                <td className="mono">{money(e.guide_price_usd)}</td>
                <td className="mono small">{e.typical_lead_days}d</td>
                <td>{e.sourcing_available ? <span className="pill ok">Live</span> : <span className="pill muted">Paused</span>}</td>
                <td className="nowrap">
                  <button type="button" className="link-btn" onClick={() => edit(e)}>Edit</button>
                  <button type="button" className="link-btn" style={{ marginLeft: "0.8rem" }} onClick={() => setDeleteTarget(e)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    {deleteTarget && (
      <Modal title="Delete engine type" onClose={() => !deletingId && setDeleteTarget(null)} className="notice-dialog">
        <div className="dialog-content">
          <p className="eyebrow">Remove from catalogue</p>
          <h2>Delete this engine type?</h2>
          <p><strong>{deleteTarget.title}</strong></p>
          <p className="muted">This can’t be undone. If the engine appears on an order, the system will prevent deletion.</p>
          <div className="dialog-actions">
            <LoadingButton className="btn accent" onClick={() => remove(deleteTarget)} loading={deletingId === deleteTarget.id} loadingLabel="Deleting…">
              Delete engine
            </LoadingButton>
            <button type="button" className="btn" disabled={Boolean(deletingId)} onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    )}
    </>
  );
}

function SettingsAdmin({ settings, onSaved, onError }) {
  const [form, setForm] = useState(settings);
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/admin/settings", { method: "PATCH", body: form });
      onSaved("Settings updated across the site and bot.");
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel settings-form" onSubmit={save}>
      <div className="section-head" style={{ marginBottom: "1.5rem" }}>
        <div><p className="eyebrow">Identity</p><h2 style={{ fontSize: "1.8rem" }}>Brand & contact</h2></div>
        <span className="meta">Drives header, footer, bot and invoices</span>
      </div>
      <div className="editor-grid">
        <label>Company name<input value={form.company_name || ""} onChange={set("company_name")} /></label>
        <label>Tagline<input value={form.tagline || ""} onChange={set("tagline")} /></label>
        <label>Phone<input value={form.phone || ""} onChange={set("phone")} /></label>
        <label>WhatsApp number<input value={form.whatsapp || ""} onChange={set("whatsapp")} placeholder="263771234567" /></label>
        <label>Email<input type="email" value={form.email || ""} onChange={set("email")} /></label>
        <label>Address<input value={form.address || ""} onChange={set("address")} /></label>
        <label>Office hours<input value={form.office_hours || ""} onChange={set("office_hours")} /></label>
        <label>Registration number<input value={form.registration_number || ""} onChange={set("registration_number")} /></label>
        <label>Established year<input type="number" value={form.established_year ?? ""} onChange={set("established_year")} /></label>
        <label>Orders fulfilled<input type="number" value={form.orders_fulfilled ?? ""} onChange={set("orders_fulfilled")} /></label>
        <label>Paynow note<input value={form.paynow_note || ""} onChange={set("paynow_note")} /></label>
      </div>
      <div className="editor-grid" style={{ marginTop: "0.9rem" }}>
        <label>Warranty summary<input value={form.warranty_summary || ""} onChange={set("warranty_summary")} /></label>
        <label>Inspection process<input value={form.inspection_process || ""} onChange={set("inspection_process")} /></label>
      </div>
      <label style={{ display: "grid", gap: "0.4rem", marginTop: "0.9rem", fontFamily: "var(--font-display)", fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-3)" }}>
        Bank transfer instructions
        <textarea rows="3" value={form.bank_details || ""} onChange={set("bank_details")} style={{ fontFamily: "var(--font-body)", fontSize: "0.94rem", letterSpacing: "normal", textTransform: "none", color: "var(--ink)" }} />
      </label>

      <div className="section-head" style={{ marginTop: "2.5rem", marginBottom: "1.5rem" }}>
        <div><p className="eyebrow">Costing</p><h2 style={{ fontSize: "1.8rem" }}>Money defaults</h2></div>
        <span className="meta">Decimals: 0.20 = 20%</span>
      </div>
      <div className="editor-grid">
        <label>Duty rate<input type="number" step="0.0001" value={form.duty_rate ?? ""} onChange={set("duty_rate")} /></label>
        <label>VAT rate<input type="number" step="0.0001" value={form.vat_rate ?? ""} onChange={set("vat_rate")} /></label>
        <label>Surtax rate<input type="number" step="0.0001" value={form.surtax_rate ?? ""} onChange={set("surtax_rate")} /></label>
        <label>Minimum freight (USD)<input type="number" step="0.01" value={form.default_freight_min ?? ""} onChange={set("default_freight_min")} /></label>
        <label>Freight % of goods<input type="number" step="0.0001" value={form.default_freight_pct ?? ""} onChange={set("default_freight_pct")} /></label>
        <label>Insurance %<input type="number" step="0.0001" value={form.insurance_pct ?? ""} onChange={set("insurance_pct")} /></label>
        <label>Clearing (USD)<input type="number" step="0.01" value={form.default_clearing ?? ""} onChange={set("default_clearing")} /></label>
        <label>Inland delivery (USD)<input type="number" step="0.01" value={form.default_inland ?? ""} onChange={set("default_inland")} /></label>
        <label>Deposit %<input type="number" step="0.01" value={form.default_deposit_pct ?? ""} onChange={set("default_deposit_pct")} /></label>
      </div>
      <LoadingButton className="btn primary" style={{ marginTop: "1.5rem" }} loading={busy} loadingLabel="Saving settings…">
        Save settings
      </LoadingButton>
    </form>
  );
}

function OrderPanel({ order, onDone, onError }) {
  const [form, setForm] = useState({
    freight: order.breakdown.freight,
    insurance: order.breakdown.insurance,
    clearing: order.breakdown.clearing,
    inland: order.breakdown.inland,
    duty_rate: order.breakdown.duty_rate,
    vat_rate: order.breakdown.vat_rate,
    surtax_rate: order.breakdown.surtax_rate,
    deposit_pct: order.deposit_pct,
    note: "",
    items: order.items.map((i) => ({
      id: i.id,
      unit_price_usd: i.unit_price_usd,
      supplier: i.supplier || "",
      supplier_ref: i.supplier_ref || "",
      lot_number: i.lot_number || "",
      serial_number: i.serial_number || "",
    })),
  });
  const [status, setStatus] = useState(order.status);
  const [note, setNote] = useState("");
  const [busyAction, setBusyAction] = useState("");

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setItem = (id, key, value) =>
    setForm((f) => ({ ...f, items: f.items.map((i) => (i.id === id ? { ...i, [key]: value } : i)) }));

  async function saveQuote(e) {
    e.preventDefault();
    setBusyAction("quote");
    try {
      const res = await api(`/admin/orders/${order.reference}/quote`, { method: "PATCH", body: form });
      onDone(`Quote issued for ${order.reference}.`, res.order);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusyAction("");
    }
  }

  async function saveStatus(e) {
    e.preventDefault();
    setBusyAction("status");
    try {
      const res = await api(`/admin/orders/${order.reference}/status`, {
        method: "PATCH",
        body: { status, note },
      });
      onDone(`Status updated to ${res.order.status_label}.`, res.order);
    } catch (err) {
      onError(err.message);
    } finally {
      setBusyAction("");
    }
  }

  return (
    <div className="panel">
      <div className="section-head" style={{ marginBottom: "1.5rem" }}>
        <div>
          <p className="eyebrow">Manage request</p>
          <h2 style={{ fontSize: "1.8rem" }} className="mono">{order.reference}</h2>
          <p className="muted small" style={{ margin: 0 }}>{order.customer?.name} · {order.customer?.email} · {order.customer?.phone}</p>
        </div>
        <span className={`status ${order.status}`}>{order.status_label}</span>
      </div>
      <div className="panel-grid">
        <form className="stack-form" onSubmit={saveQuote}>
          <h3>Proforma quote</h3>
          {form.items.map((item) => {
            const data = order.items.find((i) => i.id === item.id);
            return (
              <div key={item.id} style={{ borderTop: "1px solid var(--hair)", paddingTop: "0.8rem" }}>
                <strong className="small">{data.title}</strong>
                <div className="editor-grid" style={{ marginTop: "0.5rem" }}>
                  <label>Unit price (USD)<input type="number" min="0.01" step="0.01" value={item.unit_price_usd} onChange={(e) => setItem(item.id, "unit_price_usd", e.target.value)} /></label>
                  <label>Supplier<input value={item.supplier} onChange={(e) => setItem(item.id, "supplier", e.target.value)} /></label>
                  <label>Supplier ref<input value={item.supplier_ref} onChange={(e) => setItem(item.id, "supplier_ref", e.target.value)} /></label>
                  <label>Lot number<input value={item.lot_number} onChange={(e) => setItem(item.id, "lot_number", e.target.value)} /></label>
                  <label>Serial number<input value={item.serial_number} onChange={(e) => setItem(item.id, "serial_number", e.target.value)} /></label>
                </div>
              </div>
            );
          })}
          <div className="two-col">
            <label>Freight<input type="number" step="0.01" value={form.freight} onChange={set("freight")} /></label>
            <label>Insurance<input type="number" step="0.01" value={form.insurance} onChange={set("insurance")} /></label>
            <label>Clearing<input type="number" step="0.01" value={form.clearing} onChange={set("clearing")} /></label>
            <label>Inland<input type="number" step="0.01" value={form.inland} onChange={set("inland")} /></label>
            <label>Duty rate<input type="number" step="0.0001" value={form.duty_rate} onChange={set("duty_rate")} /></label>
            <label>VAT rate<input type="number" step="0.0001" value={form.vat_rate} onChange={set("vat_rate")} /></label>
            <label>Surtax rate<input type="number" step="0.0001" value={form.surtax_rate} onChange={set("surtax_rate")} /></label>
            <label>Deposit %<input type="number" step="0.01" value={form.deposit_pct} onChange={set("deposit_pct")} /></label>
          </div>
          <label>Note to customer<input value={form.note} onChange={set("note")} placeholder="e.g. unit located and compression tested" /></label>
          <LoadingButton className="btn primary" loading={busyAction === "quote"} disabled={Boolean(busyAction)} loadingLabel="Issuing quote…">
            Issue quote
          </LoadingButton>
        </form>

        <form className="stack-form" onSubmit={saveStatus}>
          <h3>Advance status</h3>
          <label>
            New status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_FLOW.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </select>
          </label>
          <label>
            Update for customer
            <textarea rows="3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. loaded on vessel, ETA 12 Nov" />
          </label>
          <LoadingButton className="btn" loading={busyAction === "status"} disabled={Boolean(busyAction)} loadingLabel="Updating status…">
            Update &amp; notify
          </LoadingButton>

          <h3 style={{ marginTop: "1rem" }}>Totals</h3>
          <p className="mono">Total {money(order.breakdown.total)}</p>
          <p className="mono small">Deposit {money(order.breakdown.deposit_due)}</p>
          <p className="mono small">Paid {money(order.breakdown.paid_total)} · Balance {money(order.breakdown.balance_due)}</p>
          <Link className="textlink" to={`/orders/${order.reference}`}>Customer view</Link>
        </form>
      </div>
    </div>
  );
}

function PaymentsPanel({ onDone, onError }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingPayment, setWorkingPayment] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api("/admin/orders");
      setOrders(res.orders.filter((o) => o.payments.length > 0));
    } catch (err) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(paymentId, confirm) {
    setWorkingPayment({ id: paymentId, confirm });
    try {
      await api(`/admin/payments/${paymentId}/confirm`, { method: "POST", body: { confirm } });
      onDone(confirm ? "Payment confirmed." : "Payment rejected.");
      await load();
    } catch (err) {
      onError(err.message);
    } finally {
      setWorkingPayment(null);
    }
  }

  return (
    <>
    {loading ? <LoadingState compact label="Loading payments…" /> : <div className="table-wrap">
      <table>
        <thead><tr><th>Order</th><th>Customer</th><th>Method</th><th>Amount</th><th>Status</th><th>Proof</th><th /></tr></thead>
        <tbody>
          {orders.flatMap((o) =>
            o.payments.map((p) => (
              <tr key={p.id}>
                <td><Link className="link-btn" to={`/orders/${o.reference}`}>{o.reference}</Link></td>
                <td>{o.customer?.name}</td>
                <td className="small">{p.method_label}</td>
                <td className="mono">{money(p.amount_usd)}</td>
                <td><span className={`status ${p.status}`}>{p.status.replace(/_/g, " ")}</span></td>
                <td>
                  {p.has_proof ? (
                    <a className="link-btn" href={`/api/orders/${o.reference}/payments/${p.id}/proof`}>Download</a>
                  ) : "—"}
                </td>
                <td className="nowrap">
                  {p.status !== "confirmed" && (
                    <>
                      <LoadingButton className="btn primary small" loading={workingPayment?.id === p.id && workingPayment.confirm} disabled={Boolean(workingPayment)} onClick={() => act(p.id, true)} loadingLabel="Confirming…">Confirm</LoadingButton>
                      <LoadingButton className="btn small" loading={workingPayment?.id === p.id && !workingPayment.confirm} disabled={Boolean(workingPayment)} onClick={() => act(p.id, false)} loadingLabel="Rejecting…">Reject</LoadingButton>
                    </>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>}
    </>
  );
}
