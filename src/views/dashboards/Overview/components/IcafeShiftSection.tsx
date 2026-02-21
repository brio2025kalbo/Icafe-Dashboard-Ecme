import { useCafeStore } from '@/store/cafeStore'
import AllCafesShiftOverview from './AllCafesShiftOverview'
import CafeShiftOverview from './CafeShiftOverview'

/**
 * IcafeShiftSection
 *
 * Renders:
 *  1. A combined "All Cafes" stat-card block (total profit, top-ups, shop sales, center expenses)
 *     with Daily / Weekly / Monthly / Yearly period tabs.
 *  2. One individual stat-card block per configured cafe, each with its own period tabs.
 *
 * No charts — pure stat cards only.
 */
const IcafeShiftSection = () => {
    const cafes = useCafeStore((s) => s.cafes)

    return (
        <div className="flex flex-col gap-6">
            {/* ── All Cafes Combined ─────────────────────────────────── */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
                <AllCafesShiftOverview />
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
                                <CafeShiftOverview cafe={cafe} showTitle />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export default IcafeShiftSection
