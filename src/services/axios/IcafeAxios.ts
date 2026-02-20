/**
 * Dedicated Axios instance for the iCafe Cloud REST API.
 *
 * Every request automatically receives:
 *   Authorization: Bearer <VITE_ICAFE_API_KEY>
 *   Content-Type: application/json
 *
 * The base URL points directly at https://api.icafecloud.com so this
 * instance is completely independent from the local app proxy used by
 * AxiosBase (which handles the internal /api/* routes).
 */
import axios from 'axios'
import icafeConfig from '@/configs/icafe.config'
import type { AxiosError } from 'axios'

const IcafeAxios = axios.create({
    baseURL: icafeConfig.apiUrl,
    timeout: 60000,
    headers: {
        'Content-Type': 'application/json',
    },
})

IcafeAxios.interceptors.request.use((config) => {
    if (icafeConfig.apiKey) {
        config.headers['Authorization'] = `Bearer ${icafeConfig.apiKey}`
    }
    return config
})

IcafeAxios.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        return Promise.reject(error)
    },
)

export default IcafeAxios
