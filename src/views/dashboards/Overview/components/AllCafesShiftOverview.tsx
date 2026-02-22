import { useState, useEffect, useCallback } from 'react'
import { Tabs, Notification, toast } from '@/components/ui'
import {
    TbCurrencyDollar,
    TbArrowUpCircle,
    TbShoppingCart,
    TbBuildingStore,
    TbReceiptRefund,
    TbCalendarOff,
    TbChevronLeft,
    TbChevronRight,
    TbAlertTriangle,
} from 'react-icons/tb'
import ShiftStatCard from './ShiftStatCard'
import { apiGetShiftStats } from '@/services/ReportsService'
import {
    getDateRange,
    getBusinessDayRange,
    getTodayBusinessDateStr,
    PERIOD_OPTIONS,
} from '../utils/periodUtils'
import { useRef } from 'react'
import { useCafeStore } from '@/store/cafeStore'
import type { PeriodType, ShiftStats } from '../icafeTypes'
import classNames from 'classnames'

const EMPTY_STATS: ShiftStats = {
    total_profit: 0,
    top_ups: 0,
    shop_sales: 0,
    center_expenses: 0,
    refunds: 0,
    shift_count: 0,
}

function addDaysToStr(dateStr: string, n: number): string {
    const parts = dateStr.split('-').map(Number)
    const d = new Date(parts[0], parts[1] - 1, parts[2])
    d.setDate(d.getDate() + n)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

type Props = { refreshSignal?: number }

const AllCafesShiftOverview = ({ refreshSignal = 0 }: Props) => {
    const cafes = useCafeStore((s) => s.cafes)
    const [period, setPeriod] = useState<PeriodType>('daily')
    const [selectedDate, setSelectedDate] = useState<string>(getTodayBusinessDateStr())
    const [combined, setCombined] = useState<ShiftStats>(EMPTY_STATS)
    const [loading, setLoading] = useState(false)   // first-load only
    const [refreshing, setRefreshing] = useState(false) // silent background refresh
    const [errors, setErrors] = useState<string[]>([])
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
    const [now, setNow] = useState(new Date())
    const hasLoadedOnce = useRef(false)

    // Update 'now' every minute to refresh the "Updated X ago" text
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000)
        return () => clearInterval(timer)
    }, [])

    const validCafes = cafes.filter((c) => c.cafeId && c.apiKey)

    const fetchAll = useCallback(async () => {
        if (validCafes.length === 0) {
            setErrors(['No cafes configured. Click ⚙ to add your cafe API keys.'])
            setCombined(EMPTY_STATS)
            return
        }

        if (!hasLoadedOnce.current) {
            setLoading(true)
        } else {
            setRefreshing(true)
        }
        setErrors([])

        const range = period === 'daily'
            ? getBusinessDayRange(selectedDate)
            : getDateRange(period)

        const results = await Promise.allSettled(
            validCafes.map((c) =>
                apiGetShiftStats(c.id, {
                    date_start: range.date_start,
                    date_end:   range.date_end,
                    time_start: range.time_start,
                    time_end:   range.time_end,
                }),
            ),
        )

        const errs: string[] = []
        const totals = results.reduce<ShiftStats>((acc, res, i) => {
            if (res.status === 'rejected') {
                errs.push(`${validCafes[i].name}: ${res.reason?.message ?? 'Error'}`)
                return acc
            }
            const s = res.value
            return {
                total_profit:    acc.total_profit + s.total_profit,
                top_ups:         acc.top_ups + s.top_ups,
                shop_sales:      acc.shop_sales + s.shop_sales,
                center_expenses: acc.center_expenses + s.center_expenses,
                refunds:         acc.refunds + s.refunds,
                shift_count:     acc.shift_count + s.shift_count,
            }
        }, { ...EMPTY_STATS })

        setCombined(totals)
        setErrors(errs)
        setLoading(false)
        setRefreshing(false)
        hasLoadedOnce.current = true
        setLastUpdated(new Date())

        // Show toast notification if any cafe failed to refresh
        if (errs.length > 0) {
            toast.push(
                <Notification title="Partial Refresh Failed" type="warning" duration={5000}>
                    {errs.length} cafe{errs.length > 1 ? 's' : ''} failed to refresh. Combined totals may be incomplete.
                </Notification>,
                { placement: 'top-end' }
            )
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cafes, period, selectedDate, lastUpdated]) // eslint-disable-line

    // Initial + period/date change fetch
    useEffect(() => {
        fetchAll()
    }, [fetchAll])

    // Silent background refresh triggered by parent
    const prevSignal = useRef(refreshSignal)
    useEffect(() => {
        if (refreshSignal !== prevSignal.current) {
            prevSignal.current = refreshSignal
            fetchAll()
        }
    }, [refreshSignal, fetchAll])

    const todayStr = getTodayBusinessDateStr()
    const isToday = selectedDate === todayStr
    const range = period === 'daily'
        ? getBusinessDayRange(selectedDate)
        : getDateRange(period)

    const noShifts = !loading && errors.length === 0 && combined.shift_count === 0 && validCafes.length > 0

    // Stale data logic
    const minutesSinceUpdate = lastUpdated ? Math.floor((now.getTime() - lastUpdated.getTime()) / 60000) : 0
    const isStale = minutesSinceUpdate >= 2
    const isVeryStale = minutesSinceUpdate >= 10

    return (
        <div className="flex flex-col gap-3 relative">
            {/* Very Stale Overlay */}
            {isVeryStale && !loading && (
                <div className="absolute inset-0 z-10 bg-white/40 dark:bg-gray-900/40 backdrop-blur-[1px] rounded-2xl flex items-center justify-center pointer-events-none">
                    <div className="bg-amber-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
                        <TbAlertTriangle className="text-xl" />
                        <span className="font-bold text-sm uppercase tracking-wider">Stale Data</span>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h5 className="font-bold text-gray-800 dark:text-white">All Cafes — Combined</h5>
                    <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-gray-400">
                            {validCafes.length} cafe{validCafes.length !== 1 ? 's' : ''}
                            {combined.shift_count > 0 && ` · ${combined.shift_count} shift${combined.shift_count !== 1 ? 's' : ''}`}
                            {' · '}
                            {range.date_start === range.date_end
                                ? range.date_start
                                : `${range.date_start} – ${range.date_end}`}
                        </p>
                        {lastUpdated && (
                            <span className={classNames(
                                "text-[10px] font-medium transition-colors",
                                isStale ? "text-amber-500" : "text-gray-400"
                            )}>
                                {isStale && <TbAlertTriangle className="inline mr-1" />}
                                Updated {minutesSinceUpdate === 0 ? 'just now' : `${minutesSinceUpdate}m ago`}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Period tabs */}
            <Tabs value={period} onChange={(val) => setPeriod(val as PeriodType)}>
                <Tabs.TabList>
                    {PERIOD_OPTIONS.map((opt) => (
                        <Tabs.TabNav key={opt.value} value={opt.value}>
                            {opt.label}
                        </Tabs.TabNav>
                    ))}
                </Tabs.TabList>
            </Tabs>

            {/* Date navigator — only visible on Daily tab */}
            {period === 'daily' && (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSelectedDate(addDaysToStr(selectedDate, -1))}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                        title="Previous business day"
                    >
                        <TbChevronLeft className="text-lg" />
                    </button>
                    <input
                        type="date"
                        value={selectedDate}
                        max={todayStr}
                        onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                        className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                    />
                    <button
                        onClick={() => setSelectedDate(addDaysToStr(selectedDate, 1))}
                        disabled={isToday}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Next business day"
                    >
                        <TbChevronRight className="text-lg" />
                    </button>
                    {!isToday && (
                        <button
                            onClick={() => setSelectedDate(todayStr)}
                            className="text-xs text-blue-500 hover:underline"
                        >
                            Today
                        </button>
                    )}
                </div>
            )}

            {errors.length > 0 && (
                <div className="flex flex-col gap-1">
                    {errors.map((e, i) => (
                        <p key={i} className="text-xs text-red-500">{e}</p>
                    ))}
                </div>
            )}

            {/* No shifts empty state */}
            {noShifts && (
                <div className="flex items-center gap-2 py-3 px-4 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-400 text-sm">
                    <TbCalendarOff className="text-lg flex-shrink-0" />
                    <span>No shifts recorded for this period across all cafes.</span>
                </div>
            )}

            {/* Combined stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <ShiftStatCard
                    label="Total Profit"
                    value={combined.total_profit}
                    prefix="₱"
                    icon={<TbCurrencyDollar />}
                    iconBg="bg-emerald-100 text-emerald-600"
                    loading={loading}
                />
                <ShiftStatCard
                    label="Top-ups"
                    value={combined.top_ups}
                    prefix="₱"
                    icon={<TbArrowUpCircle />}
                    iconBg="bg-blue-100 text-blue-600"
                    loading={loading}
                />
                <ShiftStatCard
                    label="Shop Sales"
                    value={combined.shop_sales}
                    prefix="₱"
                    icon={<TbShoppingCart />}
                    iconBg="bg-violet-100 text-violet-600"
                    loading={loading}
                />
                <ShiftStatCard
                    label="Refunds"
                    value={combined.refunds}
                    prefix="₱"
                    icon={<TbReceiptRefund />}
                    iconBg="bg-red-100 text-red-500"
                    loading={loading}
                />
                <ShiftStatCard
                    label="Center Expenses"
                    value={combined.center_expenses}
                    prefix="₱"
                    icon={<TbBuildingStore />}
                    iconBg="bg-orange-100 text-orange-600"
                    loading={loading}
                />
            </div>
        </div>
    )
}

export default AllCafesShiftOverview
