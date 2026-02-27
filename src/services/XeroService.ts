import ApiService from './ApiService'

// ── Connection Settings ──────────────────────────────────────────────────────
export async function apiGetXeroSettings<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/xero/settings',
        method: 'get',
    })
}

export async function apiSaveXeroSettings<T>(data: {
    client_id: string
    client_secret: string
    xero_redirect_uri: string
}) {
    return ApiService.fetchDataWithAxios<T>({
        url: '/xero/settings',
        method: 'post',
        data,
    })
}

export async function apiGetXeroAuthUrl<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/xero/auth-url',
        method: 'get',
    })
}

export async function apiDisconnectXero<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/xero/disconnect',
        method: 'post',
    })
}

// ── Account Mappings ─────────────────────────────────────────────────────────
export async function apiGetXeroAccounts<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/xero/accounts',
        method: 'get',
    })
}

export async function apiGetXeroMappings<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/xero/mappings',
        method: 'get',
    })
}

export async function apiSaveXeroMappings<T>(data: {
    topups_account: string
    shop_sales_account: string
    refunds_account: string
    center_expenses_account: string
    center_expenses_fallback_account: string
    bank_account: string
}) {
    return ApiService.fetchDataWithAxios<T>({
        url: '/xero/mappings',
        method: 'post',
        data,
    })
}

// ── Send Daily Report ────────────────────────────────────────────────────────
export async function apiSendXeroReport<T>(data: {
    cafe_id: string
    report_date: string
    force?: boolean
}) {
    return ApiService.fetchDataWithAxios<T>({
        url: '/xero/send-report',
        method: 'post',
        data,
    })
}

// ── Automated Report Schedule ────────────────────────────────────────────────
export async function apiGetXeroSchedule<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/xero/schedule',
        method: 'get',
    })
}

export async function apiSaveXeroSchedule<T>(data: {
    schedule_type: string
    schedule_time?: string
}) {
    return ApiService.fetchDataWithAxios<T>({
        url: '/xero/schedule',
        method: 'post',
        data,
    })
}

// ── Send History ─────────────────────────────────────────────────────────────
export async function apiGetXeroHistory<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/xero/history',
        method: 'get',
    })
}

// ── Scheduler Logs ───────────────────────────────────────────────────────────
export async function apiGetXeroSchedulerLogs<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/xero/scheduler-logs',
        method: 'get',
    })
}
