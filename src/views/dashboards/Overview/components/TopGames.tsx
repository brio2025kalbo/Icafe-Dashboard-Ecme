import { useState, useEffect, useCallback, useRef } from 'react'
import Card from '@/components/ui/Card'
import classNames from '@/utils/classNames'
import isLastChild from '@/utils/isLastChild'
import { TbDeviceGamepad2 } from 'react-icons/tb'
import { useCafeStore } from '@/store/cafeStore'
import {
    apiGetReportData,
    apiGetGamePosterBlob,
} from '@/services/ReportsService'
import { getDateRange } from '../utils/periodUtils'
import type { GameItem, ReportDataWithGames } from '../icafeTypes'

const MAX_GAMES = 10

type GameWithPoster = GameItem & { poster?: string; cafeId?: string }

const GamePoster = ({ poster, name }: { poster?: string; name: string }) => {
    const [failed, setFailed] = useState(false)

    if (poster && !failed) {
        return (
            <img
                src={poster}
                alt={name}
                className="w-[40px] h-[40px] rounded-full object-cover"
                onError={() => setFailed(true)}
            />
        )
    }

    return (
        <div className="flex items-center justify-center w-[40px] h-[40px] rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
            <TbDeviceGamepad2 className="text-lg" />
        </div>
    )
}

const TopGames = ({ refreshSignal = 0 }: { refreshSignal?: number }) => {
    const cafes = useCafeStore((s) => s.cafes)
    const [games, setGames] = useState<GameWithPoster[]>([])
    const [loading, setLoading] = useState(false)
    const prevSignal = useRef(refreshSignal)
    const hasLoadedOnce = useRef(false)
    const posterCache = useRef(new Map<string, string | null>())

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

            const reportResults = await Promise.allSettled(
                validCafes.map((c) =>
                    apiGetReportData<ReportDataWithGames>(c.id, {
                        date_start: range.date_start,
                        date_end: range.date_end,
                        time_start: range.time_start,
                        time_end: range.time_end,
                    }),
                ),
            )

            // Merge games across all cafes, keeping pkg_id and cafeId for poster fetch
            const gameMap = new Map<
                string,
                { local_times: number; pool_times: number; pkg_id?: number; cafeId?: string }
            >()
            reportResults.forEach((result, idx) => {
                if (result.status !== 'fulfilled') return
                const gameList = result.value.data?.game
                if (!Array.isArray(gameList)) return
                for (const item of gameList) {
                    const existing = gameMap.get(item.name)
                    if (existing) {
                        existing.local_times += item.local_times
                        existing.pool_times += item.pool_times
                        // Keep the first pkg_id found
                        if (!existing.pkg_id && item.pkg_id) {
                            existing.pkg_id = item.pkg_id
                            existing.cafeId = validCafes[idx].id
                        }
                    } else {
                        gameMap.set(item.name, {
                            local_times: item.local_times,
                            pool_times: item.pool_times,
                            pkg_id: item.pkg_id,
                            cafeId: item.pkg_id ? validCafes[idx].id : undefined,
                        })
                    }
                }
            })

            const topGames = Array.from(gameMap.entries())
                .map(([name, data]) => ({ name, ...data }))
                .sort((a, b) => b.local_times - a.local_times)
                .slice(0, MAX_GAMES)

            // Fetch poster blob URLs using pkg_id directly
            const posterPromises = topGames.map(async (game) => {
                if (!game.pkg_id || !game.cafeId) return null

                const cacheKey = `${game.cafeId}:${game.pkg_id}`
                const cached = posterCache.current.get(cacheKey)
                if (cached !== undefined) return cached

                const blobUrl = await apiGetGamePosterBlob(
                    game.cafeId,
                    game.pkg_id,
                )
                posterCache.current.set(cacheKey, blobUrl)
                return blobUrl
            })

            const posters = await Promise.all(posterPromises)

            const gamesWithPosters: GameWithPoster[] = topGames.map(
                (game, idx) => ({
                    ...game,
                    poster: posters[idx] ?? undefined,
                }),
            )

            setGames(gamesWithPosters)
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

    // Revoke blob URLs on unmount to prevent memory leaks
    useEffect(() => {
        const cache = posterCache.current
        return () => {
            for (const url of cache.values()) {
                if (url) URL.revokeObjectURL(url)
            }
            cache.clear()
        }
    }, [])

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
                            <GamePoster
                                poster={game.poster}
                                name={game.name}
                            />
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
