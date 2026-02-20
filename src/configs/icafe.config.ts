/**
 * iCafe Cloud API configuration.
 *
 * ── Single-café setup ───────────────────────────────────────────────────────
 * Set VITE_ICAFE_API_KEY and VITE_ICAFE_CAFE_ID in your .env file.
 * Use the default named exports in IcafeService.ts as-is.
 *
 * ── Multi-café setup ────────────────────────────────────────────────────────
 * Set VITE_ICAFE_CAFES to a JSON array of café configs:
 *   VITE_ICAFE_CAFES=[{"cafeId":"123","apiKey":"tok_abc","name":"Branch A"},{"cafeId":"456","apiKey":"tok_xyz","name":"Branch B"}]
 * Then call createIcafeService(cafe) with the desired entry from icafeCafes.
 */
import type { IcafeCafeConfig } from '@/@types/icafe'

/** Shared API base URL (can be overridden per-café via IcafeCafeConfig.apiUrl). */
export const ICAFE_API_URL =
    import.meta.env.VITE_ICAFE_API_URL || 'https://api.icafecloud.com'

/**
 * Default single-café config — populated from the VITE_ICAFE_* env vars.
 * Used by the convenience named exports in IcafeService.ts.
 */
const icafeConfig: IcafeCafeConfig = {
    apiUrl: ICAFE_API_URL,
    apiKey: import.meta.env.VITE_ICAFE_API_KEY || '',
    cafeId: import.meta.env.VITE_ICAFE_CAFE_ID || '',
}

/**
 * Parsed list of all cafes from VITE_ICAFE_CAFES (JSON array).
 * Falls back to a single-element array containing icafeConfig when the
 * variable is not set, so single-café deployments work without changes.
 *
 * Each element is an IcafeCafeConfig object.
 */
export const icafeCafes: IcafeCafeConfig[] = (() => {
    const raw = import.meta.env.VITE_ICAFE_CAFES
    if (!raw) return [icafeConfig]
    try {
        const parsed = JSON.parse(raw) as IcafeCafeConfig[]
        return parsed.map((c) => ({
            apiUrl: c.apiUrl || ICAFE_API_URL,
            apiKey: c.apiKey || '',
            cafeId: c.cafeId || '',
            name: c.name,
        }))
    } catch {
        console.warn('[icafe.config] VITE_ICAFE_CAFES is not valid JSON — falling back to single-café config.')
        return [icafeConfig]
    }
})()

export default icafeConfig
