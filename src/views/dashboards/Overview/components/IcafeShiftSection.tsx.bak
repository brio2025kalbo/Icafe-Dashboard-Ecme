import { useState, useEffect, useRef, useCallback } from 'react'
import { TbRefresh } from 'react-icons/tb'
import { useCafeStore } from '@/store/cafeStore'
import AllCafesShiftOverview from './AllCafesShiftOverview'
import CafeShiftOverview from './CafeShiftOverview'

const AUTO_REFRESH_SECONDS = 30

const IcafeShiftSection = () => {
    const cafes = useCafeStore((s) => s.cafes)
    const [refreshKey, setRefreshKey] = useState(0)
    const [countdown, setCountdown] = useState(AUTO_REFRESH_SECONDS)
    const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
    const countdownRef = useRef(AUTO_REFRESH_SECONDS)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const triggerRefresh = useCallback(() => {
        countdownRef.current = AUTO_REFRESH_SECONDS
        setCountdown(AUTO_REFRESH_SECONDS)
        setRefreshKey((k) => k + 1)
    }, [])

    // Start/stop the interval based on autoRefreshEnabled
    useEffect(() => {
        if (!autoRefreshEnabled) {
            if (timerRef.current) clearInterval(timerRef.current)
            timerRef.current = null
            countdownRef.current = AUTO_REFRESH_SECONDS
            setCountdown(AUTO_REFRESH_SECONDS)
            return
        }
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
    }, [autoRefreshEnabled])

    // SVG ring progress
    const radius = 8
    const circumference = 2 * Math.PI * radius
    const progress = countdown / AUTO_REFRESH_SECONDS
    const dashOffset = circumference * (1 - progress)

    return (
        <div className="flex flex-col gap-6">
            {/* ── All Cafes Combined ─────────────────────────────────── */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
                {/* Auto-refresh indicator row */}
                <div className="flex items-center justify-end gap-3 mb-3">
                    {/* Toggle switch */}
                    <button
                        role="switch"
                        aria-checked={autoRefreshEnabled}
                        onClick={() => setAutoRefreshEnabled((v) => !v)}
                        title={autoRefreshEnabled ? 'Disable auto-refresh' : 'Enable auto-refresh'}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            autoRefreshEnabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                    >
                        <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                autoRefreshEnabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                        />
                    </button>

                    {autoRefreshEnabled ? (
                        <>
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
                        </>
                    ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                            Auto-refresh off
                        </span>
                    )}

                    {/* Manual refresh button */}
                    <button
                        onClick={triggerRefresh}
                        title="Refresh now"
                        className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-blue-500 transition-colors"
                    >
                        <TbRefresh className="text-base" />
                    </button>
                </div>

                <AllCafesShiftOverview refreshSignal={refreshKey} />
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
                                    cafe={cafe}
                                    showTitle
                                    refreshSignal={refreshKey}
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
