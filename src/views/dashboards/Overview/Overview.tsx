import { useState, useMemo } from 'react'
import Loading from '@/components/shared/Loading'
import Overview from './components/Overview'
import CustomerDemographic from './components/CustomerDemographic'
import RecentOrder from './components/RecentOrder'
import SalesTarget from './components/SalesTarget'
import TopProduct from './components/TopProduct'
import RevenueByChannel from './components/RevenueByChannel'
import CafeSettingsDialog from './components/CafeSettingsDialog'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import { apiGetEcommerceDashboard } from '@/services/DashboardService'
import { apiGetCafeReports } from '@/services/IcafeService'
import { useCafeStore } from '@/store/cafeStore'
import useSWR from 'swr'
import dayjs from 'dayjs'
import { TbSettings } from 'react-icons/tb'
import type { GetEcommerceDashboardResponse, StatisticData, Period } from './types'
import type { IcafeReportResponse } from '@/services/IcafeService'

const PERIOD_DAYS: Record<Period, number> = {
    thisWeek: 7,
    thisMonth: 30,
    thisYear: 365,
}

function buildStatisticDataFromIcafe(
    responses: Partial<Record<Period, IcafeReportResponse>>,
): StatisticData {
    const periods: Period[] = ['thisWeek', 'thisMonth', 'thisYear']
    const comparePeriodLabel: Record<Period, string> = {
        thisWeek: 'from last week',
        thisMonth: 'from last month',
        thisYear: 'from last year',
    }

    const buildPeriod = (
        period: Period,
        getValue: (r: IcafeReportResponse) => number,
        getDetails: (r: IcafeReportResponse) => number[],
        seriesName: string,
    ) => {
        const r = responses[period]
        const zero = {
            value: 0,
            // Growth rate requires two consecutive periods from the API;
            // defaulting to 0 until a previous-period comparison endpoint is available.
            growShrink: 0,
            comparePeriod: comparePeriodLabel[period],
            chartData: { series: [{ name: seriesName, data: [] }], date: [] },
        }
        // Guard against missing response or malformed API payloads
        // (e.g. 200 OK with data: null on auth failure)
        if (!r?.data?.summary || !Array.isArray(r.data.details)) {
            return zero
        }
        return {
            value: getValue(r),
            // Growth rate requires two consecutive periods from the API;
            // defaulting to 0 until a previous-period comparison endpoint is available.
            growShrink: 0,
            comparePeriod: comparePeriodLabel[period],
            chartData: {
                series: [{ name: seriesName, data: getDetails(r) }],
                date: r.data.details.map((d) => d.date),
            },
        }
    }

    return {
        totalProfit: Object.fromEntries(
            periods.map((p) => [
                p,
                buildPeriod(
                    p,
                    (r) => r.data.summary.totalIncome,
                    (r) => r.data.details.map((d) => d.income),
                    'Income',
                ),
            ]),
        ) as Record<Period, StatisticData['totalProfit'][Period]>,
        totalOrder: Object.fromEntries(
            periods.map((p) => [
                p,
                buildPeriod(
                    p,
                    (r) => r.data.summary.totalTopup,
                    (r) => r.data.details.map((d) => d.topup),
                    'Top-ups',
                ),
            ]),
        ) as Record<Period, StatisticData['totalOrder'][Period]>,
        totalImpression: Object.fromEntries(
            periods.map((p) => [
                p,
                buildPeriod(
                    p,
                    (r) => r.data.summary.totalFbSales,
                    (r) => r.data.details.map((d) => d.fbSales),
                    'F&B Sales',
                ),
            ]),
        ) as Record<Period, StatisticData['totalImpression'][Period]>,
    }
}

const SalesDashboard = () => {
    const [settingsOpen, setSettingsOpen] = useState(false)

    const { cafes, selectedCafeId, selectCafe } = useCafeStore()
    const selectedCafe = cafes.find((c) => c.id === selectedCafeId) ?? null

    const { data: mockData, isLoading: mockLoading } = useSWR(
        ['/api/dashboard/ecommerce'],
        () => apiGetEcommerceDashboard<GetEcommerceDashboardResponse>(),
        {
            revalidateOnFocus: false,
            revalidateIfStale: false,
            revalidateOnReconnect: false,
        },
    )

    const icafeSwrKeys = selectedCafe
        ? (['icafe-reports', selectedCafe.cafeId, selectedCafe.apiKey] as const)
        : null

    const { data: icafeWeek, isLoading: loadingWeek } = useSWR(
        icafeSwrKeys ? [...icafeSwrKeys, 'thisWeek'] : null,
        () => {
            if (!selectedCafe) return null
            const endDate = dayjs().format('YYYY-MM-DD')
            const startDate = dayjs()
                .subtract(PERIOD_DAYS.thisWeek, 'day')
                .format('YYYY-MM-DD')
            return apiGetCafeReports(selectedCafe.cafeId, selectedCafe.apiKey, {
                startDate,
                endDate,
            })
        },
        { revalidateOnFocus: false },
    )

    const { data: icafeMonth, isLoading: loadingMonth } = useSWR(
        icafeSwrKeys ? [...icafeSwrKeys, 'thisMonth'] : null,
        () => {
            if (!selectedCafe) return null
            const endDate = dayjs().format('YYYY-MM-DD')
            const startDate = dayjs()
                .subtract(PERIOD_DAYS.thisMonth, 'day')
                .format('YYYY-MM-DD')
            return apiGetCafeReports(selectedCafe.cafeId, selectedCafe.apiKey, {
                startDate,
                endDate,
            })
        },
        { revalidateOnFocus: false },
    )

    const { data: icafeYear, isLoading: loadingYear } = useSWR(
        icafeSwrKeys ? [...icafeSwrKeys, 'thisYear'] : null,
        () => {
            if (!selectedCafe) return null
            const endDate = dayjs().format('YYYY-MM-DD')
            const startDate = dayjs()
                .subtract(PERIOD_DAYS.thisYear, 'day')
                .format('YYYY-MM-DD')
            return apiGetCafeReports(selectedCafe.cafeId, selectedCafe.apiKey, {
                startDate,
                endDate,
            })
        },
        { revalidateOnFocus: false },
    )

    const icafeLoading =
        !!selectedCafe && (loadingWeek || loadingMonth || loadingYear)

    const icafeStatisticData = useMemo(() => {
        // While loading or no cafe selected, return null so mock data keeps showing
        if (!selectedCafe || icafeLoading) return null

        // Log the raw responses so field names can be verified in the browser console
        console.debug('[iCafe] API responses:', {
            thisWeek: icafeWeek,
            thisMonth: icafeMonth,
            thisYear: icafeYear,
        })

        // Only proceed if at least one period returned a valid data payload.
        // Covers API errors (data === undefined) and error-code responses (data === null).
        const hasValidData = [icafeWeek, icafeMonth, icafeYear].some(
            (r) => r?.data?.summary != null && Array.isArray(r.data?.details),
        )
        if (!hasValidData) return null

        try {
            return buildStatisticDataFromIcafe({
                thisWeek: icafeWeek ?? undefined,
                thisMonth: icafeMonth ?? undefined,
                thisYear: icafeYear ?? undefined,
            })
        } catch (error) {
            console.error('Failed to build iCafe statistics:', error)
            return null
        }
    }, [selectedCafe, icafeLoading, icafeWeek, icafeMonth, icafeYear])

    // Only show a full-page spinner for the initial mock data load.
    // iCafeCloud API loading shows mock data in the background so the page stays visible.
    const isLoading = mockLoading
    const statisticData = icafeStatisticData ?? mockData?.statisticData

    const cafeOptions = cafes.map((c) => ({ value: c.id, label: c.name }))

    return (
        <>
            <Loading loading={isLoading}>
                {mockData && statisticData && (
                    <div>
                        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                                {cafes.length > 0 && (
                                    <Select
                                        className="min-w-[180px]"
                                        size="sm"
                                        placeholder="Select cafe"
                                        value={
                                            cafeOptions.find(
                                                (o) =>
                                                    o.value === selectedCafeId,
                                            ) ?? null
                                        }
                                        options={cafeOptions}
                                        isSearchable={false}
                                        onChange={(opt) =>
                                            selectCafe(opt?.value ?? null)
                                        }
                                    />
                                )}
                            </div>
                            <Button
                                size="sm"
                                variant="plain"
                                icon={<TbSettings />}
                                onClick={() => setSettingsOpen(true)}
                            >
                                Manage Cafes
                            </Button>
                        </div>
                        <div className="flex flex-col gap-4 max-w-full overflow-x-hidden">
                            <div className="flex flex-col xl:flex-row gap-4">
                                <div className="flex flex-col gap-4 flex-1 xl:col-span-3">
                                    <Overview data={statisticData} />
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
            <CafeSettingsDialog
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
            />
        </>
    )
}

export default SalesDashboard
