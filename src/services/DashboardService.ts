import ApiService from './ApiService'

export async function apiGetEcommerceDashboard<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/dashboard/ecommerce',
        method: 'get',
    })
}

export async function apiGetProjectDashboard<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/dashboard/project',
        method: 'get',
    })
}

export async function apiGetAnalyticDashboard<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/dashboard/analytic',
        method: 'get',
    })
}

export async function apiGetMarketingDashboard<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/dashboard/marketing',
        method: 'get',
    })
}
