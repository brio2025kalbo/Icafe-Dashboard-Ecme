import { useState, useEffect, useCallback, useRef } from 'react'
import Card from '@/components/ui/Card'
import classNames from '@/utils/classNames'
import isLastChild from '@/utils/isLastChild'
import { TbDeviceGamepad2 } from 'react-icons/tb'
import { useCafeStore } from '@/store/cafeStore'
import {
    apiGetReportData,
    apiGetCafeGames,
    apiGetGamePosterBlob,
} from '@/services/ReportsService'
import { getDateRange } from '../utils/periodUtils'
import type { GameItem, ReportDataWithGames } from '../icafeTypes'

const MAX_GAMES = 10

type GameWithPoster = GameItem & { poster?: string }

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

            // Fetch report data and games catalog in parallel
            const [reportResults, catalogResults] = await Promise.all([
                Promise.allSettled(
                    validCafes.map((c) =>
                        apiGetReportData<ReportDataWithGames>(c.id, {
                            date_start: range.date_start,
                            date_end: range.date_end,
                            time_start: range.time_start,
                            time_end: range.time_end,
                        }),
                    ),
                ),
                Promise.allSettled(
                    validCafes.map((c) => apiGetCafeGames(c.id)),
                ),
            ])

            // Build a case-insensitive name → { gameId, cafeId } lookup
            // from the games catalog so we can resolve poster URLs
            const gameIdMap = new Map<
                string,
                { gameId: number; cafeId: string }
            >()
            catalogResults.forEach((result, idx) => {
                if (result.status !== 'fulfilled') return
                for (const g of result.value) {
                    const key = String(g.game_name ?? '')
                        .trim()
                        .toLowerCase()
                    if (key && g.game_id && !gameIdMap.has(key)) {
                        gameIdMap.set(key, {
                            gameId: g.game_id,
                            cafeId: validCafes[idx].id,
                        })
                    }
                }
            })

            // Merge games across all cafes
            const gameMap = new Map<
                string,
                { local_times: number; pool_times: number }
            >()
            for (const result of reportResults) {
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

            const topGames = Array.from(gameMap.entries())
                .map(([name, data]) => ({ name, ...data }))
                .sort((a, b) => b.local_times - a.local_times)
                .slice(0, MAX_GAMES)

            // Fetch poster blob URLs by looking up game_id from catalog
            const posterPromises = topGames.map(async (game) => {
                const key = game.name.trim().toLowerCase()
                const info = gameIdMap.get(key)
                if (!info) return null

                const cacheKey = `${info.cafeId}:${info.gameId}`
                const cached = posterCache.current.get(cacheKey)
                if (cached !== undefined) return cached

                const blobUrl = await apiGetGamePosterBlob(
                    info.cafeId,
                    info.gameId,
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
