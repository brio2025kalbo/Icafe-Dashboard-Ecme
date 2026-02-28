import axios from 'axios'

const api = axios.create({ baseURL: '/' })

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

export type OpexCategory = {
    id: string
    name: string
    color: string
    created_at: string
}

export type OpexEntry = {
    id: string
    cafe_id: string | null
    category_id: string | null
    amount: number
    description: string
    entry_date: string
    recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
    created_at: string
    updated_at: string
    category_name: string | null
    category_color: string | null
    cafe_name: string | null
}

export type OpexEntryFilters = {
    cafe_id?: string
    date_start?: string
    date_end?: string
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function apiGetOpexCategories(): Promise<OpexCategory[]> {
    const res = await api.get<{ ok: boolean; categories: OpexCategory[] }>('/api/opex/categories')
    return res.data.categories
}

export async function apiCreateOpexCategory(data: { name: string; color: string }): Promise<OpexCategory> {
    const res = await api.post<{ ok: boolean; category: OpexCategory }>('/api/opex/categories', data)
    return res.data.category
}

export async function apiUpdateOpexCategory(id: string, data: { name: string; color: string }): Promise<OpexCategory> {
    const res = await api.put<{ ok: boolean; category: OpexCategory }>(`/api/opex/categories/${id}`, data)
    return res.data.category
}

export async function apiDeleteOpexCategory(id: string): Promise<void> {
    await api.delete(`/api/opex/categories/${id}`)
}

// ── Entries ───────────────────────────────────────────────────────────────────

export async function apiGetOpexEntries(filters?: OpexEntryFilters): Promise<OpexEntry[]> {
    const res = await api.get<{ ok: boolean; entries: OpexEntry[] }>('/api/opex/entries', { params: filters })
    return res.data.entries
}

export async function apiCreateOpexEntry(data: Omit<OpexEntry, 'id' | 'created_at' | 'updated_at' | 'category_name' | 'category_color' | 'cafe_name'>): Promise<OpexEntry> {
    const res = await api.post<{ ok: boolean; entry: OpexEntry }>('/api/opex/entries', data)
    return res.data.entry
}

export async function apiUpdateOpexEntry(id: string, data: Omit<OpexEntry, 'id' | 'created_at' | 'updated_at' | 'category_name' | 'category_color' | 'cafe_name'>): Promise<OpexEntry> {
    const res = await api.put<{ ok: boolean; entry: OpexEntry }>(`/api/opex/entries/${id}`, data)
    return res.data.entry
}

export async function apiDeleteOpexEntry(id: string): Promise<void> {
    await api.delete(`/api/opex/entries/${id}`)
}
