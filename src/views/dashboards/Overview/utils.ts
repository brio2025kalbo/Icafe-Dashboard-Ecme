/**
 * Helpers for building the iCafe dashboard overview from `apiGetReports`.
 *
 * The reports endpoint returns a `summary` (aggregate totals) and `rows`
 * (one entry per shift).  We call it once per period (+ once for the
 * previous period to compute growth) and aggregate the results here.
 */
import dayjs from 'dayjs'
import type { IcafeReport } from '@/@types/icafe'
import type { IcafePeriod, IcafeStatisticData, PeriodData } from './types'

type ShiftRow = Record<string, unknown>

// ─── Field name resolution ────────────────────────────────────────────────────

/** Read a numeric value from an object trying several key name variants. */
function pick(obj: ShiftRow, ...keys: string[]): number {
    for (const k of keys) {
        const v = obj[k]
        if (typeof v === 'number') return v
        if (typeof v === 'string') {
            const n = Number(v)
            if (!isNaN(n)) return n
        }
    }
    return 0
}

/** Extract total-profit value from a report summary or shift row. */
const profitValue = (obj: ShiftRow) =>
    pick(
        obj,
        'totalRevenue',
        'total_revenue',
        'revenue',
        'totalProfit',
        'total_profit',
        'profit',
        'amount',
        'totalAmount',
    )

/** Extract top-up value from a report summary or shift row. */
const topUpValue = (obj: ShiftRow) =>
    pick(
        obj,
        'topupAmount',
        'topup_amount',
        'topUpAmount',
        'totalTopup',
        'total_topup',
        'topups',
        'topup',
    )

/** Extract F&B-sales value from a report summary or shift row. */
const fbValue = (obj: ShiftRow) =>
    pick(
        obj,
        'fbRevenue',
        'fb_revenue',
        'fbSales',
        'fb_sales',
        'foodRevenue',
        'food_revenue',
        'fnbRevenue',
        'fnb_revenue',
    )

/** Parse a shift/billing date from a row. Returns null if not found. */
function rowDate(row: ShiftRow): dayjs.Dayjs | null {
    for (const k of [
        'date',
        'Date',
        'shift_date',
        'shiftDate',
        'billing_date',
        'billingDate',
        'created_at',
        'createdAt',
    ]) {
        const v = row[k]
        if (typeof v === 'string' || typeof v === 'number') {
            const d = dayjs(v as string | number)
            if (d.isValid()) return d
        }
    }
    return null
}

// ─── Chart builders ───────────────────────────────────────────────────────────

type MetricFn = (row: ShiftRow) => number

/**
 * Build `{ series, date }` chart data from shift rows for the given period.
 * Rows are bucketed by:
 *   daily   → each shift row is one point (x-axis = shift time)
 *   weekly  → 7 daily buckets
 *   monthly → N daily buckets (days in month)
 *   yearly  → 12 monthly buckets
 */
function buildChartData(
    rows: ShiftRow[],
    period: IcafePeriod,
    periodStart: dayjs.Dayjs,
    metricFn: MetricFn,
): PeriodData['chartData'] {
    // Daily: one point per shift row (preserves per-shift granularity)
    if (period === 'daily') {
        if (rows.length === 0) {
            return { series: [{ name: 'Amount', data: [] }], date: [] }
        }
        return {
            series: [
                {
                    name: 'Amount',
                    data: rows.map(metricFn),
                },
            ],
            date: rows.map((r) => {
                const d = rowDate(r)
                if (d) return d.format('HH:00')
                const label = r.shift_name ?? r.shiftName ?? r.shift ?? r.name
                return String(label ?? 'Shift')
            }),
        }
    }

    // Weekly / Monthly / Yearly: bucket rows by time unit
    type Bucket = { label: string; start: dayjs.Dayjs; end: dayjs.Dayjs }
    let buckets: Bucket[]

    if (period === 'weekly') {
        const weekStart = periodStart.startOf('week')
        buckets = Array.from({ length: 7 }, (_, i) => {
            const s = weekStart.add(i, 'day')
            return { label: s.format('ddd'), start: s, end: s.add(1, 'day') }
        })
    } else if (period === 'monthly') {
        const monthStart = periodStart.startOf('month')
        buckets = Array.from({ length: periodStart.daysInMonth() }, (_, i) => {
            const s = monthStart.add(i, 'day')
            return { label: s.format('D'), start: s, end: s.add(1, 'day') }
        })
    } else {
        // yearly
        const yearStart = periodStart.startOf('year')
        buckets = Array.from({ length: 12 }, (_, i) => {
            const s = yearStart.add(i, 'month')
            return { label: s.format('MMM'), start: s, end: s.add(1, 'month') }
        })
    }

    const data = buckets.map(({ start, end }) =>
        rows
            .filter((r) => {
                const d = rowDate(r)
                return d && !d.isBefore(start) && d.isBefore(end)
            })
            .reduce((sum, r) => sum + metricFn(r), 0),
    )

    return {
        series: [{ name: 'Amount', data }],
        date: buckets.map((b) => b.label),
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type ReportPair = {
    current: IcafeReport | null
    previous: IcafeReport | null
}

export type ReportsByPeriod = Record<IcafePeriod, ReportPair>

const COMPARE_LABEL: Record<IcafePeriod, string> = {
    daily: 'from yesterday',
    weekly: 'from last week',
    monthly: 'from last month',
    yearly: 'from last year',
}

/**
 * Convert fetched report pairs (current + previous period) into the
 * `IcafeStatisticData` shape consumed by `components/Overview.tsx`.
 */
export function buildIcafeStats(reports: ReportsByPeriod): IcafeStatisticData {
    const now = dayjs()

    const periodStart: Record<IcafePeriod, dayjs.Dayjs> = {
        daily: now.startOf('day'),
        weekly: now.startOf('week'),
        monthly: now.startOf('month'),
        yearly: now.startOf('year'),
    }

    const periods: IcafePeriod[] = ['daily', 'weekly', 'monthly', 'yearly']

    function buildRecord(
        metricFn: MetricFn,
    ): Record<IcafePeriod, PeriodData> {
        return Object.fromEntries(
            periods.map((p) => {
                const { current, previous } = reports[p]
                const curSummary = (current?.summary ?? {}) as ShiftRow
                const prevSummary = (previous?.summary ?? {}) as ShiftRow
                const rows = (current?.rows ?? []) as ShiftRow[]

                const value = metricFn(curSummary)
                const prevValue = metricFn(prevSummary)
                const growShrink =
                    prevValue === 0
                        ? 0
                        : Math.round(((value - prevValue) / prevValue) * 100)

                return [
                    p,
                    {
                        value,
                        growShrink,
                        comparePeriod: COMPARE_LABEL[p],
                        chartData: buildChartData(
                            rows,
                            p,
                            periodStart[p],
                            metricFn,
                        ),
                    },
                ]
            }),
        ) as Record<IcafePeriod, PeriodData>
    }

    return {
        totalProfit: buildRecord(profitValue),
        topUps: buildRecord(topUpValue),
        fbSales: buildRecord(fbValue),
    }
}

// ─── Date-range helpers ───────────────────────────────────────────────────────

/** Returns the `{ startDate, endDate }` params for the current and previous
 *  windows of each period, formatted as `YYYY-MM-DD`. */
export function getPeriodDateRanges(now = dayjs()) {
    return {
        daily: {
            current: {
                startDate: now.startOf('day').format('YYYY-MM-DD'),
                endDate: now.endOf('day').format('YYYY-MM-DD'),
            },
            previous: {
                startDate: now
                    .subtract(1, 'day')
                    .startOf('day')
                    .format('YYYY-MM-DD'),
                endDate: now
                    .subtract(1, 'day')
                    .endOf('day')
                    .format('YYYY-MM-DD'),
            },
        },
        weekly: {
            current: {
                startDate: now.startOf('week').format('YYYY-MM-DD'),
                endDate: now.endOf('week').format('YYYY-MM-DD'),
            },
            previous: {
                startDate: now
                    .subtract(1, 'week')
                    .startOf('week')
                    .format('YYYY-MM-DD'),
                endDate: now
                    .subtract(1, 'week')
                    .endOf('week')
                    .format('YYYY-MM-DD'),
            },
        },
        monthly: {
            current: {
                startDate: now.startOf('month').format('YYYY-MM-DD'),
                endDate: now.endOf('month').format('YYYY-MM-DD'),
            },
            previous: {
                startDate: now
                    .subtract(1, 'month')
                    .startOf('month')
                    .format('YYYY-MM-DD'),
                endDate: now
                    .subtract(1, 'month')
                    .endOf('month')
                    .format('YYYY-MM-DD'),
            },
        },
        yearly: {
            current: {
                startDate: now.startOf('year').format('YYYY-MM-DD'),
                endDate: now.endOf('year').format('YYYY-MM-DD'),
            },
            previous: {
                startDate: now
                    .subtract(1, 'year')
                    .startOf('year')
                    .format('YYYY-MM-DD'),
                endDate: now
                    .subtract(1, 'year')
                    .endOf('year')
                    .format('YYYY-MM-DD'),
            },
        },
    } as const
}
