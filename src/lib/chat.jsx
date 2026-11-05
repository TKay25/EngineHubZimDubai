import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, money } from "../lib/api";
import { useAuth } from "../lib/auth";

export const WELCOME_BUTTONS = [
  { id: "MENU_BROWSE", label: "Browse engine types", primary: true },
  { id: "MENU_QUOTE", label: "Get a quote", primary: true },
  { id: "MENU_TRACK", label: "Track my order" },
];

export function useChat(phone) {
  const [messages, setMessages] = useState([
    {
      id: "greeting",
      from: "bot",
      text:
        "Hi! I'm the ZimOsaka assistant. I can show you the engines we source, quote the landed cost, or track an order.",
      options: WELCOME_BUTTONS,
    },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const post = useCallback(
    async (message, label) => {
      setBusy(true);
      setError("");
      setMessages((m) => [
        ...m.map((x) => ({ ...x, options: [] })),
        { id: `me-${Date.now()}`, from: "me", text: label ?? message },
      ]);
      try {
        const res = await api("/chat/web", {
          method: "POST",
          body: { phone: phone || "263770000000", message },
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
    },
    [phone]
  );

  return { messages, busy, error, post };
}

export { Link };
