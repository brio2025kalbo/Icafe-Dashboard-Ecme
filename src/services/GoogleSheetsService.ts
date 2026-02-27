import ApiService from './ApiService'

// ── Connection Settings ──────────────────────────────────────────────────────
export async function apiGetGSSettings<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/googlesheets/settings',
        method: 'get',
    })
}

export async function apiSaveGSSettings<T>(data: {
    client_id: string
    client_secret: string
    redirect_uri: string
}) {
    return ApiService.fetchDataWithAxios<T>({
        url: '/googlesheets/settings',
        method: 'post',
        data,
    })
}

export async function apiGetGSAuthUrl<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/googlesheets/auth-url',
        method: 'get',
    })
}

export async function apiDisconnectGS<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/googlesheets/disconnect',
        method: 'post',
    })
}

// ── Sheet Configuration ──────────────────────────────────────────────────────
export async function apiGetGSSheetConfig<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/googlesheets/sheet-config',
        method: 'get',
    })
}

export async function apiSaveGSSheetConfig<T>(data: {
    spreadsheet_id: string
    sheet_name: string
}) {
    return ApiService.fetchDataWithAxios<T>({
        url: '/googlesheets/sheet-config',
        method: 'post',
        data,
    })
}

// ── Send Daily Report ────────────────────────────────────────────────────────
export async function apiSendGSReport<T>(data: {
    cafe_id: string
    report_date: string
}) {
    return ApiService.fetchDataWithAxios<T>({
        url: '/googlesheets/send-report',
        method: 'post',
        data,
    })
}

// ── Automated Report Schedule ────────────────────────────────────────────────
export async function apiGetGSSchedule<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/googlesheets/schedule',
        method: 'get',
    })
}

export async function apiSaveGSSchedule<T>(data: {
    schedule_type: string
    schedule_time?: string
}) {
    return ApiService.fetchDataWithAxios<T>({
        url: '/googlesheets/schedule',
        method: 'post',
        data,
    })
}

// ── Send History ─────────────────────────────────────────────────────────────
export async function apiGetGSHistory<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/googlesheets/history',
        method: 'get',
    })
}

// ── Scheduler Logs ───────────────────────────────────────────────────────────
export async function apiGetGSSchedulerLogs<T>() {
    return ApiService.fetchDataWithAxios<T>({
        url: '/googlesheets/scheduler-logs',
        method: 'get',
    })
}
