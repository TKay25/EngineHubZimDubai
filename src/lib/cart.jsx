import { createContext, useContext, useEffect, useMemo, useState } from "react";

const KEY = "zimosaka.cart.v1";
const CartContext = createContext(null);

function read() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(read);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      count: items.reduce((sum, i) => sum + i.quantity, 0),
      total: items.reduce((sum, i) => sum + i.engine.guide_price_usd * i.quantity, 0),
      add(engine, quantity = 1) {
        setItems((current) => {
          const existing = current.find((i) => i.engine.id === engine.id);
          if (existing) {
            return current.map((i) =>
              i.engine.id === engine.id
                ? { ...i, quantity: Math.min(i.quantity + quantity, 20) }
                : i
            );
          }
          return [...current, { engine, quantity }];
        });
      },
      setQuantity(engineId, quantity) {
        setItems((current) =>
          current
            .map((i) =>
              i.engine.id === engineId
                ? { ...i, quantity: Math.max(0, Math.min(quantity, 20)) }
                : i
            )
            .filter((i) => i.quantity > 0)
        );
      },
      remove(engineId) {
        setItems((current) => current.filter((i) => i.engine.id !== engineId));
      },
      clear() {
        setItems([]);
      },
    }),
    [items]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
