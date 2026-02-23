import { useState, useEffect, useCallback, useRef } from 'react'
import Card from '@/components/ui/Card'
import classNames from '@/utils/classNames'
import isLastChild from '@/utils/isLastChild'
import { TbDeviceDesktop } from 'react-icons/tb'
import { useCafeStore } from '@/store/cafeStore'
import { apiGetReportData } from '@/services/ReportsService'
import { getDateRange } from '../utils/periodUtils'
import type { PcSpendItem, ReportDataWithGames } from '../icafeTypes'

const MAX_PCS = 5

const TopPcs = ({ refreshSignal = 0 }: { refreshSignal?: number }) => {
    const cafes = useCafeStore((s) => s.cafes)
    const [pcs, setPcs] = useState<PcSpendItem[]>([])
    const [loading, setLoading] = useState(false)
    const prevSignal = useRef(refreshSignal)
    const hasLoadedOnce = useRef(false)

    const fetchTopPcs = useCallback(async () => {
        const validCafes = cafes.filter((c) => c.cafeId && c.apiKey)
        if (validCafes.length === 0) {
            setPcs([])
            return
        }

        if (!hasLoadedOnce.current) {
            setLoading(true)
        }
        try {
            const range = getDateRange('daily')

            const results = await Promise.allSettled(
                validCafes.map((c) =>
                    apiGetReportData<ReportDataWithGames>(c.id, {
                        date_start: range.date_start,
                        date_end: range.date_end,
                        time_start: range.time_start,
                        time_end: range.time_end,
                    }),
                ),
            )

            // Merge PCs across all cafes
            const pcMap = new Map<string, { spend: number }>()
            for (const result of results) {
                if (result.status !== 'fulfilled') continue
                const pcList = result.value.data?.top_five_pc_spend
                if (!Array.isArray(pcList)) continue
                for (const item of pcList) {
                    const spend = Number(item.spend) || 0
                    const existing = pcMap.get(item.pc_name)
                    if (existing) {
                        existing.spend += spend
                    } else {
                        pcMap.set(item.pc_name, { spend })
                    }
                }
            }

            const merged = Array.from(pcMap.entries())
                .map(([pc_name, data]) => ({ pc_name, ...data }))
                .sort((a, b) => b.spend - a.spend)
                .slice(0, MAX_PCS)

            setPcs(merged)
            hasLoadedOnce.current = true
        } catch {
            if (!hasLoadedOnce.current) {
                setPcs([])
            }
        } finally {
            setLoading(false)
        }
    }, [cafes])

    useEffect(() => {
        fetchTopPcs()
    }, [fetchTopPcs])

    useEffect(() => {
        if (refreshSignal !== prevSignal.current) {
            prevSignal.current = refreshSignal
            fetchTopPcs()
        }
    }, [refreshSignal, fetchTopPcs])

    return (
        <Card>
            <div className="flex items-center justify-between">
                <h4>Top PCs Today</h4>
            </div>
            <div className="mt-5">
                {loading && pcs.length === 0 && (
                    <div className="text-center text-gray-400 py-4 text-sm">
                        Loading…
                    </div>
                )}
                {!loading && pcs.length === 0 && (
                    <div className="text-center text-gray-400 py-4 text-sm">
                        No PC data today.
                    </div>
                )}
                {pcs.map((pc, index) => (
                    <div
                        key={pc.pc_name}
                        className={classNames(
                            'flex items-center justify-between py-2 dark:border-gray-600 transition-all duration-300 ease-in-out',
                            !isLastChild(pcs, index) && 'mb-2',
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center w-[40px] h-[40px] rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                <TbDeviceDesktop className="text-lg" />
                            </div>
                            <div>
                                <div className="heading-text font-bold">
                                    {pc.pc_name}
                                </div>
                            </div>
                        </div>
                        <div className="font-semibold text-sm transition-all duration-300">
                            ₱{(pc.spend ?? 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    )
}

export default TopPcs
