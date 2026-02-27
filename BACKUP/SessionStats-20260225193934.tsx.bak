import { useState, useEffect, useCallback, useRef } from 'react'
import Card from '@/components/ui/Card'
import classNames from '@/utils/classNames'
import { TbUsers, TbClockHour4, TbDeviceDesktop, TbUserPlus } from 'react-icons/tb'
import { useCafeStore, ALL_CAFES_VALUE } from '@/store/cafeStore'
import { apiGetCustomerAnalysis, apiGetReportData } from '@/services/ReportsService'
import { getTodayBusinessDateStr } from '../utils/periodUtils'
import type { ReactNode } from 'react'
import type { SessionData, ReportDataWithGames } from '../icafeTypes'

const EMPTY_SESSION: SessionData = {
    total_session: 0,
    avg_duration: 0,
    unique_guests_count: 0,
    new_members_number: 0,
}

function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}m`
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const DisplayColumn = ({
    icon,
    label,
    value,
    iconClass,
}: {
    icon: ReactNode
    label: string
    value: string | number
    iconClass: string
}) => {
    return (
        <div className={classNames('flex flex-col items-center gap-5')}>
            <div
                className={classNames(
                    'rounded-full flex items-center justify-center h-12 w-12 text-xl text-gray-900',
                    iconClass,
                )}
            >
                {icon}
            </div>
            <div className="text-center">
                <h6 className="font-bold mb-1">{value}</h6>
                <div className="text-center text-xs">{label}</div>
            </div>
        </div>
    )
}

const SessionStats = ({
    refreshSignal = 0,
}: {
    refreshSignal?: number
}) => {
    const cafes = useCafeStore((s) => s.cafes)
    const filterCafeId = useCafeStore((s) => s.filterCafeId)
    const [session, setSession] = useState<SessionData>(EMPTY_SESSION)
    const [loading, setLoading] = useState(false)
    const prevSignal = useRef(refreshSignal)
    const hasLoadedOnce = useRef(false)

    const fetchData = useCallback(async () => {
        const allValid = cafes.filter((c) => c.cafeId && c.apiKey)
        const validCafes = filterCafeId === ALL_CAFES_VALUE
            ? allValid
            : allValid.filter((c) => c.id === filterCafeId)
        if (validCafes.length === 0) {
            setSession(EMPTY_SESSION)
            return
        }

        if (!hasLoadedOnce.current) {
            setLoading(true)
        }

        try {
            const todayStr = getTodayBusinessDateStr()
            const results = await Promise.allSettled(
                validCafes.map((c) =>
                    apiGetCustomerAnalysis(c.id, {
                        date_start: todayStr,
                        date_end: todayStr,
                    }),
                ),
            )

            const reportResults = await Promise.allSettled(
                validCafes.map((c) =>
                    apiGetReportData<ReportDataWithGames>(c.id, {
                        date_start: todayStr,
                        date_end: todayStr,
                        time_start: '00:00',
                        time_end: '23:59',
                    }),
                ),
            )

            let totalSession = 0
            let totalDuration = 0
            let totalUniqueGuests = 0
            let totalNewMembers = 0
            let cafeCount = 0

            for (const result of results) {
                if (result.status !== 'fulfilled') continue
                const d = result.value.data
                if (!d?.session) continue

                totalSession += d.session.total_session
                totalDuration += d.session.avg_duration
                totalUniqueGuests += d.session.unique_guests_count
                cafeCount++
            }

            for (const result of reportResults) {
                if (result.status !== 'fulfilled') continue
                const d = result.value.data
                if (!d) continue
                totalNewMembers += Number(d.new_members_number) || 0
            }

            setSession({
                total_session: totalSession,
                avg_duration: cafeCount > 0 ? Math.round(totalDuration / cafeCount) : 0,
                unique_guests_count: totalUniqueGuests,
                new_members_number: totalNewMembers,
            })

            hasLoadedOnce.current = true
        } catch {
            if (!hasLoadedOnce.current) {
                setSession(EMPTY_SESSION)
            }
        } finally {
            setLoading(false)
        }
    }, [cafes, filterCafeId])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    useEffect(() => {
        if (refreshSignal !== prevSignal.current) {
            prevSignal.current = refreshSignal
            fetchData()
        }
    }, [refreshSignal, fetchData])

    return (
        <Card>
            <div className="flex items-center justify-between mb-4">
                <h4>Session Overview</h4>
            </div>
            {loading && !hasLoadedOnce.current && (
                <div className="text-center text-gray-400 py-4 text-sm">
                    Loading…
                </div>
            )}
            {!loading && session.total_session === 0 && !hasLoadedOnce.current && (
                <div className="text-center text-gray-400 py-4 text-sm">
                    No session data available.
                </div>
            )}
            <div className="bg-gray-100 dark:bg-gray-900 rounded-xl p-4 mt-8">
                <div className="grid grid-cols-4">
                    <DisplayColumn
                        icon={<TbDeviceDesktop />}
                        label="Total Sessions"
                        value={session.total_session.toLocaleString()}
                        iconClass="bg-sky-200 dark:opacity-70"
                    />
                    <DisplayColumn
                        icon={<TbUsers />}
                        label="Unique Guests"
                        value={session.unique_guests_count.toLocaleString()}
                        iconClass="bg-emerald-200 dark:opacity-70"
                    />
                    <DisplayColumn
                        icon={<TbUserPlus />}
                        label="New Members"
                        value={session.new_members_number.toLocaleString()}
                        iconClass="bg-purple-200 dark:opacity-70"
                    />
                    <DisplayColumn
                        icon={<TbClockHour4 />}
                        label="Avg Duration"
                        value={formatDuration(session.avg_duration)}
                        iconClass="bg-orange-200 dark:opacity-70"
                    />
                </div>
            </div>
        </Card>
    )
}

export default SessionStats
