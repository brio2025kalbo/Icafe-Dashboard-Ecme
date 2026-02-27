import ApiService from './ApiService'

export async function apiGetSettingsProfile<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/setting/profile',
        method: 'get',
    })
}

export async function apiGetSettingsNotification<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/setting/notification',
        method: 'get',
    })
}

export async function apiGetSettingsBilling<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/setting/billing',
        method: 'get',
    })
}

export async function apiGetSettingsIntergration<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/setting/intergration',
        method: 'get',
    })
}

export async function apiGetRolesPermissionsUsers<
    T,
    U extends Record<string, unknown>,
>(params: U) {
    return ApiService.fetchDataWithAxios<T>({
        url: '/rbac/users',
        method: 'get',
        params,
    })
}

export async function apiGetRolesPermissionsRoles<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/rbac/roles',
        method: 'get',
    })
}

export async function apiGetPricingPlans<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/pricing',
        method: 'get',
    })
}

export async function apiGetUsers<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/users',
        method: 'get',
    })
}

export async function apiCreateUser<T>(data: {
    username: string
    email: string
    password: string
    role: string
}) {
    return ApiService.fetchDataWithAxios<T>({
        url: '/users',
        method: 'post',
        data,
    })
}

export async function apiUpdateUser<T>(
    id: string,
    data: { username?: string; role?: string; is_active?: number },
) {
    return ApiService.fetchDataWithAxios<T>({
        url: `/users/${id}`,
        method: 'put',
        data,
    })
}

export async function apiDeleteUser<T>(id: string) {
    return ApiService.fetchDataWithAxios<T>({
        url: `/users/${id}`,
        method: 'delete',
    })
}
