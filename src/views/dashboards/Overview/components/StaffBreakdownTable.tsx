import useCountUp from '@/hooks/useCountUp'
import type { ShiftBreakdownRow } from '../icafeTypes'

type Props = {
    rows: ShiftBreakdownRow[]
    loading?: boolean
}

function fmt(val: number): string {
    return val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtTime(t: string): string {
    if (!t || t === '-') return '—'
    const parts = t.split(' ')
    if (parts.length === 2) return parts[1].slice(0, 5)
    return t.slice(0, 5)
}

// Animated cell for a single numeric value
const AnimatedCell = ({
    value,
    className,
}: {
    value: number
    className?: string
}) => {
    const animated = useCountUp(value)
    return (
        <td className={`px-3 py-2 text-right whitespace-nowrap ${className ?? ''}`}>
            ₱{fmt(animated)}
        </td>
    )
}

const StaffBreakdownTable = ({ rows, loading }: Props) => {
    if (loading) {
        return (
            <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="animate-pulse bg-gray-100 dark:bg-gray-800 h-32 w-full" />
            </div>
        )
    }

    if (!rows || rows.length === 0) return null

    return (
        <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
            <table className="w-full text-xs">
                <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        <th className="text-left px-3 py-2 font-semibold">Staff</th>
                        <th className="text-left px-3 py-2 font-semibold">Shift</th>
                        <th className="text-right px-3 py-2 font-semibold">Top-ups</th>
                        <th className="text-right px-3 py-2 font-semibold">Shop Sales</th>
                        <th className="text-right px-3 py-2 font-semibold">Refunds</th>
                        <th className="text-right px-3 py-2 font-semibold">Expenses</th>
                        <th className="text-right px-3 py-2 font-semibold">Profit</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {rows.map((row, i) => (
                        <tr
                            key={String(row.shift_id ?? i)}
                            className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                            <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                    {row.is_active && (
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" title="Active shift" />
                                    )}
                                    {row.staff_name}
                                </div>
                            </td>
                            <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                {fmtTime(row.start_time)}
                                {' – '}
                                {row.is_active
                                    ? <span className="text-green-500 font-medium">Active</span>
                                    : fmtTime(row.end_time)
                                }
                            </td>
                            <AnimatedCell
                                value={row.top_ups}
                                className="text-gray-700 dark:text-gray-300"
                            />
                            <AnimatedCell
                                value={row.shop_sales}
                                className="text-gray-700 dark:text-gray-300"
                            />
                            <AnimatedCell
                                value={row.refunds}
                                className={row.refunds < 0 ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}
                            />
                            <AnimatedCell
                                value={row.center_expenses}
                                className={row.center_expenses < 0 ? 'text-orange-500' : 'text-gray-700 dark:text-gray-300'}
                            />
                            <AnimatedCell
                                value={row.total_profit}
                                className="font-semibold text-emerald-600 dark:text-emerald-400"
                            />
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

export default StaffBreakdownTable
