import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartLine = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
};

export type CartRestaurant = {
  id: string;
  slug: string;
  name: string;
  deliveryFee: number;
  deliveryType?: string | null;
  minOrder: number;
  deliveryMinutes: number;
};

type CartState = {
  restaurant: CartRestaurant | null;
  lines: CartLine[];
};

type CartContextValue = CartState & {
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  meetsMinimum: boolean;
  addItem: (restaurant: CartRestaurant, line: Omit<CartLine, "quantity">, quantity?: number) => void;
  setQuantity: (menuItemId: string, quantity: number) => void;
  removeItem: (menuItemId: string) => void;
  clear: () => void;
};

const STORAGE_KEY = "sofrakapimda.cart.v1";
const EMPTY: CartState = { restaurant: null, lines: [] };

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw) as CartState);
    } catch {
      /* ignore corrupted cart */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const value = useMemo<CartContextValue>(() => {
    const subtotal = state.lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
    const deliveryFee = state.lines.length > 0 ? (state.restaurant?.deliveryFee ?? 0) : 0;
    const minOrder = state.restaurant?.minOrder ?? 0;

    return {
      ...state,
      itemCount: state.lines.reduce((sum, line) => sum + line.quantity, 0),
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
      meetsMinimum: subtotal >= minOrder,
      addItem: (restaurant, line, quantity = 1) =>
        setState((prev) => {
          const sameRestaurant = prev.restaurant?.id === restaurant.id;
          const lines = sameRestaurant ? [...prev.lines] : [];
          const existing = lines.findIndex((item) => item.menuItemId === line.menuItemId);
          if (existing >= 0) {
            lines[existing] = {
              ...lines[existing]!,
              quantity: Math.min(20, lines[existing]!.quantity + quantity),
            };
          } else {
            lines.push({ ...line, quantity: Math.min(20, Math.max(1, quantity)) });
          }
          return { restaurant, lines };
        }),
      setQuantity: (menuItemId, quantity) =>
        setState((prev) => {
          const lines = prev.lines
            .map((line) =>
              line.menuItemId === menuItemId
                ? { ...line, quantity: Math.min(20, Math.max(0, quantity)) }
                : line,
            )
            .filter((line) => line.quantity > 0);
          return lines.length === 0 ? EMPTY : { ...prev, lines };
        }),
      removeItem: (menuItemId) =>
        setState((prev) => {
          const lines = prev.lines.filter((line) => line.menuItemId !== menuItemId);
          return lines.length === 0 ? EMPTY : { ...prev, lines };
        }),
      clear: () => setState(EMPTY),
    };
  }, [state]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart, CartProvider içinde kullanılmalıdır.");
  return context;
}