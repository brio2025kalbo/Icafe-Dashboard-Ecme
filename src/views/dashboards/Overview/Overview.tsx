import Loading from '@/components/shared/Loading'
import IcafeOverview from './components/IcafeOverview'
import CustomerDemographic from './components/CustomerDemographic'
import RecentOrder from './components/RecentOrder'
import SalesTarget from './components/SalesTarget'
import TopProduct from './components/TopProduct'
import RevenueByChannel from './components/RevenueByChannel'
import { apiGetEcommerceDashboard } from '@/services/DashboardService'
import { createIcafeService } from '@/services/IcafeService'
import { icafeCafes } from '@/configs/icafe.config'
import useSWR from 'swr'
import { buildIcafeStats, getPeriodDateRanges } from './utils'
import appConfig from '@/configs/app.config'
import type { GetEcommerceDashboardResponse, IcafeStatisticData } from './types'
import type { IcafeReport } from '@/@types/icafe'

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

/**
 * Merge multiple IcafeReport responses (one per café) into a single report by
 * summing numeric summary values and concatenating shift rows.  Returns null
 * if every input report is null.
 */
function aggregateReports(reports: (IcafeReport | null)[]): IcafeReport | null {
    const valid = reports.filter((r): r is IcafeReport => r !== null)
    if (valid.length === 0) return null
    if (valid.length === 1) return valid[0]

    const summary: Record<string, number> = {}
    for (const report of valid) {
        for (const [k, v] of Object.entries(report.summary)) {
            summary[k] = (summary[k] ?? 0) + (typeof v === 'number' ? v : 0)
        }
    }

    return {
        ...valid[0],
        summary,
        rows: valid.flatMap((r) => r.rows),
    }
}

const SalesDashboard = () => {
    // ── iCafe reports — one call per café per period, then aggregated ──────────
    const { data: icafeStats, isLoading: icafeLoading } = useSWR(
        ['/icafe/dashboard-overview'],
        async () => {
            const ranges = getPeriodDateRanges()
            // Build a scoped service for every configured café (works for both
            // single-café and multi-café setups via icafeCafes).
            const cafeServices = icafeCafes.map(createIcafeService)

            const results = await Promise.all(
                ICAFE_PERIODS.map(async (period) => {
                    // Fetch current + previous from ALL cafés in parallel
                    const cafeReports = await Promise.all(
                        cafeServices.map(async (svc) => {
                            const [current, previous] = await Promise.all([
                                svc
                                    .apiGetReports(ranges[period].current)
                                    .catch(() => null),
                                svc
                                    .apiGetReports(ranges[period].previous)
                                    .catch(() => null),
                            ])
                            return {
                                current: current?.data ?? null,
                                previous: previous?.data ?? null,
                            }
                        }),
                    )

                    return {
                        period,
                        current: aggregateReports(
                            cafeReports.map((r) => r.current),
                        ),
                        previous: aggregateReports(
                            cafeReports.map((r) => r.previous),
                        ),
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

    // ── Mock-only widgets (skip fetch when VITE_ENABLE_MOCK=false) ────────────
    // These widgets rely on demo data that has no real iCafe backend equivalent.
    // Passing null as the SWR key prevents any network request when mock is off.
    const { data: mockData, isLoading: mockLoading } = useSWR(
        appConfig.enableMock ? ['/dashboard/ecommerce'] : null,
        () => apiGetEcommerceDashboard<GetEcommerceDashboardResponse>(),
        {
            revalidateOnFocus: false,
            revalidateIfStale: false,
            revalidateOnReconnect: false,
        },
    )

    return (
        <Loading loading={icafeLoading || mockLoading}>
            {icafeStats && (
                <div>
                    <div className="flex flex-col gap-4 max-w-full overflow-x-hidden">
                        <div className="flex flex-col xl:flex-row gap-4">
                            <div className="flex flex-col gap-4 flex-1 xl:col-span-3">
                                <IcafeOverview data={icafeStats} />
                                {mockData && (
                                    <CustomerDemographic
                                        data={mockData.customerDemographic}
                                    />
                                )}
                            </div>
                            {mockData && (
                                <div className="flex flex-col gap-4 2xl:min-w-[360px]">
                                    <SalesTarget data={mockData.salesTarget} />
                                    <TopProduct data={mockData.topProduct} />
                                    <RevenueByChannel
                                        data={mockData.revenueByChannel}
                                    />
                                </div>
                            )}
                        </div>

                        {mockData && <RecentOrder data={mockData.recentOrders} />}
                    </div>
                </div>
            )}
        </Loading>
    )
}

export default SalesDashboard
