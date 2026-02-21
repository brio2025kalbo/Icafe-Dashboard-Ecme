import { useState, useEffect, useRef } from 'react'
import Card from '@/components/ui/Card'
import Select from '@/components/ui/Select'
import GrowShrinkValue from '@/components/shared/GrowShrinkValue'
import Chart from '@/components/shared/Chart'
import { useThemeStore } from '@/store/themeStore'
import classNames from '@/utils/classNames'
import { COLOR_1, COLOR_2, COLOR_4 } from '@/constants/chart.constant'
import { icafeOptions } from '../constants'
import { NumericFormat } from 'react-number-format'
import { TbCoin, TbCurrencyDollar, TbToolsKitchen2 } from 'react-icons/tb'
import type { ReactNode } from 'react'
import type {
    IcafeStatisticData,
    IcafePeriod,
    IcafeStatCategory,
} from '../types'

type StatisticCardProps = {
    title: string
    value: ReactNode
    icon: ReactNode
    growShrink: number
    iconClass: string
    label: IcafeStatCategory
    compareFrom: string
    active: boolean
    onClick: (label: IcafeStatCategory) => void
}

type IcafeOverviewProps = {
    data: IcafeStatisticData
}

const chartColors: Record<IcafeStatCategory, string> = {
    totalProfit: COLOR_1,
    topUps: COLOR_2,
    fbSales: COLOR_4,
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

const IcafeOverview = ({ data }: IcafeOverviewProps) => {
    const [selectedCategory, setSelectedCategory] =
        useState<IcafeStatCategory>('totalProfit')

    const [selectedPeriod, setSelectedPeriod] = useState<IcafePeriod>('daily')

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

    const periodData = data[selectedCategory][selectedPeriod]

    return (
        <Card>
            <div className="flex items-center justify-between">
                <h4>Overview</h4>
                <Select
                    className="w-[120px]"
                    size="sm"
                    placeholder="Select period"
                    value={icafeOptions.filter(
                        (option) => option.value === selectedPeriod,
                    )}
                    options={icafeOptions}
                    isSearchable={false}
                    onChange={(option) => {
                        if (option?.value) {
                            setSelectedPeriod(option.value)
                        }
                    }}
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-2xl p-3 bg-gray-100 dark:bg-gray-700 mt-4">
                <StatisticCard
                    title="Total Profit"
                    value={
                        <NumericFormat
                            fixedDecimalScale
                            displayType="text"
                            value={data.totalProfit[selectedPeriod].value}
                            prefix={'₱'}
                            thousandSeparator={true}
                            decimalScale={2}
                        />
                    }
                    growShrink={data.totalProfit[selectedPeriod].growShrink}
                    iconClass="bg-sky-200"
                    icon={<TbCurrencyDollar />}
                    label="totalProfit"
                    active={selectedCategory === 'totalProfit'}
                    compareFrom={data.totalProfit[selectedPeriod].comparePeriod}
                    onClick={setSelectedCategory}
                />
                <StatisticCard
                    title="Top-ups"
                    value={
                        <NumericFormat
                            fixedDecimalScale
                            displayType="text"
                            value={data.topUps[selectedPeriod].value}
                            prefix={'₱'}
                            thousandSeparator={true}
                            decimalScale={2}
                        />
                    }
                    growShrink={data.topUps[selectedPeriod].growShrink}
                    iconClass="bg-emerald-200"
                    icon={<TbCoin />}
                    label="topUps"
                    active={selectedCategory === 'topUps'}
                    compareFrom={data.topUps[selectedPeriod].comparePeriod}
                    onClick={setSelectedCategory}
                />
                <StatisticCard
                    title="F&B Sales"
                    value={
                        <NumericFormat
                            fixedDecimalScale
                            displayType="text"
                            value={data.fbSales[selectedPeriod].value}
                            prefix={'₱'}
                            thousandSeparator={true}
                            decimalScale={2}
                        />
                    }
                    growShrink={data.fbSales[selectedPeriod].growShrink}
                    iconClass="bg-purple-200"
                    icon={<TbToolsKitchen2 />}
                    label="fbSales"
                    active={selectedCategory === 'fbSales'}
                    compareFrom={data.fbSales[selectedPeriod].comparePeriod}
                    onClick={setSelectedCategory}
                />
            </div>
            <Chart
                type="line"
                series={periodData.chartData.series}
                xAxis={periodData.chartData.date}
                height="410px"
                customOptions={{
                    legend: { show: false },
                    colors: [chartColors[selectedCategory]],
                }}
            />
        </Card>
    )
}

export default IcafeOverview
