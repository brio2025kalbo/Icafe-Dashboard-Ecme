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
    /** Itemised expense entries from the API */
    expense_items?: ExpenseItem[]
    /** Itemised refund entries from the billing logs API */
    refund_items?: RefundItem[]
    /** Refund reason from the API */
    refund_reason?: string
}

export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'yearly'

/** Aggregated top product computed from shop_sales across shifts */
export type TopProductItem = {
    product_name: string
    total_sold: number
    total_cash: number
    image?: string
}

/** Product entry returned by the iCafeCloud products catalog API */
export type IcafeProduct = {
    product_id: number
    product_name: string
    product_image?: string
    has_image: number
    [key: string]: unknown
}

export type IcafeProductsPagingInfo = {
    total_records: number
    pages: number
    page: number
    page_next: number
    [key: string]: unknown
}

export type IcafeProductsData = {
    items: IcafeProduct[]
    paging_info: IcafeProductsPagingInfo
}

export type IcafeProductsResponse = IcafeApiResponse<IcafeProductsData>

// ─── Customer Analysis Types ──────────────────────────────────────────────────

export type IncomeChartItem = {
    value: number
    name: string
}

export type MemberSpendRankingItem = {
    spend_amount: string
    member_account: string
}

export type SessionData = {
    total_session: number
    avg_duration: number
    unique_guests_count: number
}

export type CustomerAnalysisData = {
    income_chart: IncomeChartItem[]
    member_spend_ranking: MemberSpendRankingItem[]
    session?: SessionData
    [key: string]: unknown
}

export type CustomerAnalysisResponse = IcafeApiResponse<CustomerAnalysisData>

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

// ─── Report Data (Game) Types ─────────────────────────────────────────────────

export type GameItem = {
    name: string
    local_times: number
    pool_times: number
}

// ─── Report Data (PC Spend) Types ─────────────────────────────────────────────

export type PcSpendItem = {
    pc_name: string
    total_spend: string
}

// ─── Report Data (Expense) Types ──────────────────────────────────────────────

export type ExpenseItem = {
    log_money: string
    log_details: string
}

// ─── Refund / Billing Log Types ───────────────────────────────────────────────

export type RefundItem = {
    log_money: string
    log_details: string
    log_member_account?: string
    log_staff_name?: string
}

export type BillingLogEntry = {
    log_money: string
    log_details: string
    [key: string]: unknown
}

export type BillingLogPagingInfo = {
    total_records: number
    pages: number
    page: number
    page_next: number
    [key: string]: unknown
}

export type BillingLogData = {
    items: BillingLogEntry[]
    paging_info: BillingLogPagingInfo
}

export type BillingLogResponse = IcafeApiResponse<BillingLogData>

export type ReportDataIncome = {
    expense?: {
        amount: number
        items?: ExpenseItem[]
    }
    [key: string]: unknown
}

export type ReportDataWithGames = {
    game?: GameItem[]
    top_five_pc_spend?: PcSpendItem[]
    income?: ReportDataIncome
    [key: string]: unknown
}

// ─── PC Status Types ──────────────────────────────────────────────────────────

export type PcStatusItem = {
    pc_icafe_id: number
    pc_ip: string
    pc_name: string
    pc_mac: string
    pc_comment: string
    pc_console_type: number
    pc_group_id: number
    pc_area_name: string
    pc_box_position: string
    pc_box_top: number
    pc_box_left: number
    pc_enabled: number
    pc_mining_enabled: number
    pc_mining_tool: string
    pc_mining_options: string
    pc_in_using: number
    /** Member currently using the PC (from pcList endpoint); null when available */
    member_account?: string | null
    member_name?: string
    member_balance?: string | number
    [key: string]: unknown
}

export type PcStatusResponse = IcafeApiResponse<PcStatusItem[]>
