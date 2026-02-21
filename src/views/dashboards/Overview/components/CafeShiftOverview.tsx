import { useState, useEffect, useCallback } from 'react'
import { Tabs } from '@/components/ui'
import {
    TbCurrencyDollar,
    TbArrowUpCircle,
    TbShoppingCart,
    TbBuildingStore,
    TbReceiptRefund,
    TbCalendarOff,
    TbChevronLeft,
    TbChevronRight,
} from 'react-icons/tb'
import ShiftStatCard from './ShiftStatCard'
import StaffBreakdownTable from './StaffBreakdownTable'
import { apiGetShiftStats, apiGetShiftBreakdown } from '@/services/ReportsService'
import {
    getDateRange,
    getBusinessDayRange,
    getTodayBusinessDateStr,
    PERIOD_OPTIONS,
} from '../utils/periodUtils'
import type { PeriodType, ShiftStats, ShiftBreakdownRow } from '../icafeTypes'
import type { Cafe } from '@/@types/cafe'

type Props = {
    cafe: Cafe
    showTitle?: boolean
}

const EMPTY_STATS: ShiftStats = {
    total_profit: 0,
    top_ups: 0,
    shop_sales: 0,
    center_expenses: 0,
    refunds: 0,
    shift_count: 0,
}

function formatCurrency(val: number): string {
    return val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

const CafeShiftOverview = ({ cafe, showTitle = true }: Props) => {
    const [period, setPeriod] = useState<PeriodType>('daily')
    const [selectedDate, setSelectedDate] = useState<string>(getTodayBusinessDateStr())
    const [stats, setStats] = useState<ShiftStats>(EMPTY_STATS)
    const [breakdown, setBreakdown] = useState<ShiftBreakdownRow[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [noShifts, setNoShifts] = useState(false)

    const fetchStats = useCallback(async () => {
        if (!cafe.cafeId || !cafe.apiKey) {
            setError('Cafe ID or API key not configured.')
            return
        }
        setLoading(true)
        setError(null)
        setNoShifts(false)
        try {
            const range = period === 'daily'
                ? getBusinessDayRange(selectedDate)
                : getDateRange(period)

            const [result, rows] = await Promise.all([
                apiGetShiftStats(cafe.id, {
                    date_start: range.date_start,
                    date_end:   range.date_end,
                    time_start: range.time_start,
                    time_end:   range.time_end,
                }),
                apiGetShiftBreakdown(cafe.id, {
                    date_start: range.date_start,
                    date_end:   range.date_end,
                    time_start: range.time_start,
                    time_end:   range.time_end,
                }),
            ])

            if (result.shift_count === 0) {
                setNoShifts(true)
                setStats(EMPTY_STATS)
                setBreakdown([])
            } else {
                setStats(result)
                setBreakdown(rows)
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to load shift data.'
            setError(msg)
            setStats(EMPTY_STATS)
            setBreakdown([])
        } finally {
            setLoading(false)
        }
    }, [cafe.id, cafe.cafeId, cafe.apiKey, period, selectedDate])

    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    const todayStr = getTodayBusinessDateStr()
    const isToday = selectedDate === todayStr

    const range = period === 'daily'
        ? getBusinessDayRange(selectedDate)
        : getDateRange(period)

    return (
        <div className="flex flex-col gap-3">
            {showTitle && (
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <h6 className="font-semibold text-gray-700 dark:text-gray-200">{cafe.name}</h6>
                    <div className="flex items-center gap-2">
                        {!loading && stats.shift_count > 0 && (
                            <span className="text-xs text-gray-400">
                                {stats.shift_count} shift{stats.shift_count !== 1 ? 's' : ''}
                            </span>
                        )}
                        <span className="text-xs text-gray-400 hidden sm:inline">
                            {range.date_start === range.date_end
                                ? range.date_start
                                : `${range.date_start} – ${range.date_end}`}
                        </span>
                    </div>
                </div>
            )}

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

            {error && (
                <p className="text-xs text-red-500 mt-1">{error}</p>
            )}

            {/* No shifts empty state */}
            {!loading && !error && noShifts && (
                <div className="flex items-center gap-2 py-3 px-4 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-400 text-sm">
                    <TbCalendarOff className="text-lg flex-shrink-0" />
                    <span>No shifts recorded for this period.</span>
                </div>
            )}

            {/* Stat cards grid — 3 cols on medium, 5 on large wide screens */}
            <div className="grid grid-cols-3 xl:grid-cols-5 gap-2">
                <ShiftStatCard
                    label="Total Profit"
                    value={formatCurrency(stats.total_profit)}
                    prefix="₱"
                    icon={<TbCurrencyDollar />}
                    iconBg="bg-emerald-100 text-emerald-600"
                    loading={loading}
                    size="sm"
                />
                <ShiftStatCard
                    label="Top-ups"
                    value={formatCurrency(stats.top_ups)}
                    prefix="₱"
                    icon={<TbArrowUpCircle />}
                    iconBg="bg-blue-100 text-blue-600"
                    loading={loading}
                    size="sm"
                />
                <ShiftStatCard
                    label="Shop Sales"
                    value={formatCurrency(stats.shop_sales)}
                    prefix="₱"
                    icon={<TbShoppingCart />}
                    iconBg="bg-violet-100 text-violet-600"
                    loading={loading}
                    size="sm"
                />
                <ShiftStatCard
                    label="Refunds"
                    value={formatCurrency(stats.refunds)}
                    prefix="₱"
                    icon={<TbReceiptRefund />}
                    iconBg="bg-red-100 text-red-500"
                    loading={loading}
                    size="sm"
                />
                <ShiftStatCard
                    label="Center Expenses"
                    value={formatCurrency(stats.center_expenses)}
                    prefix="₱"
                    icon={<TbBuildingStore />}
                    iconBg="bg-orange-100 text-orange-600"
                    loading={loading}
                    size="sm"
                />
            </div>

            {/* Per-staff breakdown table */}
            <StaffBreakdownTable rows={breakdown} loading={loading} />
        </div>
    )
}

export default CafeShiftOverview
