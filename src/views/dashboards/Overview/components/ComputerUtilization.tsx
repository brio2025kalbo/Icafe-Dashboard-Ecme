import { useState, useEffect, useCallback, useRef } from 'react'
import Card from '@/components/ui/Card'
import Progress from '@/components/ui/Progress'
import { TbDeviceDesktop, TbDeviceDesktopCheck, TbDeviceDesktopOff } from 'react-icons/tb'
import { useCafeStore, ALL_CAFES_VALUE } from '@/store/cafeStore'
import { apiGetCafePcs } from '@/services/ReportsService'
import type { PcStatusItem } from '../icafeTypes'

type CafePcStats = {
    cafeName: string
    total: number
    enabled: number
    inUse: number
    available: number
    utilization: number
}

function computeStats(pcs: PcStatusItem[]): Omit<CafePcStats, 'cafeName'> {
    const total = pcs.length
    const enabled = pcs.filter((p) => p.pc_enabled === 1).length
    const inUse = pcs.filter((p) => p.pc_enabled === 1 && p.member_account != null && p.member_account !== '').length
    const available = enabled - inUse
    const utilization = enabled > 0 ? Math.round((inUse / enabled) * 100) : 0
    return { total, enabled, inUse, available, utilization }
}

function getProgressColorClass(percent: number): string {
    if (percent >= 80) return 'bg-red-500'
    if (percent >= 50) return 'bg-amber-500'
    return 'bg-emerald-500'
}

const REFRESH_INTERVAL = 30_000

const ComputerUtilization = ({ refreshSignal = 0 }: { refreshSignal?: number }) => {
    const cafes = useCafeStore((s) => s.cafes)
    const filterCafeId = useCafeStore((s) => s.filterCafeId)
    const [combinedStats, setCombinedStats] = useState<Omit<CafePcStats, 'cafeName'> | null>(null)
    const [perCafeStats, setPerCafeStats] = useState<CafePcStats[]>([])
    const [loading, setLoading] = useState(false)
    const hasLoadedOnce = useRef(false)
    const prevSignal = useRef(refreshSignal)

    const fetchData = useCallback(async () => {
        const allValid = cafes.filter((c) => c.cafeId && c.apiKey)
        const validCafes =
            filterCafeId === ALL_CAFES_VALUE
                ? allValid
                : allValid.filter((c) => c.id === filterCafeId)
        if (validCafes.length === 0) {
            setCombinedStats(null)
            setPerCafeStats([])
            return
        }

        if (!hasLoadedOnce.current) {
            setLoading(true)
        }

        try {
            const results = await Promise.allSettled(
                validCafes.map((c) => apiGetCafePcs(c.id)),
            )

            const allPcs: PcStatusItem[] = []
            const cafeStats: CafePcStats[] = []

            for (let i = 0; i < results.length; i++) {
                const result = results[i]
                if (result.status !== 'fulfilled') continue
                const pcs = result.value.data
                if (!Array.isArray(pcs)) continue

                allPcs.push(...pcs)
                const stats = computeStats(pcs)
                cafeStats.push({ cafeName: validCafes[i].name, ...stats })
            }

            setCombinedStats(computeStats(allPcs))
            setPerCafeStats(cafeStats)
            hasLoadedOnce.current = true
        } catch {
            if (!hasLoadedOnce.current) {
                setCombinedStats(null)
                setPerCafeStats([])
            }
        } finally {
            setLoading(false)
        }
    }, [cafes, filterCafeId])

    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, REFRESH_INTERVAL)
        return () => clearInterval(interval)
    }, [fetchData])

    useEffect(() => {
        if (refreshSignal !== prevSignal.current) {
            prevSignal.current = refreshSignal
            fetchData()
        }
    }, [refreshSignal, fetchData])

    const showPerCafe = perCafeStats.length > 1

    return (
        <div className="flex flex-col gap-4">
            {/* Combined stats card */}
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <h4>PC Status</h4>
                </div>
                {loading && !hasLoadedOnce.current && (
                    <div className="text-center text-gray-400 py-4 text-sm">
                        Loading…
                    </div>
                )}
                {!loading && !combinedStats && (
                    <div className="text-center text-gray-400 py-4 text-sm">
                        No computer data available.
                    </div>
                )}
                {combinedStats && (
                    <div>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <StatBox
                                icon={<TbDeviceDesktop className="text-lg" />}
                                iconClass="bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400"
                                label="Total PCs"
                                value={combinedStats.enabled}
                            />
                            <StatBox
                                icon={<TbDeviceDesktopCheck className="text-lg" />}
                                iconClass="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                label="In Use"
                                value={combinedStats.inUse}
                            />
                            <StatBox
                                icon={<TbDeviceDesktopOff className="text-lg" />}
                                iconClass="bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                label="Available"
                                value={combinedStats.available}
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-semibold">Utilization</span>
                                <span className="text-sm font-bold">{combinedStats.utilization}%</span>
                            </div>
                            <Progress
                                percent={combinedStats.utilization}
                                customColorClass={getProgressColorClass(combinedStats.utilization)}
                                showInfo={false}
                            />
                        </div>
                    </div>
                )}
            </Card>

            {/* Per-cafe cards */}
            {showPerCafe && (
                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <h4>PC Status by Cafe</h4>
                    </div>
                    <div className="flex flex-col gap-4">
                        {perCafeStats.map((cafe) => (
                            <div
                                key={cafe.cafeName}
                                className="rounded-lg border border-gray-200 dark:border-gray-600 p-4"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <h6 className="font-bold">{cafe.cafeName}</h6>
                                    <span className="text-sm font-bold">{cafe.utilization}%</span>
                                </div>
                                <Progress
                                    percent={cafe.utilization}
                                    customColorClass={getProgressColorClass(cafe.utilization)}
                                    showInfo={false}
                                />
                                <div className="grid grid-cols-3 gap-2 mt-3">
                                    <MiniStat label="Total PCs" value={cafe.enabled} />
                                    <MiniStat label="In Use" value={cafe.inUse} />
                                    <MiniStat label="Available" value={cafe.available} />
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    )
}

const StatBox = ({
    icon,
    iconClass,
    label,
    value,
}: {
    icon: React.ReactNode
    iconClass: string
    label: string
    value: number
}) => (
    <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
        <div className={`flex items-center justify-center w-10 h-10 rounded-full ${iconClass}`}>
            {icon}
        </div>
        <div className="text-center">
            <div className="heading-text font-bold text-lg">{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
        </div>
    </div>
)

const MiniStat = ({ label, value }: { label: string; value: number }) => (
    <div className="text-center">
        <div className="heading-text font-semibold text-sm">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
    </div>
)

export default ComputerUtilization
