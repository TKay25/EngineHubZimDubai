import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function Modal({ title, onClose, children, className = "" }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const root = document.getElementById("root");
    const wasInert = root?.inert ?? false;
    document.body.style.overflow = "hidden";
    if (root) root.inert = true;

    const dialog = dialogRef.current;
    const focusTarget = dialog?.querySelector("input, select, textarea") ||
      dialog?.querySelector("button, a");
    focusTarget?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;

      const focusable = [...dialog.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )];
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (root) root.inert = wasInert;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={`modal-dialog ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex="-1"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close dialog">
          ×
        </button>
        {children}
      </section>
    </div>,
    document.body
  );
}
