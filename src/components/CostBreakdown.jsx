import { money } from "../lib/api";

const ROWS = [
  ["goods_total", "Supplier price"],
  ["freight", "Sea freight"],
  ["insurance", "Marine insurance"],
  ["duty", "ZIMRA duty"],
  ["vat", "ZIMRA VAT"],
  ["surtax", "Surtax"],
  ["clearing", "Clearing agent"],
  ["inland", "Inland delivery"],
];

export default function CostBreakdown({ breakdown, title = "Landed cost" }) {
  if (!breakdown) return null;
  return (
    <div className="breakdown">
      <div className="breakdown-title">
        <span>{title}</span>
        <span className="mono">USD</span>
      </div>
      <dl>
        {ROWS.map(([key, label]) => {
          const value = breakdown[key];
          if (!value) return null;
          const rate =
            key === "duty"
              ? breakdown.duty_rate
              : key === "vat"
              ? breakdown.vat_rate
              : key === "surtax"
              ? breakdown.surtax_rate
              : null;
          return (
            <div className="row" key={key}>
              <dt>
                {label}
                {rate ? <small> {Math.round(rate * 100)}%</small> : null}
              </dt>
              <dd>{money(value)}</dd>
            </div>
          );
        })}
        <div className="row total">
          <dt>Landed total</dt>
          <dd>{money(breakdown.total)}</dd>
        </div>
        {breakdown.deposit_due !== undefined && (
          <>
            <div className="row">
              <dt>Deposit to reserve</dt>
              <dd>{money(breakdown.deposit_due)}</dd>
            </div>
            {breakdown.paid_total > 0 && (
              <>
                <div className="row">
                  <dt>Paid</dt>
                  <dd>{money(breakdown.paid_total)}</dd>
                </div>
                <div className="row">
                  <dt>Balance</dt>
                  <dd>{money(breakdown.balance_due)}</dd>
                </div>
              </>
            )}
          </>
        )}
      </dl>
      <p className="fineprint">
        Rated on current ZIMRA duty/VAT and indicative freight. Your proforma invoice is the
        binding figure.
      </p>
    </div>
  );
}
