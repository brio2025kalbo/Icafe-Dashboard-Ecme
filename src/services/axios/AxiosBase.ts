import axios from 'axios'
import AxiosResponseIntrceptorErrorCallback from './AxiosResponseIntrceptorErrorCallback'
import AxiosRequestIntrceptorConfigCallback from './AxiosRequestIntrceptorConfigCallback'
import appConfig from '@/configs/app.config'
import type { AxiosError } from 'axios'

// In development the Vite dev server proxies /api/* to VITE_API_URL.
// In a production build there is no proxy, so we use VITE_API_URL directly as
// the base URL and keep the /api prefix from app.config.apiPrefix.
const baseURL =
    import.meta.env.PROD && import.meta.env.VITE_API_URL
        ? `${import.meta.env.VITE_API_URL}${appConfig.apiPrefix}`
        : appConfig.apiPrefix

const AxiosBase = axios.create({
    timeout: 60000,
    baseURL,
})

AxiosBase.interceptors.request.use(
    (config) => {
        return AxiosRequestIntrceptorConfigCallback(config)
    },
    (error) => {
        return Promise.reject(error)
    },
)

AxiosBase.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        AxiosResponseIntrceptorErrorCallback(error)
        return Promise.reject(error)
    },
)

export default AxiosBase
