import { create } from 'zustand'
import type { Cafe } from '@/@types/cafe'

type CafeState = {
    cafes: Cafe[]
    selectedCafeId: string | null
    loading: boolean
    error: string | null
}

type CafeAction = {
    fetchCafes: () => Promise<void>
    addCafe: (cafe: Omit<Cafe, 'id'>) => Promise<Cafe>
    updateCafe: (id: string, cafe: Omit<Cafe, 'id'>) => Promise<void>
    deleteCafe: (id: string) => Promise<void>
    reorderCafes: (ids: string[]) => Promise<void>
    setCafes: (cafes: Cafe[]) => void
    setSelectedCafeId: (cafeId: string | null) => void
}

export const useCafeStore = create<CafeState & CafeAction>()((set) => ({
    cafes: [],
    selectedCafeId: null,
    loading: false,
    error: null,

    fetchCafes: async () => {
        set({ loading: true, error: null })
        try {
            const res = await fetch('/api/cafes')
            const data = await res.json()
            if (!data.ok) throw new Error(data.error || 'Failed to load cafes')
            set({ cafes: data.cafes, loading: false })
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to load cafes'
            set({ error: msg, loading: false })
        }
    },

    addCafe: async (cafe) => {
        const res = await fetch('/api/cafes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cafe),
        })
        const data = await res.json()
        if (!data.ok) throw new Error(data.error || 'Failed to add cafe')
        set((s) => ({ cafes: [...s.cafes, data.cafe] }))
        return data.cafe
    },

    updateCafe: async (id, cafe) => {
        const res = await fetch(`/api/cafes/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cafe),
        })
        const data = await res.json()
        if (!data.ok) throw new Error(data.error || 'Failed to update cafe')
        set((s) => ({ cafes: s.cafes.map((c) => (c.id === id ? data.cafe : c)) }))
    },

    deleteCafe: async (id) => {
        const res = await fetch(`/api/cafes/${id}`, { method: 'DELETE' })
        const data = await res.json()
        if (!data.ok) throw new Error(data.error || 'Failed to delete cafe')
        set((s) => ({ cafes: s.cafes.filter((c) => c.id !== id) }))
    },

    reorderCafes: async (ids) => {
        const res = await fetch('/api/cafes-reorder', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: ids }),
        })
        const data = await res.json()
        if (!data.ok) throw new Error(data.error || 'Failed to reorder cafes')
    },

    setCafes: (cafes) => set({ cafes }),
    setSelectedCafeId: (cafeId) => set({ selectedCafeId: cafeId }),
}))
