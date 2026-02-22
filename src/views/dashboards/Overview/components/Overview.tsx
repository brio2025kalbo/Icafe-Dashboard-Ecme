import { useState, useEffect, useRef, useCallback } from 'react'
import Card from '@/components/ui/Card'
import Select from '@/components/ui/Select'
import GrowShrinkValue from '@/components/shared/GrowShrinkValue'
import AbbreviateNumber from '@/components/shared/AbbreviateNumber'
import Chart from '@/components/shared/Chart'
import { useThemeStore } from '@/store/themeStore'
import { useCafeStore } from '@/store/cafeStore'
import classNames from '@/utils/classNames'
import { COLOR_1, COLOR_2, COLOR_4 } from '@/constants/chart.constant'
import { options } from '../constants'
import { NumericFormat } from 'react-number-format'
import { TbCoin, TbShoppingBagCheck, TbEye, TbReceiptRefund, TbBuildingStore } from 'react-icons/tb'
import { apiGetShiftStats } from '@/services/ReportsService'
import {
    getDateRange,
    getBusinessDayRange,
    getTodayBusinessDateStr,
} from '../utils/periodUtils'
import type { ReactNode } from 'react'
import type { StatisticData, Period, EcommercePeriod, StatisticCategory } from '../types'
import type { PeriodType, ShiftStats } from '../icafeTypes'

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

/** Map the Overview dropdown period to PeriodType used by the API */
const periodToPeriodType: Record<Period, PeriodType> = {
    thisDay: 'daily',
    thisWeek: 'weekly',
    thisMonth: 'monthly',
    thisYear: 'yearly',
}

/** Map Period to the nearest ecommerce period (for chart/growShrink fallback) */
function toEcommercePeriod(p: Period): EcommercePeriod {
    if (p === 'thisDay') return 'thisMonth'
    return p
}

const Overview = ({ data }: StatisticGroupsProps) => {
    const [selectedCategory, setSelectedCategory] =
        useState<StatisticCategory>('totalProfit')

    const [selectedPeriod, setSelectedPeriod] = useState<Period>('thisDay')

    const cafes = useCafeStore((s) => s.cafes)
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

    const validCafes = cafes.filter((c) => c.cafeId && c.apiKey)

    const fetchStats = useCallback(async () => {
        if (validCafes.length === 0) {
            setLocalStats(EMPTY_STATS)
            return
        }

        setLoading(true)

        const pt = periodToPeriodType[selectedPeriod]
        const range = pt === 'daily'
            ? getBusinessDayRange(getTodayBusinessDateStr())
            : getDateRange(pt)

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
    }, [cafes, selectedPeriod])

    useEffect(() => { fetchStats() }, [fetchStats])

    /** Safe ecommerce period for chart/growShrink data */
    const ecomPeriod = toEcommercePeriod(selectedPeriod)

    return (
        <Card>
            <div className="flex items-center justify-between">
                <h4>Overview</h4>
                <Select
                    className="w-[120px]"
                    size="sm"
                    placeholder="Select period"
                    value={options.filter(
                        (option) => option.value === selectedPeriod,
                    )}
                    options={options}
                    isSearchable={false}
                    onChange={(option) => {
                        if (option?.value) {
                            setSelectedPeriod(option?.value)
                        }
                    }}
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 rounded-2xl p-3 bg-gray-100 dark:bg-gray-700 mt-4">
                <StatisticCard
                    title="Total profit"
                    value={
                        <NumericFormat
                            displayType="text"
                            value={localStats.total_profit}
                            prefix={'\u20B1'}
                            thousandSeparator={true}
                            decimalScale={2}
                            fixedDecimalScale={true}
                        />
                    }
                    growShrink={data.totalProfit[ecomPeriod].growShrink}
                    iconClass="bg-sky-200"
                    icon={<TbCoin />}
                    label="totalProfit"
                    active={selectedCategory === 'totalProfit'}
                    compareFrom={data.totalProfit[ecomPeriod].comparePeriod}
                    onClick={setSelectedCategory}
                />
                <StatisticCard
                    title="Top-ups"
                    value={
                        <NumericFormat
                            displayType="text"
                            value={localStats.top_ups}
                            prefix={'\u20B1'}
                            thousandSeparator={true}
                            decimalScale={2}
                            fixedDecimalScale={true}
                        />
                    }
                    growShrink={data.totalOrder[ecomPeriod].growShrink}
                    iconClass="bg-emerald-200"
                    icon={<TbShoppingBagCheck />}
                    label="totalOrder"
                    active={selectedCategory === 'totalOrder'}
                    compareFrom={data.totalProfit[ecomPeriod].comparePeriod}
                    onClick={setSelectedCategory}
                />
                <StatisticCard
                    title="Shop Sales"
                    value={
                        <NumericFormat
                            displayType="text"
                            value={localStats.shop_sales}
                            prefix={'\u20B1'}
                            thousandSeparator={true}
                            decimalScale={2}
                            fixedDecimalScale={true}
                        />
                    }
                    growShrink={data.totalOrder[ecomPeriod].growShrink}
                    iconClass="bg-emerald-200"
                    icon={<TbShoppingBagCheck />}
                    label="totalOrder"
                    active={selectedCategory === 'totalOrder'}
                    compareFrom={data.totalProfit[ecomPeriod].comparePeriod}
                    onClick={setSelectedCategory}
                />
                <StatisticCard
                    title="Refunds"
                    value={
                        <NumericFormat
                            displayType="text"
                            value={localStats.refunds}
                            prefix={'\u20B1'}
                            thousandSeparator={true}
                            decimalScale={2}
                            fixedDecimalScale={true}
                        />
                    }
                    growShrink={data.totalProfit[ecomPeriod].growShrink}
                    iconClass="bg-red-200"
                    icon={<TbReceiptRefund />}
                    label="totalProfit"
                    active={selectedCategory === 'totalProfit'}
                    compareFrom={data.totalProfit[ecomPeriod].comparePeriod}
                    onClick={setSelectedCategory}
                />
                <StatisticCard
                    title="Center Expenses"
                    value={
                        <NumericFormat
                            displayType="text"
                            value={localStats.center_expenses}
                            prefix={'\u20B1'}
                            thousandSeparator={true}
                            decimalScale={2}
                            fixedDecimalScale={true}
                        />
                    }
                    growShrink={data.totalProfit[ecomPeriod].growShrink}
                    iconClass="bg-orange-200"
                    icon={<TbBuildingStore />}
                    label="totalProfit"
                    active={selectedCategory === 'totalProfit'}
                    compareFrom={data.totalProfit[ecomPeriod].comparePeriod}
                    onClick={setSelectedCategory}
                />
                <StatisticCard
                    title="Impression"
                    value={
                        <AbbreviateNumber
                            value={data.totalImpression[ecomPeriod].value}
                        />
                    }
                    growShrink={data.totalImpression[ecomPeriod].growShrink}
                    iconClass="bg-purple-200"
                    icon={<TbEye />}
                    label="totalImpression"
                    active={selectedCategory === 'totalImpression'}
                    compareFrom={data.totalProfit[ecomPeriod].comparePeriod}
                    onClick={setSelectedCategory}
                />
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
