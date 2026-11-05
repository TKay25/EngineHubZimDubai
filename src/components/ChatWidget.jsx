import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { LoadingButton } from "./Loading";

const GREETING = {
  id: "GREETING",
  text: "Hi — I'm the ZimOsaka assistant. I can show you the engines we source, price one landed in Zimbabwe, or track an order.",
  options: [
    { id: "MENU_BROWSE", label: "Browse engines", primary: true },
    { id: "MENU_QUOTE", label: "Price an engine", primary: true },
    { id: "MENU_TRACK", label: "Track my order" },
  ],
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(() => localStorage.getItem("zimosaka.chat.phone") || "");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([GREETING]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open, busy]);

  async function post(message, label) {
    if (busy) return;
    const number = phone.trim() || "263770000000";
    if (!phone.trim()) localStorage.setItem("zimosaka.chat.phone", "263770000000");
    setMessages((m) => [
      ...m.map((x) => ({ ...x, options: [] })),
      { id: `me-${Date.now()}`, from: "me", text: label ?? message },
    ]);
    setBusy(true);
    setError("");
    try {
      const res = await api("/chat/web", {
        method: "POST",
        body: { phone: number, message },
      });
      const replies = (res.replies || []).map((r, idx) => ({
        id: `bot-${Date.now()}-${idx}`,
        from: "bot",
        ...(typeof r === "string" ? { text: r } : r),
      }));
      setMessages((m) => [...m, ...replies]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    post(text);
  }

  return (
    <>
      <button
        className="chat-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? (
          <span className="close-x">×</span>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.3-.6L3 21l1.7-5a8.4 8.4 0 0 1 1.2-9.6A8.4 8.4 0 0 1 21 11.5Z" />
          </svg>
        )}
      </button>

      {open && (
        <section className="chat-panel" aria-label="ZimOsaka assistant">
          <header className="chat-head">
            <img src="/static/brand/logo.svg" alt="ZimOsaka AutoSpares" />
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <strong>Assistant</strong>
              <span className="online" style={{ justifyContent: "flex-end" }}>Online now</span>
            </div>
          </header>

          <div className="chat-body">
            {messages.map((m) => (
              <div key={m.id}>
                <div className={`bubble ${m.from || "bot"}`}>{m.text}</div>
                {m.options && m.options.length > 0 && (
                  <div className="chat-options">
                    {m.options.map((opt) => (
                      <button
                        key={opt.id}
                        className={`chat-option ${opt.primary ? "primary" : ""}`}
                        onClick={() => post(opt.id, opt.label)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="bubble bot typing">
                <i /><i /><i />
              </div>
            )}
            {error && <div className="bubble error">{error}</div>}
            <div ref={endRef} />
          </div>

          <form className="chat-form" onSubmit={submit}>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Your WhatsApp number (optional)"
              aria-label="WhatsApp number"
            />
            <div className="chat-row">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message or engine code…"
                aria-label="Message"
              />
              <LoadingButton className="btn primary small" loading={busy} disabled={!input.trim()} loadingLabel="Sending…">
                Send
              </LoadingButton>
            </div>
            <span className="chat-hint">Same assistant answers on WhatsApp</span>
          </form>
        </section>
      )}
    </>
  );
}
