import { useState, useCallback } from 'react'
import Loading from '@/components/shared/Loading'
import OverviewStats from './components/Overview'
import RevenueBreakdown from './components/RevenueBreakdown'
import RecentOrder from './components/RecentOrder'
import TopGames from './components/TopGames'
import TopProduct from './components/TopProduct'
import TopPcs from './components/TopPcs'
import SessionStats from './components/SessionStats'
import ComputerUtilization from './components/ComputerUtilization'
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
    
            {/* ===== HERO SECTION ===== */}
            <div className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <h5 className="font-bold text-gray-800 dark:text-white">
                        iCafeCloud Overview
                    </h5>
                </div>
                <IcafeShiftSection onRefresh={handleShiftRefresh} />
            </div>
    
            {/* ===== MAIN DASHBOARD ===== */}
            <Loading loading={isLoading}>
                {data && (
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
    
                        {/* LEFT MAIN AREA */}
                        <div className="xl:col-span-8 flex flex-col gap-4">
    
                            <div className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
                                <OverviewStats
                                    data={data.statisticData}
                                    refreshSignal={overviewRefreshKey}
                                />
                            </div>
    
                            <div className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
                                
                                <SessionStats refreshSignal={overviewRefreshKey} />
                            </div>

                            <div className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
                                
                                <ComputerUtilization refreshSignal={overviewRefreshKey} />
                            </div>

                            <div className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
                                <RevenueBreakdown
                                    refreshSignal={overviewRefreshKey}
                                />
                            </div>
    
                            <div className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
                                <RecentOrder data={data.recentOrders} />
                            </div>

                            
                        </div>
    
                        {/* RIGHT SIDEBAR */}
                        <div className="xl:col-span-4 flex flex-col gap-4">
    
                            <div className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
                                <TopProduct refreshSignal={overviewRefreshKey} />
                            </div>
    
                            <div className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
                                <TopGames refreshSignal={overviewRefreshKey} />
                            </div>
    
                            <div className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
                                <TopPcs refreshSignal={overviewRefreshKey} />
                            </div> 
                            
    
                        </div>
                    </div>
                )}
            </Loading>
    
            {/* ===== REPORTS SECTION ===== */}
            <div className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
                <IcafeReportsSection />
            </div>
    
        </div>
    )
}

export default SalesDashboard
