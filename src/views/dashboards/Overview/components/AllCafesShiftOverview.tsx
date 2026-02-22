import { useState, useEffect, useCallback, useRef } from 'react'
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
    TbRefresh,
} from 'react-icons/tb'
import ShiftStatCard from './ShiftStatCard'
import { apiGetShiftStats } from '@/services/ReportsService'
import {
    getDateRange,
    getBusinessDayRange,
    getTodayBusinessDateStr,
    PERIOD_OPTIONS,
} from '../utils/periodUtils'
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

const WARN_MINUTES  = 3
const STALE_MINUTES = 10

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
    const [loading, setLoading] = useState(false)
    const [errors, setErrors] = useState<string[]>([])

    // lastDataAt only advances when at least one cafe returns good data
    const [lastDataAt, setLastDataAt] = useState<Date | null>(null)
    const lastDataAtRef = useRef<Date | null>(null)

    const [now, setNow] = useState(new Date())
    const hasLoadedOnce = useRef(false)
    const prevSignal = useRef(refreshSignal)

    useEffect(() => { lastDataAtRef.current = lastDataAt }, [lastDataAt])

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 30_000)
        return () => clearInterval(timer)
    }, [])

    const validCafes = cafes.filter((c) => c.cafeId && c.apiKey)

    const fetchAll = useCallback(async () => {
        if (validCafes.length === 0) {
            setErrors(['No cafes configured. Click ⚙ to add your cafe API keys.'])
            setCombined(EMPTY_STATS)
            return
        }

        if (!hasLoadedOnce.current) setLoading(true)
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
        let anySuccess = false

        const totals = results.reduce<ShiftStats>((acc, res, i) => {
            if (res.status === 'rejected') {
                errs.push(`${validCafes[i].name}: ${res.reason?.message ?? 'Error'}`)
                return acc
            }
            anySuccess = true
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
        hasLoadedOnce.current = true

        // Only advance lastDataAt when at least one cafe succeeded
        if (anySuccess) setLastDataAt(new Date())

        // Toast if any cafe failed
        if (errs.length > 0) {
            const prev = lastDataAtRef.current
            const prevTime = prev
                ? prev.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'unknown'

            toast.push(
                <Notification title="Partial Refresh Failed" type="warning" duration={8000}>
                    <div className="flex flex-col gap-1">
                        <span>{errs.join(' · ')}</span>
                        <span className="text-xs opacity-70">Last good data: {prevTime}</span>
                    </div>
                </Notification>,
                { placement: 'top-end' }
            )
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cafes, period, selectedDate])

    useEffect(() => { fetchAll() }, [fetchAll])

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

    const minutesSinceData = lastDataAt
        ? Math.floor((now.getTime() - lastDataAt.getTime()) / 60_000)
        : 0
    const isWarn      = lastDataAt !== null && minutesSinceData >= WARN_MINUTES
    const isVeryStale = lastDataAt !== null && minutesSinceData >= STALE_MINUTES

    const updatedLabel = lastDataAt
        ? minutesSinceData === 0 ? 'Updated just now' : `Updated ${minutesSinceData}m ago`
        : null

    return (
        <div className="flex flex-col gap-3 relative">

            {isVeryStale && !loading && (
                <div className="absolute inset-0 z-10 bg-white/50 dark:bg-gray-900/50 backdrop-blur-[2px] rounded-2xl flex items-center justify-center">
                    <div className="bg-amber-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
                        <TbAlertTriangle className="text-xl" />
                        <span className="font-bold text-sm uppercase tracking-wider">Stale Data</span>
                        <button
                            onClick={fetchAll}
                            className="ml-2 bg-white/20 hover:bg-white/30 rounded-full p-1 transition-colors"
                            title="Retry"
                        >
                            <TbRefresh className="text-base" />
                        </button>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h5 className="font-bold text-gray-800 dark:text-white">All Cafes — Combined</h5>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-xs text-gray-400">
                            {validCafes.length} cafe{validCafes.length !== 1 ? 's' : ''}
                            {combined.shift_count > 0 && ` · ${combined.shift_count} shift${combined.shift_count !== 1 ? 's' : ''}`}
                            {' · '}
                            {range.date_start === range.date_end
                                ? range.date_start
                                : `${range.date_start} – ${range.date_end}`}
                        </p>
                        {updatedLabel && (
                            <span className={classNames(
                                'text-[10px] font-medium transition-colors flex items-center gap-0.5',
                                isWarn ? 'text-amber-500' : 'text-gray-400'
                            )}>
                                {isWarn && <TbAlertTriangle className="inline" />}
                                {updatedLabel}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <Tabs value={period} onChange={(val) => setPeriod(val as PeriodType)}>
                <Tabs.TabList>
                    {PERIOD_OPTIONS.map((opt) => (
                        <Tabs.TabNav key={opt.value} value={opt.value}>
                            {opt.label}
                        </Tabs.TabNav>
                    ))}
                </Tabs.TabList>
            </Tabs>

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

            {noShifts && (
                <div className="flex items-center gap-2 py-3 px-4 bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-400 text-sm">
                    <TbCalendarOff className="text-lg flex-shrink-0" />
                    <span>No shifts recorded for this period across all cafes.</span>
                </div>
            )}

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
