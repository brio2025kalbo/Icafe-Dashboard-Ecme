import Loading from '@/components/shared/Loading'
import IcafeOverview from './components/IcafeOverview'
import CustomerDemographic from './components/CustomerDemographic'
import RecentOrder from './components/RecentOrder'
import SalesTarget from './components/SalesTarget'
import TopProduct from './components/TopProduct'
import RevenueByChannel from './components/RevenueByChannel'
import { apiGetEcommerceDashboard } from '@/services/DashboardService'
import { apiGetReports } from '@/services/IcafeService'
import useSWR from 'swr'
import { buildIcafeStats, getPeriodDateRanges } from './utils'
import type { GetEcommerceDashboardResponse , IcafeStatisticData } from './types'

const ICAFE_PERIODS = ['daily', 'weekly', 'monthly', 'yearly'] as const

/** Empty stats used as fallback when the iCafe API is unavailable. */
function emptyIcafeStats(): IcafeStatisticData {
    const emptyPeriodData = {
        value: 0,
        growShrink: 0,
        comparePeriod: '',
        chartData: { series: [{ name: 'Amount', data: [] }], date: [] },
    }
    const emptyRecord = Object.fromEntries(
        ICAFE_PERIODS.map((p) => [p, emptyPeriodData]),
    ) as IcafeStatisticData['totalProfit']
    return {
        totalProfit: emptyRecord,
        topUps: { ...emptyRecord },
        fbSales: { ...emptyRecord },
    }
}

const SalesDashboard = () => {
    // ── iCafe reports ─────────────────────────────────────────────────────────
    const { data: icafeStats, isLoading: icafeLoading } = useSWR(
        ['/icafe/dashboard-overview'],
        async () => {
            const ranges = getPeriodDateRanges()
            // Fetch current and previous report for each period in parallel
            const results = await Promise.all(
                ICAFE_PERIODS.map(async (period) => {
                    const [current, previous] = await Promise.all([
                        apiGetReports(ranges[period].current).catch(() => null),
                        apiGetReports(ranges[period].previous).catch(
                            () => null,
                        ),
                    ])
                    return {
                        period,
                        current: current?.data ?? null,
                        previous: previous?.data ?? null,
                    }
                }),
            )
            const reportsByPeriod = Object.fromEntries(
                results.map(({ period, current, previous }) => [
                    period,
                    { current, previous },
                ]),
            ) as Parameters<typeof buildIcafeStats>[0]
            return buildIcafeStats(reportsByPeriod)
        },
        {
            revalidateOnFocus: false,
            revalidateIfStale: false,
            revalidateOnReconnect: false,
            fallbackData: emptyIcafeStats(),
        },
    )

    // ── Mock data for the other widgets ───────────────────────────────────────
    const { data: mockData, isLoading: mockLoading } = useSWR(
        ['/api/dashboard/ecommerce'],
        () => apiGetEcommerceDashboard<GetEcommerceDashboardResponse>(),
        {
            revalidateOnFocus: false,
            revalidateIfStale: false,
            revalidateOnReconnect: false,
        },
    )

    return (
        <Loading loading={icafeLoading || mockLoading}>
            {mockData && icafeStats && (
                <div>
                    <div className="flex flex-col gap-4 max-w-full overflow-x-hidden">
                        <div className="flex flex-col xl:flex-row gap-4">
                            <div className="flex flex-col gap-4 flex-1 xl:col-span-3">
                                <IcafeOverview data={icafeStats} />
                                <CustomerDemographic
                                    data={mockData.customerDemographic}
                                />
                            </div>
                            <div className="flex flex-col gap-4 2xl:min-w-[360px]">
                                <SalesTarget data={mockData.salesTarget} />
                                <TopProduct data={mockData.topProduct} />
                                <RevenueByChannel
                                    data={mockData.revenueByChannel}
                                />
                            </div>
                        </div>

                        <RecentOrder data={mockData.recentOrders} />
                    </div>
                </div>
            )}
        </Loading>
    )
}

export default SalesDashboard
