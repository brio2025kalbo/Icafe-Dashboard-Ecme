import { useState, useEffect, useCallback, useRef } from 'react'
import Card from '@/components/ui/Card'
import Chart from '@/components/shared/Chart'
import classNames from '@/utils/classNames'
import { COLOR_1, COLOR_7 } from '@/constants/chart.constant'
import { useCafeStore } from '@/store/cafeStore'
import { apiGetCustomerAnalysis } from '@/services/ReportsService'
import type { IncomeChartItem } from '../icafeTypes'

type MemberRankingEntry = { member_account: string; spend_amount: number }

const CHART_COLORS = [COLOR_1, COLOR_7]

const RevenueBreakdown = ({
    refreshSignal = 0,
}: {
    refreshSignal?: number
}) => {
    const cafes = useCafeStore((s) => s.cafes)
    const [incomeChart, setIncomeChart] = useState<IncomeChartItem[]>([])
    const [memberRanking, setMemberRanking] = useState<MemberRankingEntry[]>(
        [],
    )
    const [loading, setLoading] = useState(false)
    const prevSignal = useRef(refreshSignal)
    const hasLoadedOnce = useRef(false)

    const fetchData = useCallback(async () => {
        const validCafes = cafes.filter((c) => c.cafeId && c.apiKey)
        if (validCafes.length === 0) {
            setIncomeChart([])
            setMemberRanking([])
            return
        }

        if (!hasLoadedOnce.current) {
            setLoading(true)
        }

        try {
            const results = await Promise.allSettled(
                validCafes.map((c) => apiGetCustomerAnalysis(c.id)),
            )

            // Merge income_chart across cafes by name
            const incomeMap = new Map<string, number>()
            // Merge member_spend_ranking across cafes
            const memberMap = new Map<string, number>()

            for (const result of results) {
                if (result.status !== 'fulfilled') continue
                const d = result.value.data
                if (!d) continue

                for (const item of d.income_chart ?? []) {
                    const name = item.name
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&amp;/g, '&')
                    const existing = incomeMap.get(name) ?? 0
                    incomeMap.set(name, existing + item.value)
                }

                for (const item of d.member_spend_ranking ?? []) {
                    const existing =
                        memberMap.get(item.member_account) ?? 0
                    memberMap.set(
                        item.member_account,
                        existing + parseFloat(item.spend_amount),
                    )
                }
            }

            setIncomeChart(
                Array.from(incomeMap.entries()).map(([name, value]) => ({
                    name,
                    value,
                })),
            )

            setMemberRanking(
                Array.from(memberMap.entries())
                    .map(([member_account, spend_amount]) => ({
                        member_account,
                        spend_amount,
                    }))
                    .sort((a, b) => b.spend_amount - a.spend_amount)
                    .slice(0, 10),
            )

            hasLoadedOnce.current = true
        } catch {
            if (!hasLoadedOnce.current) {
                setIncomeChart([])
                setMemberRanking([])
            }
        } finally {
            setLoading(false)
        }
    }, [cafes])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Silent background refresh triggered by parent auto-refresh
    useEffect(() => {
        if (refreshSignal !== prevSignal.current) {
            prevSignal.current = refreshSignal
            fetchData()
        }
    }, [refreshSignal, fetchData])

    const chartSeries = incomeChart.map((item) => item.value)
    const chartLabels = incomeChart.map((item) => item.name)
    const total = chartSeries.reduce((sum, v) => sum + v, 0)

    return (
        <Card>
            <h4>Revenue Breakdown</h4>
            <div className="flex flex-col xl:flex-row gap-4 mt-4">
                {/* Pie chart on the left */}
                <div className="flex flex-col items-center justify-center flex-1 min-w-0">
                    {loading && incomeChart.length === 0 && (
                        <div className="text-center text-gray-400 py-4 text-sm">
                            Loading…
                        </div>
                    )}
                    {!loading && incomeChart.length === 0 && (
                        <div className="text-center text-gray-400 py-4 text-sm">
                            No income data available.
                        </div>
                    )}
                    {incomeChart.length > 0 && (
                        <>
                            <Chart
                                type="donut"
                                series={chartSeries}
                                height={260}
                                customOptions={{
                                    colors: CHART_COLORS,
                                    labels: chartLabels,
                                    plotOptions: {
                                        pie: {
                                            donut: {
                                                labels: {
                                                    show: true,
                                                    total: {
                                                        show: true,
                                                        showAlways: true,
                                                        label: 'Total',
                                                        formatter: () =>
                                                            `₱${total.toLocaleString()}`,
                                                    },
                                                },
                                                size: '75%',
                                            },
                                        },
                                    },
                                }}
                            />
                            <div className="flex gap-6 mt-2">
                                {incomeChart.map((item, idx) => (
                                    <div
                                        key={item.name}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <span
                                            className="inline-block w-3 h-3 rounded-full"
                                            style={{
                                                backgroundColor:
                                                    CHART_COLORS[
                                                        idx %
                                                            CHART_COLORS.length
                                                    ],
                                            }}
                                        />
                                        <span className="heading-text font-semibold">
                                            {item.name}
                                        </span>
                                        <span className="text-gray-500">
                                            ₱
                                            {item.value.toLocaleString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Member spend ranking on the right */}
                <div className="flex flex-col justify-start 2xl:min-w-[300px] xl:w-[280px] w-full">
                    <h6 className="mb-3 text-gray-500 font-semibold text-xs uppercase tracking-wide">
                        Top Spenders
                    </h6>
                    {loading && memberRanking.length === 0 && (
                        <div className="text-center text-gray-400 py-4 text-sm">
                            Loading…
                        </div>
                    )}
                    {!loading && memberRanking.length === 0 && (
                        <div className="text-center text-gray-400 py-4 text-sm">
                            No member data available.
                        </div>
                    )}
                    {memberRanking.map((member, idx) => (
                        <div
                            key={member.member_account}
                            className={classNames(
                                'flex items-center justify-between py-2 transition-all duration-300 ease-in-out',
                                idx !== memberRanking.length - 1 &&
                                    'border-b border-gray-100 dark:border-gray-700',
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 w-5 text-right">
                                    {idx + 1}
                                </span>
                                <span className="heading-text font-semibold text-sm">
                                    {member.member_account}
                                </span>
                            </div>
                            <span className="font-semibold text-sm">
                                ₱
                                {member.spend_amount.toLocaleString(
                                    undefined,
                                    {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    },
                                )}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    )
}

export default RevenueBreakdown
