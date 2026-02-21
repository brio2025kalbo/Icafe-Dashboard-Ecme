import AxiosBase from './axios/AxiosBase'
import type { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'

const ApiService = {
    fetchDataWithAxios<Response = unknown, Request = Record<string, unknown>>(
        param: AxiosRequestConfig<Request>,
        customBaseUrl?: string,
        customHeaders?: Record<string, string>,
    ) {
        return new Promise<Response>((resolve, reject) => {
            AxiosBase({
                ...param,
                baseURL: customBaseUrl || param.baseURL,
                headers: {
                    ...param.headers,
                    ...customHeaders,
                },
            })
                .then((response: AxiosResponse<Response>) => {
                    resolve(response.data)
                })
                .catch((errors: AxiosError) => {
                    reject(errors)
                })
        })
    },
}

export default ApiService
