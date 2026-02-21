import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Cafe } from '@/@types/cafe';

type CafeState = {
    cafes: Cafe[];
    selectedCafeId: string | null;
};

type CafeAction = {
    setCafes: (cafes: Cafe[]) => void;
    setSelectedCafeId: (cafeId: string | null) => void;
};

const initialState: CafeState = {
    cafes: [],
    selectedCafeId: null,
};

export const useCafeStore = create<CafeState & CafeAction>()(
    persist(
        (set) => ({
            ...initialState,
            setCafes: (cafes) => set({ cafes }),
            setSelectedCafeId: (cafeId) => set({ selectedCafeId: cafeId }),
        }),
        { name: 'cafe-storage', storage: createJSONStorage(() => localStorage) },
    ),
);
