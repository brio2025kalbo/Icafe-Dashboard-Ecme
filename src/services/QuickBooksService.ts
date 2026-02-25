import ApiService from './ApiService'

// ── Connection Settings ──────────────────────────────────────────────────────
export async function apiGetQBSettings<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/quickbooks/settings',
        method: 'get',
    })
}

export async function apiSaveQBSettings<T>(data: {
    qb_client_id: string
    qb_client_secret: string
    qb_redirect_uri: string
    qb_environment: string
}) {
    return ApiService.fetchDataWithAxios<T>({
        url: '/quickbooks/settings',
        method: 'post',
        data,
    })
}

export async function apiGetQBAuthUrl<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/quickbooks/auth-url',
        method: 'get',
    })
}

export async function apiDisconnectQB<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/quickbooks/disconnect',
        method: 'post',
    })
}

// ── Account Mappings ─────────────────────────────────────────────────────────
export async function apiGetQBAccounts<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/quickbooks/accounts',
        method: 'get',
    })
}

export async function apiGetQBMappings<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/quickbooks/mappings',
        method: 'get',
    })
}

export async function apiSaveQBMappings<T>(data: {
    topups_account: string
    shop_sales_account: string
    refunds_account: string
    center_expenses_account: string
}) {
    return ApiService.fetchDataWithAxios<T>({
        url: '/quickbooks/mappings',
        method: 'post',
        data,
    })
}

// ── Send Daily Report ────────────────────────────────────────────────────────
export async function apiSendQBReport<T>(data: {
    cafe_id: string
    report_date: string
}) {
    return ApiService.fetchDataWithAxios<T>({
        url: '/quickbooks/send-report',
        method: 'post',
        data,
    })
}

// ── Automated Report Schedule ────────────────────────────────────────────────
export async function apiGetQBSchedule<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/quickbooks/schedule',
        method: 'get',
    })
}

export async function apiSaveQBSchedule<T>(data: {
    schedule_type: string
    schedule_time?: string
}) {
    return ApiService.fetchDataWithAxios<T>({
        url: '/quickbooks/schedule',
        method: 'post',
        data,
    })
}

// ── Send History ─────────────────────────────────────────────────────────────
export async function apiGetQBHistory<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/quickbooks/history',
        method: 'get',
    })
}
