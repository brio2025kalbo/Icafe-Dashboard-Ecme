import { useState, useEffect, useCallback, useRef } from 'react'
import Card from '@/components/ui/Card'
import classNames from '@/utils/classNames'
import isLastChild from '@/utils/isLastChild'
import { TbDeviceGamepad2 } from 'react-icons/tb'
import { useCafeStore } from '@/store/cafeStore'
import { apiGetReportData } from '@/services/ReportsService'
import { getDateRange } from '../utils/periodUtils'
import type { GameItem, ReportDataWithGames } from '../icafeTypes'

const MAX_GAMES = 10

const TopGames = ({ refreshSignal = 0 }: { refreshSignal?: number }) => {
    const cafes = useCafeStore((s) => s.cafes)
    const [games, setGames] = useState<GameItem[]>([])
    const [loading, setLoading] = useState(false)
    const prevSignal = useRef(refreshSignal)
    const hasLoadedOnce = useRef(false)

    const fetchTopGames = useCallback(async () => {
        const validCafes = cafes.filter((c) => c.cafeId && c.apiKey)
        if (validCafes.length === 0) {
            setGames([])
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

            // Merge games across all cafes
            const gameMap = new Map<
                string,
                { local_times: number; pool_times: number }
            >()
            for (const result of results) {
                if (result.status !== 'fulfilled') continue
                const gameList = result.value.data?.game
                if (!Array.isArray(gameList)) continue
                for (const item of gameList) {
                    const existing = gameMap.get(item.name)
                    if (existing) {
                        existing.local_times += item.local_times
                        existing.pool_times += item.pool_times
                    } else {
                        gameMap.set(item.name, {
                            local_times: item.local_times,
                            pool_times: item.pool_times,
                        })
                    }
                }
            }

            const merged = Array.from(gameMap.entries())
                .map(([name, data]) => ({ name, ...data }))
                .sort((a, b) => b.local_times - a.local_times)
                .slice(0, MAX_GAMES)

            setGames(merged)
            hasLoadedOnce.current = true
        } catch {
            if (!hasLoadedOnce.current) {
                setGames([])
            }
        } finally {
            setLoading(false)
        }
    }, [cafes])

    useEffect(() => {
        fetchTopGames()
    }, [fetchTopGames])

    useEffect(() => {
        if (refreshSignal !== prevSignal.current) {
            prevSignal.current = refreshSignal
            fetchTopGames()
        }
    }, [refreshSignal, fetchTopGames])

    return (
        <Card>
            <div className="flex items-center justify-between">
                <h4>Top Games Today</h4>
            </div>
            <div className="mt-5">
                {loading && games.length === 0 && (
                    <div className="text-center text-gray-400 py-4 text-sm">
                        Loading…
                    </div>
                )}
                {!loading && games.length === 0 && (
                    <div className="text-center text-gray-400 py-4 text-sm">
                        No game data today.
                    </div>
                )}
                {games.map((game, index) => (
                    <div
                        key={game.name}
                        className={classNames(
                            'flex items-center justify-between py-2 dark:border-gray-600 transition-all duration-300 ease-in-out',
                            !isLastChild(games, index) && 'mb-2',
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center w-[40px] h-[40px] rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                                <TbDeviceGamepad2 className="text-lg" />
                            </div>
                            <div>
                                <div className="heading-text font-bold">
                                    {game.name}
                                </div>
                                <div className="text-xs text-gray-500 transition-all duration-300">
                                    Clicks: {game.local_times}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    )
}

export default TopGames
