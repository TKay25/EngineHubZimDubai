export function Spinner({ className = "" }) {
  return <span className={`spinner ${className}`.trim()} aria-hidden="true" />;
}

export function LoadingButton({
  children,
  loading = false,
  loadingLabel = "Working…",
  disabled = false,
  className = "btn",
  ...props
}) {
  return (
    <button
      {...props}
      className={className}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && <Spinner />}
      {loading ? loadingLabel : children}
    </button>
  );
}

export function LoadingState({ label = "Loading", compact = false }) {
  return (
    <div
      className={`loading-state${compact ? " compact" : ""}`}
      role="status"
      aria-live="polite"
    >
      <Spinner />
      <span>{label}</span>
    </div>
  );
}
