/**
 * Axios factory for the iCafe Cloud REST API.
 *
 * `createIcafeAxios(config)` — creates a new Axios instance scoped to the
 * given café credentials.  Use this when managing multiple cafes.
 *
 * The default export is a pre-built instance using the single-café env vars
 * (VITE_ICAFE_API_KEY / VITE_ICAFE_API_URL) for backwards compatibility.
 */
import axios from 'axios'
import icafeConfig, { ICAFE_API_URL } from '@/configs/icafe.config'
import type { IcafeCafeConfig } from '@/@types/icafe'
import type { AxiosError, AxiosInstance } from 'axios'

/**
 * Creates a fully configured Axios instance for one iCafe Cloud café.
 * The Bearer token for that café is injected on every request automatically.
 */
export function createIcafeAxios(cafeConfig: IcafeCafeConfig): AxiosInstance {
    const instance = axios.create({
        baseURL: cafeConfig.apiUrl || ICAFE_API_URL,
        timeout: 60000,
        headers: {
            'Content-Type': 'application/json',
        },
    })

    instance.interceptors.request.use((config) => {
        if (cafeConfig.apiKey) {
            config.headers['Authorization'] = `Bearer ${cafeConfig.apiKey}`
        }
        return config
    })

    instance.interceptors.response.use(
        (response) => response,
        (error: AxiosError) => Promise.reject(error),
    )

    return instance
}

/**
 * Default Axios instance — uses the single-café VITE_ICAFE_* env vars.
 * Kept for backwards compatibility with the existing named service exports.
 */
const IcafeAxios = createIcafeAxios(icafeConfig)

export default IcafeAxios
