import { useState, useEffect, useRef, useCallback } from 'react'
import Card from '@/components/ui/Card'
import Select from '@/components/ui/Select'
import GrowShrinkValue from '@/components/shared/GrowShrinkValue'
import AbbreviateNumber from '@/components/shared/AbbreviateNumber'
import Chart from '@/components/shared/Chart'
import { useThemeStore } from '@/store/themeStore'
import { useCafeStore, ALL_CAFES_VALUE } from '@/store/cafeStore'
import classNames from '@/utils/classNames'
import { COLOR_1, COLOR_2, COLOR_4 } from '@/constants/chart.constant'
import { TbCoin, TbShoppingBagCheck, TbEye, TbReceiptRefund, TbBuildingStore, TbArrowUpCircle, TbShoppingCart, TbChevronLeft, TbChevronRight } from 'react-icons/tb'
import { apiGetShiftStats } from '@/services/ReportsService'
import {
    getDateRange,
    getBusinessDayRange,
    getTodayBusinessDateStr,
} from '../utils/periodUtils'
import PeriodSelector from './PeriodSelector'
import type { ReactNode } from 'react'
import type { StatisticData, Period, EcommercePeriod, StatisticCategory } from '../types'
import useCountUp from '@/hooks/useCountUp'
import type { PeriodType, ShiftStats } from '../icafeTypes'

function addDaysToStr(dateStr: string, n: number): string {
    const parts = dateStr.split('-').map(Number)
    const d = new Date(parts[0], parts[1] - 1, parts[2])
    d.setDate(d.getDate() + n)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

function formatCurrency(val: number): string {
    return val.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })
}

type AnimatedCurrencyProps = {
    value: number
    prefix?: string
}

const AnimatedCurrency = ({ value, prefix = '' }: AnimatedCurrencyProps) => {
    const animated = useCountUp(value)
    return <>{prefix}{formatCurrency(animated)}</>
}

type StatisticCardProps = {
    title: string
    value: number | ReactNode
    icon: ReactNode
    growShrink: number
    iconClass: string
    label: StatisticCategory
    compareFrom: string
    active: boolean
    onClick: (label: StatisticCategory) => void
}

type StatisticGroupsProps = {
    data: StatisticData
    refreshSignal?: number
}

const chartColors: Record<StatisticCategory, string> = {
    totalProfit: COLOR_1,
    totalOrder: COLOR_2,
    totalImpression: COLOR_4,
}

const StatisticCard = (props: StatisticCardProps) => {
    const {
        title,
        value,
        label,
        icon,
        growShrink,
        iconClass,
        active,
        compareFrom,
        onClick,
    } = props

    return (
        <button
            className={classNames(
                'p-4 rounded-2xl cursor-pointer ltr:text-left rtl:text-right transition duration-150 outline-hidden',
                active && 'bg-white dark:bg-gray-900 shadow-md',
            )}
            onClick={() => onClick(label)}
        >
            <div className="flex md:flex-col-reverse gap-2 2xl:flex-row justify-between relative">
                <div>
                    <div className="mb-4 text-sm font-semibold">{title}</div>
                    <h3 className="mb-1">{value}</h3>
                    <div className="inline-flex items-center flex-wrap gap-1">
                        <GrowShrinkValue
                            className="font-bold"
                            value={growShrink}
                            suffix="%"
                            positiveIcon="+"
                            negativeIcon=""
                        />
                        <span>{compareFrom}</span>
                    </div>
                </div>
                <div
                    className={classNames(
                        'flex items-center justify-center min-h-12 min-w-12 max-h-12 max-w-12 text-gray-900 rounded-full text-2xl',
                        iconClass,
                    )}
                >
                    {icon}
                </div>
            </div>
        </button>
    )
}

const EMPTY_STATS: ShiftStats = {
    total_profit: 0,
    top_ups: 0,
    shop_sales: 0,
    center_expenses: 0,
    refunds: 0,
    shift_count: 0,
}

/** Map PeriodType to the nearest ecommerce period (for chart/growShrink fallback) */
function toEcommercePeriod(p: PeriodType): EcommercePeriod {
    if (p === 'daily') return 'thisMonth'
    const map: Record<string, EcommercePeriod> = {
        weekly: 'thisWeek',
        monthly: 'thisMonth',
        yearly: 'thisYear',
    }
    return map[p] ?? 'thisMonth'
}

const Overview = ({ data, refreshSignal = 0 }: StatisticGroupsProps) => {
    const [selectedCategory, setSelectedCategory] =
        useState<StatisticCategory>('totalProfit')

    const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('daily')
    const [selectedDate, setSelectedDate] = useState<string>(getTodayBusinessDateStr())

    useEffect(() => {
        if (selectedPeriod === 'daily') {
            setSelectedDate(getTodayBusinessDateStr())
        }
    }, [selectedPeriod])

    const cafes = useCafeStore((s) => s.cafes)
    const filterCafeId = useCafeStore((s) => s.filterCafeId)
    const setFilterCafeId = useCafeStore((s) => s.setFilterCafeId)
    const [localStats, setLocalStats] = useState<ShiftStats>(EMPTY_STATS)
    const [loading, setLoading] = useState(false)

    const sideNavCollapse = useThemeStore(
        (state) => state.layout.sideNavCollapse,
    )

    const isFirstRender = useRef(true)

    useEffect(() => {
        if (!sideNavCollapse && isFirstRender.current) {
            isFirstRender.current = false
            return
        }

        if (!isFirstRender.current) {
            window.dispatchEvent(new Event('resize'))
        }
    }, [sideNavCollapse])

    const allValidCafes = cafes.filter((c) => c.cafeId && c.apiKey)

    const validCafes = filterCafeId === ALL_CAFES_VALUE
        ? allValidCafes
        : allValidCafes.filter((c) => c.id === filterCafeId)

    const filterOptions = [
        { value: ALL_CAFES_VALUE, label: 'All Cafes' },
        ...allValidCafes.map((c) => ({ value: c.id, label: c.name })),
    ]
    const selectedFilterOption = filterOptions.find((o) => o.value === filterCafeId) ?? filterOptions[0]

    // Reset filter when selected cafe is no longer valid
    useEffect(() => {
        if (filterCafeId !== ALL_CAFES_VALUE && !allValidCafes.some((c) => c.id === filterCafeId)) {
            setFilterCafeId(ALL_CAFES_VALUE)
        }
    }, [allValidCafes, filterCafeId, setFilterCafeId])

    const fetchStats = useCallback(async () => {
        if (validCafes.length === 0) {
            setLocalStats(EMPTY_STATS)
            return
        }

        setLoading(true)

        const range = selectedPeriod === 'daily'
            ? getBusinessDayRange(selectedDate)
            : getDateRange(selectedPeriod)

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

        const totals = results.reduce<ShiftStats>((acc, res) => {
            if (res.status === 'rejected') return acc
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

        setLocalStats(totals)
        setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cafes, selectedPeriod, selectedDate, refreshSignal, filterCafeId])

    useEffect(() => { fetchStats() }, [fetchStats])

    /** Safe ecommerce period for chart/growShrink data */
    const ecomPeriod = toEcommercePeriod(selectedPeriod)

    const todayStr = getTodayBusinessDateStr()
    const isToday = selectedDate === todayStr

    return (
        <Card>
            <div className="flex items-center justify-between">
                <h4>Overview</h4>
                <div className="flex items-center gap-2">
                    <Select
                        className="min-w-[160px]"
                        size="sm"
                        placeholder="Filter cafe"
                        value={selectedFilterOption}
                        options={filterOptions}
                        isSearchable={false}
                        onChange={(option) => {
                            if (option?.value) {
                                setFilterCafeId(option.value)
                            }
                        }}
                    />
                    <PeriodSelector
                        value={selectedPeriod}
                        onChange={(val) => setSelectedPeriod(val)}
                    />
                </div>
            </div>
            {selectedPeriod === 'daily' && (
                <div className="flex items-center gap-2 mt-3">
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
                        aria-label="Select business date"
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
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 rounded-2xl p-3 bg-gray-100 dark:bg-gray-700 mt-4">
                <StatisticCard
                    title="Total profit"
                    value={
                        <AnimatedCurrency value={localStats.total_profit} prefix={'\u20B1'} />
                    }
                    growShrink={data.totalProfit[ecomPeriod].growShrink}
                    iconClass="bg-emerald-100 text-emerald-600"
                    icon={<TbCoin />}
                    label="totalProfit"
                    active={selectedCategory === 'totalProfit'}
                    compareFrom={data.totalProfit[ecomPeriod].comparePeriod}
                    onClick={setSelectedCategory}
                />
                <StatisticCard
                    title="Top-ups"
                    value={
                        <AnimatedCurrency value={localStats.top_ups} prefix={'\u20B1'} />
                    }
                    growShrink={data.totalOrder[ecomPeriod].growShrink}
                    iconClass="bg-blue-100 text-blue-600"
                    icon={<TbArrowUpCircle />}
                    label="totaltopups"
                    active={selectedCategory === 'totaltopups'}
                    compareFrom={data.totalProfit[ecomPeriod].comparePeriod}
                    onClick={setSelectedCategory}
                />
                <StatisticCard
                    title="Shop Sales"
                    value={
                        <AnimatedCurrency value={localStats.shop_sales} prefix={'\u20B1'} />
                    }
                    growShrink={data.totalOrder[ecomPeriod].growShrink}
                    iconClass="bg-violet-100 text-violet-600"
                    icon={<TbShoppingCart />}
                    label="totalShopsales"
                    active={selectedCategory === 'totalShopsales'}
                    compareFrom={data.totalProfit[ecomPeriod].comparePeriod}
                    onClick={setSelectedCategory}
                />
                <StatisticCard
                    title="Refunds"
                    value={
                        <AnimatedCurrency value={localStats.refunds} prefix={'\u20B1'} />
                    }
                    growShrink={data.totalProfit[ecomPeriod].growShrink}
                    iconClass="bg-red-100 text-red-500"
                    icon={<TbReceiptRefund />}
                    label="totalrefunds"
                    active={selectedCategory === 'totalrefunds'}
                    compareFrom={data.totalProfit[ecomPeriod].comparePeriod}
                    onClick={setSelectedCategory}
                />
                <StatisticCard
                    title="Center Expenses"
                    value={
                        <AnimatedCurrency value={localStats.center_expenses} prefix={'\u20B1'} />
                    }
                    growShrink={data.totalProfit[ecomPeriod].growShrink}
                    iconClass="bg-orange-100 text-orange-600"
                    icon={<TbBuildingStore />}
                    label="totalcenterexpenses"
                    active={selectedCategory === 'totalcenterexpenses'}
                    compareFrom={data.totalProfit[ecomPeriod].comparePeriod}
                    onClick={setSelectedCategory}
                />
                {/* <StatisticCard
                    title="Impression"
                    value={
                        <AbbreviateNumber
                            value={data.totalImpression[selectedPeriod].value}
                        />
                    }
                    growShrink={data.totalImpression[selectedPeriod].growShrink}
                    iconClass="bg-purple-200"
                    icon={<TbEye />}
                    label="totalImpression"
                    active={selectedCategory === 'totalImpression'}
                    compareFrom={data.totalProfit[selectedPeriod].comparePeriod}
                    onClick={setSelectedCategory}
                /> */}
            </div>
            <Chart
                type="line"
                series={data[selectedCategory][ecomPeriod].chartData.series}
                xAxis={data[selectedCategory][ecomPeriod].chartData.date}
                height="410px"
                customOptions={{
                    legend: { show: false },
                    colors: [chartColors[selectedCategory]],
                }}
            />
        </Card>
    )
}

export default Overview
