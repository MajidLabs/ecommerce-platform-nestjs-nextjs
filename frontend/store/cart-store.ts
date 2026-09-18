'use client';

import { create } from 'zustand';
import { api } from '@/lib/api';
import type { Cart } from '@/lib/types';

interface CartState {
  itemCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  setCount: (n: number) => void;
}

export const useCartStore = create<CartState>((set) => ({
  itemCount: 0,
  loading: false,
  setCount: (n) => set({ itemCount: n }),
  refresh: async () => {
    set({ loading: true });
    try {
      const cart = await api.get<Cart>('/cart');
      const count = cart.items.reduce((sum, item) => sum + item.quantity, 0);
      set({ itemCount: count, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));
