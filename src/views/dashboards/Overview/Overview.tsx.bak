import { useState, useCallback } from 'react'
import Loading from '@/components/shared/Loading'
import OverviewStats from './components/Overview'
import RevenueBreakdown from './components/RevenueBreakdown'
import RecentOrder from './components/RecentOrder'
import TopGames from './components/TopGames'
import TopProduct from './components/TopProduct'
import SessionStats from './components/SessionStats'
import IcafeReportsSection from './components/IcafeReportsSection'
import IcafeShiftSection from './components/IcafeShiftSection'
import { apiGetEcommerceDashboard } from '@/services/DashboardService'
import useSWR from 'swr'
import type { GetEcommerceDashboardResponse } from './types'

const SalesDashboard = () => {
    const { data, isLoading } = useSWR(
        ['/api/dashboard/ecommerce'],
        () => apiGetEcommerceDashboard<GetEcommerceDashboardResponse>(),
        {
            revalidateOnFocus: false,
            revalidateIfStale: false,
            revalidateOnReconnect: false,
        },
    )

    const [overviewRefreshKey, setOverviewRefreshKey] = useState(0)
    const handleShiftRefresh = useCallback(() => {
        setOverviewRefreshKey((k) => k + 1)
    }, [])

    return (
        <div className="flex flex-col gap-6">
            {/* ── iCafeCloud Shift Stats Overview ── */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-1">
                    <h5 className="font-bold text-gray-800 dark:text-white">iCafeCloud Overview</h5>
                </div>
                <IcafeShiftSection onRefresh={handleShiftRefresh} />
            </div>

            {/* ── Existing ecommerce dashboard ── */}
            <Loading loading={isLoading}>
                {data && (
                    <div className="flex flex-col gap-4 max-w-full overflow-x-hidden">
                        <div className="flex flex-col xl:flex-row gap-4">
                            <div className="flex flex-col gap-4 flex-1 xl:col-span-3">
                                <OverviewStats data={data.statisticData} refreshSignal={overviewRefreshKey} />
                                <RevenueBreakdown refreshSignal={overviewRefreshKey} />
                            </div>
                            <div className="flex flex-col gap-4 2xl:min-w-[360px]">
                                <TopGames refreshSignal={overviewRefreshKey} />
                                <TopProduct refreshSignal={overviewRefreshKey} />
                                <SessionStats
                                    refreshSignal={overviewRefreshKey}
                                />
                            </div>
                        </div>
                        <RecentOrder data={data.recentOrders} />
                    </div>
                )}
            </Loading>

            {/* ── iCafeCloud Live Reports Charts ── */}
            <IcafeReportsSection />            
        </div>
    )
}

export default SalesDashboard
