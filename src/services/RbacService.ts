import ApiService from './ApiService'

export async function apiGetUserCafes(userId: string) {
    return ApiService.fetchDataWithAxios<{
        ok: boolean
        cafes: { id: string; name: string; cafeId: string; hasAccess: boolean }[]
    }>({
        url: `/rbac/users/${userId}/cafes`,
        method: 'get',
    })
}

export async function apiSetUserCafes(userId: string, cafeIds: string[]) {
    return ApiService.fetchDataWithAxios<{ ok: boolean }>({
        url: `/rbac/users/${userId}/cafes`,
        method: 'put',
        data: { cafeIds },
    })
}

export async function apiUpdateUserRole(userId: string, role: string) {
    return ApiService.fetchDataWithAxios<{ ok: boolean }>({
        url: `/rbac/users/${userId}/role`,
        method: 'put',
        data: { role },
    })
}

export async function apiUpdateUserStatus(userId: string, status: string) {
    return ApiService.fetchDataWithAxios<{ ok: boolean }>({
        url: `/rbac/users/${userId}/status`,
        method: 'put',
        data: { status },
    })
}
