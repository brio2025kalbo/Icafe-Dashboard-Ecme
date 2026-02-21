// Types for iCafeCloud Reports API

export type ReportChartSeries = {
    name: string
    data: number[]
}

export type ReportInfo = {
    staff: string
    report_start: string
    report_end: string
}

export type ReportChartData = {
    series: ReportChartSeries[]
    categories: string[]
    report: ReportInfo
}

export type IcafeApiResponse<T> = {
    code: number
    message: string
    data?: T
}

export type ReportChartResponse = IcafeApiResponse<ReportChartData>

// chart_type options: income | topup | sale | product
export type ChartType = 'income' | 'topup' | 'sale' | 'product'

export type ReportChartParams = {
    date_start: string
    date_end: string
    log_staff_name?: string
    member_group_id?: number
    pc_group_id?: number
    chart_type?: ChartType
    data_source?: 'recent' | 'history'
}

// ─── Shift API types ────────────────────────────────────────────────────────

export type ShiftListItem = {
    id: string
    shift_id: string
    staff_name: string
    date_start: string
    date_end: string
    // summary fields sometimes included directly in list
    total_profit?: number
    top_ups?: number
    shop_sales?: number
    center_expenses?: number
    [key: string]: unknown
}

export type ShiftListResponse = IcafeApiResponse<ShiftListItem[]>

export type ShiftDetailData = {
    cafe_name: string
    staff_name: string
    start_time: string
    end_time: string
    working_hours: string
    // Cash collected (PC time + shop)
    cash: number
    // PC/console time revenue
    pc_cash_amount: number
    console_cash_amount: number
    // Shop product sales total
    shop_cash_amount: number
    // Refunds (negative)
    cash_refund: number
    // Opening / closing float
    shift_cash_start: number
    shift_cash_end: number | string
    // Digital payments
    credit_card: number
    qr_topup: number
    // Expenses (can be negative)
    center_expenses: number
    // Net total after refunds and expenses
    total_amount: number
    total_bonus: number
    // shop_sales is an array of product objects
    shop_sales: Array<{ product_name: string; sold: string; cash: string; stock: number }>
    [key: string]: unknown
}

export type ShiftDetailResponse = IcafeApiResponse<ShiftDetailData>

export type ShiftListParams = {
    date_start: string
    date_end: string
    time_start?: string
    time_end?: string
    shift_staff_name?: string
}

/** Aggregated stats computed from one or more shifts */
export type ShiftStats = {
    total_profit: number
    top_ups: number
    shop_sales: number
    center_expenses: number
    refunds: number
    shift_count: number
}

/** Per-shift breakdown row for the staff table */
export type ShiftBreakdownRow = {
    shift_id: string | number
    staff_name: string
    start_time: string
    end_time: string      // '-' if shift is still active
    is_active: boolean
    top_ups: number
    shop_sales: number
    refunds: number
    center_expenses: number
    total_profit: number
}

export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'yearly'

// ─── Report Data Params ───────────────────────────────────────────────────────

export type ReportDataParams = {
    date_start: string
    date_end: string
    time_start: string
    time_end: string
    log_staff_name?: string
    member_group_id?: number
    pc_group_id?: number
    data_source?: 'recent' | 'history'
}
