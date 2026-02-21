import { useState } from 'react'
import useSWR from 'swr'
import dayjs from 'dayjs'
import Card from '@/components/ui/Card'
import Select from '@/components/ui/Select'
import Spinner from '@/components/ui/Spinner'
import Chart from '@/components/shared/Chart'
import { apiGetReportChart } from '@/services/ReportsService'
import { COLOR_1, COLOR_2, COLOR_4, COLOR_3 } from '@/constants/chart.constant'
import type { ChartType } from '../icafeTypes'

type IcafeReportChartProps = {
    cafeId: string
    cafeName: string
}

const chartTypeOptions: { value: ChartType; label: string }[] = [
    { value: 'income', label: 'Income' },
    { value: 'topup', label: 'Top-ups' },
    { value: 'sale', label: 'Sales' },
    { value: 'product', label: 'Products' },
]

const chartColors: Record<ChartType, string> = {
    income: COLOR_1,
    topup: COLOR_2,
    sale: COLOR_4,
    product: COLOR_3,
}

const IcafeReportChart = ({ cafeId, cafeName }: IcafeReportChartProps) => {
    const [chartType, setChartType] = useState<ChartType>('income')

    const dateEnd = dayjs().format('YYYY-MM-DD')
    const dateStart = dayjs().subtract(29, 'day').format('YYYY-MM-DD')

    const { data, isLoading, error } = useSWR(
        cafeId ? [`icafe-report-chart`, cafeId, chartType] : null,
        () =>
            apiGetReportChart(cafeId, {
                date_start: dateStart,
                date_end: dateEnd,
                log_staff_name: 'all',
                chart_type: chartType,
                data_source: 'recent',
            }),
        {
            revalidateOnFocus: false,
            revalidateIfStale: false,
        },
    )

    const chartData = data?.data

    return (
        <Card>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h4 className="mb-0">{cafeName} — Report</h4>
                    {chartData?.report && (
                        <p className="text-xs text-gray-400 mt-0.5">
                            {chartData.report.report_start} →{' '}
                            {chartData.report.report_end}
                            {chartData.report.staff !== 'All' &&
                                ` · Staff: ${chartData.report.staff}`}
                        </p>
                    )}
                </div>
                <Select
                    className="w-[140px]"
                    size="sm"
                    placeholder="Chart type"
                    value={chartTypeOptions.find((o) => o.value === chartType)}
                    options={chartTypeOptions}
                    isSearchable={false}
                    onChange={(option) => {
                        if (option?.value) setChartType(option.value)
                    }}
                />
            </div>

            {isLoading && (
                <div className="flex justify-center items-center h-[300px]">
                    <Spinner size={40} />
                </div>
            )}

            {error && !isLoading && (
                <div className="flex justify-center items-center h-[300px] text-red-500 text-sm">
                    Failed to load report data. Please check your API key and
                    Cafe ID.
                </div>
            )}

            {!isLoading && !error && data?.code !== 200 && (
                <div className="flex justify-center items-center h-[300px] text-amber-500 text-sm">
                    API returned: {data?.message ?? 'Unknown error'} (code:{' '}
                    {data?.code})
                </div>
            )}

            {!isLoading && !error && chartData && (
                <Chart
                    type="bar"
                    series={chartData.series}
                    xAxis={chartData.categories}
                    height="320px"
                    customOptions={{
                        colors: [chartColors[chartType]],
                        legend: { show: chartData.series.length > 1 },
                        dataLabels: { enabled: false },
                        plotOptions: {
                            bar: {
                                borderRadius: 4,
                                columnWidth: '55%',
                            },
                        },
                    }}
                />
            )}
        </Card>
    )
}

export default IcafeReportChart
