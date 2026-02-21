import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type CafeConfig = {
    id: string
    name: string
    cafeId: string
    apiKey: string
}

type CafeState = {
    cafes: CafeConfig[]
    selectedCafeId: string | null
}

type CafeAction = {
    addCafe: (cafe: Omit<CafeConfig, 'id'>) => void
    updateCafe: (id: string, cafe: Partial<Omit<CafeConfig, 'id'>>) => void
    removeCafe: (id: string) => void
    selectCafe: (id: string | null) => void
}

export const useCafeStore = create<CafeState & CafeAction>()(
    persist(
        (set) => ({
            cafes: [],
            selectedCafeId: null,
            addCafe: (cafe) =>
                set((state) => {
                    const id = crypto.randomUUID()
                    const newCafes = [...state.cafes, { ...cafe, id }]
                    return {
                        cafes: newCafes,
                        selectedCafeId:
                            state.selectedCafeId ?? id,
                    }
                }),
            updateCafe: (id, cafe) =>
                set((state) => ({
                    cafes: state.cafes.map((c) =>
                        c.id === id ? { ...c, ...cafe } : c,
                    ),
                })),
            removeCafe: (id) =>
                set((state) => {
                    const newCafes = state.cafes.filter((c) => c.id !== id)
                    const selectedCafeId =
                        state.selectedCafeId === id
                            ? (newCafes[0]?.id ?? null)
                            : state.selectedCafeId
                    return { cafes: newCafes, selectedCafeId }
                }),
            selectCafe: (id) => set(() => ({ selectedCafeId: id })),
        }),
        { name: 'cafeConfig' },
    ),
)
