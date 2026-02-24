import axios from 'axios'
import { useCafeStore } from '@/store/cafeStore'
import appConfig from '@/configs/app.config'
import type {
    ReportChartResponse,
    ReportChartParams,
    ReportDataParams,
    IcafeApiResponse,
    ShiftListResponse,
    ShiftDetailResponse,
    ShiftListParams,
    ShiftStats,
    ShiftBreakdownRow,
    TopProductItem,
    IcafeProduct,
    IcafeProductsResponse,
    CustomerAnalysisResponse,
    PcStatusResponse,
} from '@/views/dashboards/Overview/icafeTypes'

const icafeAxios = axios.create({
    baseURL: appConfig.reportsApiPrefix,
    timeout: 60000, // 60s for slow connections
})

function getCafeById(cafeId: string) {
    const cafe = useCafeStore.getState().cafes.find((c) => c.id === cafeId)
    if (!cafe) throw new Error(`Cafe with id "${cafeId}" not found in store.`)
    return cafe
}

/** Decode common HTML entities returned by the iCafeCloud API */
function decodeHtmlEntities(str: string): string {
    return str
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
}

// ─── Report Chart ─────────────────────────────────────────────────────────────

export async function apiGetReportChart(
    cafeId: string,
    params: ReportChartParams,
): Promise<ReportChartResponse> {
    const cafe = getCafeById(cafeId)
    const response = await icafeAxios.get<ReportChartResponse>(
        `/cafe/${cafe.cafeId}/reports/reportChart`,
        {
            params,
            headers: { Authorization: `Bearer ${cafe.apiKey}` },
        },
    )
    return response.data
}

export async function apiGetReportData<T = unknown>(
    cafeId: string,
    params: ReportDataParams,
): Promise<IcafeApiResponse<T>> {
    const cafe = getCafeById(cafeId)
    const response = await icafeAxios.get<IcafeApiResponse<T>>(
        `/cafe/${cafe.cafeId}/reports/reportData`,
        {
            params,
            headers: { Authorization: `Bearer ${cafe.apiKey}` },
        },
    )
    return response.data
}

// ─── Customer Analysis ────────────────────────────────────────────────────────

export async function apiGetCustomerAnalysis(
    cafeId: string,
    params: { date_start: string; date_end: string },
): Promise<CustomerAnalysisResponse> {
    const cafe = getCafeById(cafeId)
    const response = await icafeAxios.get<CustomerAnalysisResponse>(
        `/cafe/${cafe.cafeId}/reports/customerAnalysis`,
        {
            params,
            headers: { Authorization: `Bearer ${cafe.apiKey}` },
        },
    )
    return response.data
}

// ─── Shift List (raw) ─────────────────────────────────────────────────────────

export async function apiGetShiftList(
    cafeId: string,
    params: ShiftListParams,
): Promise<ShiftListResponse> {
    const cafe = getCafeById(cafeId)
    const response = await icafeAxios.get<ShiftListResponse>(
        `/cafe/${cafe.cafeId}/reports/shiftList`,
        {
            params: {
                date_start:       params.date_start,
                date_end:         params.date_end,
                time_start:       params.time_start ?? '00:00',
                time_end:         params.time_end   ?? '23:59',
                shift_staff_name: params.shift_staff_name ?? 'all',
            },
            headers: { Authorization: `Bearer ${cafe.apiKey}` },
        },
    )
    return response.data
}

// ─── Shift Detail ─────────────────────────────────────────────────────────────

export async function apiGetShiftDetail(
    cafeId: string,
    shiftId: string,
): Promise<ShiftDetailResponse> {
    const cafe = getCafeById(cafeId)
    const response = await icafeAxios.get<ShiftDetailResponse>(
        `/cafe/${cafe.cafeId}/reports/shiftDetail/${shiftId}`,
        {
            headers: { Authorization: `Bearer ${cafe.apiKey}` },
        },
    )
    return response.data
}

// ─── Business-day shift list ──────────────────────────────────────────────────
// The iCafeCloud shiftList API filters by shift START date/time.
// A business day runs 06:00 on `bizDate` through 05:59 on `bizDate+1`.
// The API always injects the currently-active shift (negative shift_id,
// shift_end_time='-') into every result. We filter client-side by
// shift_start_time date to exclude it.

async function apiGetBusinessDayShiftList(
    cafeId: string,
    bizDate: string,   // YYYY-MM-DD — the business day start date
    nextDate: string,  // YYYY-MM-DD — bizDate + 1
): Promise<ShiftListResponse['data']> {
    // The iCafeCloud API caps single-day queries at ~3 results and always
    // injects the currently-active shift as the first item. This displaces
    // the graveyard shift (earliest start time) when querying nextDate alone.
    //
    // Using a 2-day range (date_start=bizDate, date_end=nextDate) bypasses
    // the 3-result cap and returns all shifts across both days, including
    // the graveyard shift. We then filter client-side:
    //   - Keep shifts that started on bizDate (any time)
    //   - Keep shifts that started on nextDate before 06:00 (graveyard shifts)
    //   - Exclude the injected active shift (started on a future date)
    const resp = await apiGetShiftList(cafeId, {
        date_start: bizDate,
        date_end:   nextDate,
        time_start: '00:00',
        time_end:   '23:59',
    })

    const seen = new Set<string | number>()
    const combined: ShiftListResponse['data'] = []

    for (const item of (resp.data ?? [])) {
        const startTime = String(item.shift_start_time ?? '')
        const [startDate, startTimePart = ''] = startTime.split(' ')

        // Keep shifts that started on bizDate (any time)
        if (startDate === bizDate) {
            const id = item.shift_id ?? item.id
            if (!seen.has(id)) { seen.add(id); combined.push(item) }
            continue
        }

        // Keep graveyard shifts that started on nextDate before 06:00
        if (startDate === nextDate && startTimePart < '06:00:00') {
            const id = item.shift_id ?? item.id
            if (!seen.has(id)) { seen.add(id); combined.push(item) }
            continue
        }

        // Exclude everything else (injected active shifts from future dates,
        // or nextDate shifts that started after 06:00)
    }

    return combined
}

// ─── Per-shift Breakdown ─────────────────────────────────────────────────────

export async function apiGetShiftBreakdown(
    cafeId: string,
    params: ShiftListParams,
): Promise<ShiftBreakdownRow[]> {
    let items: ShiftListResponse['data']

    if (
        params.date_start &&
        params.date_end &&
        params.date_start !== params.date_end
    ) {
        const resp = await apiGetShiftList(cafeId, {
            ...params,
            time_start: '00:00',
            time_end:   '23:59',
        })
        items = resp.data ?? []
    } else {
        const bizDate = params.date_start
        const parts   = bizDate.split('-').map(Number)
        const d       = new Date(parts[0], parts[1] - 1, parts[2])
        d.setDate(d.getDate() + 1)
        const nextDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        items = await apiGetBusinessDayShiftList(cafeId, bizDate, nextDate)
    }

    if (!items || items.length === 0) return []

    const details = await Promise.allSettled(
        items.map((s) => apiGetShiftDetail(cafeId, String(s.shift_id ?? s.id))),
    )

    return details.reduce<ShiftBreakdownRow[]>((acc, result, idx) => {
        if (result.status !== 'fulfilled') return acc
        const d = result.value.data
        if (!d) return acc

        const cash         = Number(d.cash) || 0
        const shopSalesArr = Array.isArray(d.shop_sales) ? d.shop_sales : []
        const shopSales    = shopSalesArr.reduce((sum: number, item: { cash?: string | number }) =>
            sum + (parseFloat(String(item.cash ?? 0)) || 0), 0)
        const digitalTopups = (Number(d.qr_topup) || 0) + (Number(d.credit_card) || 0)
        const topUps        = (cash - shopSales) + digitalTopups
        const refunds       = Number(d.cash_refund)     || 0
        const expenses      = Number(d.center_expenses) || 0
        const totalProfit   = Number(d.total_amount)    || 0
        // Active shifts have a negative shift_id in the shift list.
        // The shift detail API returns the current time as end_time for active
        // shifts (not '-'), so we rely on the shift_id sign to detect them.
        const rawId    = items![idx].shift_id ?? items![idx].id
        const isActive = Number(rawId) < 0

        acc.push({
            shift_id:        rawId,
            staff_name:      d.staff_name  || String(items![idx].shift_staff_name ?? ''),
            start_time:      d.start_time  || '',
            end_time:        isActive ? '-' : (d.end_time || '-'),
            is_active:       isActive,
            top_ups:         topUps,
            shop_sales:      shopSales,
            refunds,
            center_expenses: expenses,
            total_profit:    totalProfit,
            expense_log_details: d.log_details ? String(d.log_details) : undefined,
            refund_reason:       d.reason ? String(d.reason) : undefined,
        })
        return acc
    }, [])
}

// ─── Aggregated Stats ─────────────────────────────────────────────────────────

export async function apiGetShiftStats(
    cafeId: string,
    params: ShiftListParams,
): Promise<ShiftStats> {
    const empty: ShiftStats = {
        total_profit: 0,
        top_ups: 0,
        shop_sales: 0,
        center_expenses: 0,
        refunds: 0,
        shift_count: 0,
    }

    let items: ShiftListResponse['data']

    // If both date_start and date_end are provided and equal, treat as a single
    // business day and use the two-query strategy.
    if (
        params.date_start &&
        params.date_end &&
        params.date_start !== params.date_end
    ) {
        // Multi-day range (weekly/monthly/yearly): use a single broad query
        // without time filters so all shifts in the date range are returned.
        const resp = await apiGetShiftList(cafeId, {
            ...params,
            time_start: '00:00',
            time_end:   '23:59',
        })
        items = resp.data ?? []
    } else {
        // Single business day: use the two-query strategy
        const bizDate  = params.date_start
        // Compute nextDate (bizDate + 1)
        const parts    = bizDate.split('-').map(Number)
        const d        = new Date(parts[0], parts[1] - 1, parts[2])
        d.setDate(d.getDate() + 1)
        const nextDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

        items = await apiGetBusinessDayShiftList(cafeId, bizDate, nextDate)
    }

    if (items.length === 0) return empty

    // Fetch each shift detail in parallel to get the real financial fields
    const details = await Promise.allSettled(
        items.map((s) => apiGetShiftDetail(cafeId, String(s.shift_id ?? s.id))),
    )

    return details.reduce<ShiftStats>((acc, result) => {
        if (result.status !== 'fulfilled') return acc
        const d = result.value.data
        if (!d) return acc
        // Real API fields (confirmed from live response):
        // Confirmed field mapping from live API response:
        //   total_amount     = net total after refunds and expenses (true profit)
        //   cash             = total cash collected (PC time + F&B combined)
        //   shop_cash_amount = same as cash (total register amount, NOT just F&B)
        //   shop_sales       = array of F&B product sales with individual cash amounts
        //   F&B Sales        = sum of shop_sales[].cash
        //   Top-ups          = cash - F&B Sales (PC gaming time revenue)
        //   qr_topup + credit_card = digital payments (add to top-ups)
        //   center_expenses  = expenses (negative = expense, 0 = none)
        const totalProfit  = Number(d.total_amount) || 0
        const cash         = Number(d.cash)         || 0
        // Sum F&B sales from the shop_sales array
        const shopSalesArr = Array.isArray(d.shop_sales) ? d.shop_sales : []
        const shopSales    = shopSalesArr.reduce((sum: number, item: { cash?: string | number }) => {
            return sum + (parseFloat(String(item.cash ?? 0)) || 0)
        }, 0)
        const digitalTopups = (Number(d.qr_topup) || 0) + (Number(d.credit_card) || 0)
        const topUps       = (cash - shopSales) + digitalTopups
        const expenses     = Number(d.center_expenses) || 0
        const refunds      = Number(d.cash_refund)      || 0
        return {
            total_profit:    acc.total_profit    + totalProfit,
            top_ups:         acc.top_ups         + topUps,
            shop_sales:      acc.shop_sales      + shopSales,
            center_expenses: acc.center_expenses + expenses,
            refunds:         acc.refunds         + refunds,
            shift_count:     acc.shift_count     + 1,
        }
    }, empty)
}

// ─── Products Catalog ─────────────────────────────────────────────────────────

export async function apiGetCafeProducts(
    cafeId: string,
): Promise<IcafeProduct[]> {
    const cafe = getCafeById(cafeId)
    const allProducts: IcafeProduct[] = []
    let page = 1
    let totalPages = 1

    // Fetch all pages of the product catalog
    do {
        const response = await icafeAxios.get<IcafeProductsResponse>(
            `/cafe/${cafe.cafeId}/products`,
            {
                params: { page },
                headers: { Authorization: `Bearer ${cafe.apiKey}` },
            },
        )
        const items = response.data?.data?.items
        if (!items || items.length === 0) break
        allProducts.push(...items)

        const paging = response.data?.data?.paging_info
        totalPages = paging?.pages ?? 1
        page++
    } while (page <= totalPages)

    return allProducts
}

// ─── Top Products ─────────────────────────────────────────────────────────────

export async function apiGetTopProducts(
    cafeId: string,
    params: ShiftListParams,
): Promise<TopProductItem[]> {
    let items: ShiftListResponse['data']

    if (
        params.date_start &&
        params.date_end &&
        params.date_start !== params.date_end
    ) {
        const resp = await apiGetShiftList(cafeId, {
            ...params,
            time_start: '00:00',
            time_end:   '23:59',
        })
        items = resp.data ?? []
    } else {
        const bizDate = params.date_start
        const parts   = bizDate.split('-').map(Number)
        const d       = new Date(parts[0], parts[1] - 1, parts[2])
        d.setDate(d.getDate() + 1)
        const nextDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        items = await apiGetBusinessDayShiftList(cafeId, bizDate, nextDate)
    }

    if (!items || items.length === 0) return []

    // Fetch shift details and product catalog in parallel
    const [detailResults, catalogResult] = await Promise.all([
        Promise.allSettled(
            items.map((s) => apiGetShiftDetail(cafeId, String(s.shift_id ?? s.id))),
        ),
        apiGetCafeProducts(cafeId).catch(() => null),
    ])

    // Build a name→image lookup from the product catalog
    const imageMap = new Map<string, string>()
    if (catalogResult) {
        for (const p of catalogResult) {
            const name = decodeHtmlEntities(String(p.product_name ?? '')).trim().toLowerCase()
            if (name && p.product_image) {
                imageMap.set(name, decodeHtmlEntities(String(p.product_image)))
            }
        }
    }

    const productMap = new Map<string, { total_sold: number; total_cash: number; image?: string }>()

    for (const result of detailResults) {
        if (result.status !== 'fulfilled') continue
        const d = result.value.data
        if (!d) continue

        const shopSalesArr = Array.isArray(d.shop_sales) ? d.shop_sales : []
        for (const item of shopSalesArr) {
            // The API may return the product name under different keys
            const rawItem = item as Record<string, unknown>
            const name = String(
                rawItem.product_name ?? rawItem.name ?? rawItem.product ?? '',
            ).trim()
            if (!name) {
                if (Object.keys(rawItem).length > 0) {
                    console.warn('[TopProducts] shop_sales item has no recognizable name field:', Object.keys(rawItem))
                }
                continue
            }
            const sold = parseFloat(String(rawItem.sold ?? rawItem.quantity ?? rawItem.qty ?? 0)) || 0
            const cash = parseFloat(String(rawItem.cash ?? rawItem.amount ?? rawItem.total ?? 0)) || 0
            const existing = productMap.get(name)
            if (existing) {
                existing.total_sold += sold
                existing.total_cash += cash
            } else {
                const image = imageMap.get(name.toLowerCase())
                productMap.set(name, { total_sold: sold, total_cash: cash, image })
            }
        }
    }

    return Array.from(productMap.entries())
        .map(([product_name, data]) => ({ product_name, ...data }))
        .sort((a, b) => b.total_sold - a.total_sold)
}

// ─── PC Status ────────────────────────────────────────────────────────────────

export async function apiGetCafePcs(
    cafeId: string,
): Promise<PcStatusResponse> {
    const cafe = getCafeById(cafeId)
    const response = await icafeAxios.get<PcStatusResponse>(
        `/cafe/${cafe.cafeId}/pcList`,
        {
            headers: { Authorization: `Bearer ${cafe.apiKey}` },
        },
    )
    return response.data
}
