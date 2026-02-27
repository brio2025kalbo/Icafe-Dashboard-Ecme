import ApiService from './ApiService'

export async function apiGetCustomersList<T, U extends Record<string, unknown>>(
    params: U,
) {
    return ApiService.fetchDataWithAxios<T>({
        url: '/api/customers',
        method: 'get',
        params,
    })
}

export async function apiGetCustomer<T, U extends Record<string, unknown>>(
    params: U,
) {
    const { id, ...rest } = params as { id: string } & Record<string, unknown>
    return ApiService.fetchDataWithAxios<T>({
        url: `/api/customers/${id}`,
        method: 'get',
        params: rest,
    })
}

export async function apiGetCustomerLog<T, U extends Record<string, unknown>>(
    params: U,
) {
    return ApiService.fetchDataWithAxios<T>({
        url: '/api/customer/log',
        method: 'get',
        params,
    })
}
