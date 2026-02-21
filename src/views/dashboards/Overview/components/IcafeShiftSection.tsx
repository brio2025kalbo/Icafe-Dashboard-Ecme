import { useState, useEffect, useRef, useCallback } from 'react'
import { TbRefresh } from 'react-icons/tb'
import { useCafeStore } from '@/store/cafeStore'
import AllCafesShiftOverview from './AllCafesShiftOverview'
import CafeShiftOverview from './CafeShiftOverview'

const AUTO_REFRESH_SECONDS = 30

/**
 * IcafeShiftSection
 *
 * Renders:
 *  1. A combined "All Cafes" stat-card block with period tabs.
 *  2. One individual stat-card block per configured cafe.
 *
 * Auto-refreshes every AUTO_REFRESH_SECONDS seconds while the page is visible.
 * A countdown ring + manual refresh button is shown in the section header.
 */
const IcafeShiftSection = () => {
    const cafes = useCafeStore((s) => s.cafes)
    const [refreshKey, setRefreshKey] = useState(0)
    const [countdown, setCountdown] = useState(AUTO_REFRESH_SECONDS)
    const countdownRef = useRef(AUTO_REFRESH_SECONDS)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const triggerRefresh = useCallback(() => {
        countdownRef.current = AUTO_REFRESH_SECONDS
        setCountdown(AUTO_REFRESH_SECONDS)
        setRefreshKey((k) => k + 1)
    }, [])

    // Tick every second; auto-refresh when countdown hits 0
    useEffect(() => {
        timerRef.current = setInterval(() => {
            countdownRef.current -= 1
            setCountdown(countdownRef.current)
            if (countdownRef.current <= 0) {
                countdownRef.current = AUTO_REFRESH_SECONDS
                setCountdown(AUTO_REFRESH_SECONDS)
                setRefreshKey((k) => k + 1)
            }
        }, 1000)
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [])

    // SVG ring progress (countdown / total → stroke-dashoffset)
    const radius = 8
    const circumference = 2 * Math.PI * radius
    const progress = countdown / AUTO_REFRESH_SECONDS
    const dashOffset = circumference * (1 - progress)

    return (
        <div className="flex flex-col gap-6">
            {/* ── All Cafes Combined ─────────────────────────────────── */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
                {/* Auto-refresh indicator row */}
                <div className="flex items-center justify-end gap-2 mb-3">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                        Auto-refresh in {countdown}s
                    </span>
                    {/* Countdown ring */}
                    <svg width="20" height="20" className="rotate-[-90deg]">
                        <circle
                            cx="10" cy="10" r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="text-gray-200 dark:text-gray-700"
                        />
                        <circle
                            cx="10" cy="10" r={radius}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                            strokeLinecap="round"
                            className="text-blue-500 transition-all duration-1000 ease-linear"
                        />
                    </svg>
                    {/* Manual refresh button */}
                    <button
                        onClick={triggerRefresh}
                        title="Refresh now"
                        className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-500 transition-colors"
                    >
                        <TbRefresh className="text-base" />
                    </button>
                </div>

                <AllCafesShiftOverview key={`all-${refreshKey}`} />
            </div>

            {/* ── Per-Cafe Breakdown ─────────────────────────────────── */}
            {cafes.length > 0 && (
                <div className="flex flex-col gap-4">
                    <h6 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1">
                        Individual Cafe Overview
                    </h6>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {cafes.map((cafe) => (
                            <div
                                key={cafe.id}
                                className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-700"
                            >
                                <CafeShiftOverview
                                    key={`${cafe.id}-${refreshKey}`}
                                    cafe={cafe}
                                    showTitle
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default IcafeShiftSection
