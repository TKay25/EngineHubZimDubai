const STEPS = [
  ["quote_requested", "Request received", "We check Dubai suppliers and search local garages if a match is not available."],
  ["quoted", "Proforma issued", "Supplier price and full landed cost confirmed."],
  ["deposit_paid", "Deposit received", "Your sourcing slot is secured; per-engine availability is shown above."],
  ["sourcing", "Sourcing in Dubai", "The unit is located, inspected and compression tested."],
  ["purchased", "Purchased", "Bought from the supplier and recorded against your order."],
  ["shipped", "In transit", "Loaded for export with a container reference."],
  ["customs_clearing", "Customs clearing", "ZIMRA duty and VAT settled."],
  ["delivered", "Delivered", "Handed over or delivered to your address."],
];

export default function StatusTimeline({ events = [], current }) {
  const seen = new Map();
  events.forEach((e) => seen.set(e.status, e));

  return (
    <ol className="timeline">
      {STEPS.map(([status, label, fallback], idx) => {
        const event = seen.get(status);
        const currentIdx = STEPS.findIndex((s) => s[0] === current);
        const state = event ? "done" : idx === currentIdx ? "current" : "todo";
        return (
          <li key={status} className={state}>
            <span className="dot">{String(idx + 1).padStart(2, "0")}</span>
            <div>
              <strong>{label}</strong>
              <p>{event?.note || fallback}</p>
              {event && <small>{new Date(event.created_at).toLocaleString("en-GB")}</small>}
            </div>
          </li>
        );
      })}
      {current === "cancelled" && (
        <li className="cancelled">
          <span className="dot">×</span>
          <div>
            <strong>Cancelled</strong>
            <p>This request was cancelled.</p>
          </div>
        </li>
      )}
    </ol>
  );
}
