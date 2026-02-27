import useCountUp from '@/hooks/useCountUp'
import Tooltip from '@/components/ui/Tooltip'
import type { ShiftBreakdownRow, ExpenseItem, RefundItem } from '../icafeTypes'
import type { ReactNode } from 'react'

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
    tooltip,
}: {
    value: number
    className?: string
    tooltip?: string | ReactNode
}) => {
    const animated = useCountUp(value)
    const content = <>{'\u20B1'}{fmt(animated)}</>
    if (tooltip) {
        return (
            <td className={`px-3 py-2 text-right whitespace-nowrap ${className ?? ''}`}>
                <Tooltip title={tooltip} placement="top">
                    <span className="cursor-pointer underline decoration-dotted">
                        {content}
                    </span>
                </Tooltip>
            </td>
        )
    }
    return (
        <td className={`px-3 py-2 text-right whitespace-nowrap ${className ?? ''}`}>
            {content}
        </td>
    )
}

/** Build a ReactNode tooltip showing each expense item on its own line */
function buildExpenseTooltip(items?: ExpenseItem[]): ReactNode {
    if (!items || items.length === 0) return undefined
    return (
        <div className="flex flex-col gap-1 text-xs">
            {items.map((item, i) => (
                <div key={`${item.log_details}-${item.log_money}-${i}`} className="flex justify-between gap-3">
                    <span>{item.log_details}</span>
                    <span className="font-semibold whitespace-nowrap">
                        {'\u20B1'}{fmt(Math.abs(parseFloat(item.log_money) || 0))}
                    </span>
                </div>
            ))}
        </div>
    )
}

/** Extract the refund reason from log_details (pattern: "topup from cafe, comment: <reason>") */
function extractRefundReason(logDetails: string): string {
    const marker = 'comment: '
    const idx = logDetails.indexOf(marker)
    if (idx >= 0) {
        const reason = logDetails.slice(idx + marker.length).trim()
        return reason || logDetails
    }
    return logDetails
}

/** Build a ReactNode tooltip showing each refund item on its own line */
function buildRefundTooltip(items?: RefundItem[]): ReactNode {
    if (!items || items.length === 0) return undefined
    return (
        <div className="flex flex-col gap-1 text-xs">
            {items.map((item, i) => (
                <div key={`${item.log_details}-${item.log_money}-${i}`} className="flex flex-col">
                    <div className="flex justify-between gap-3">
                        <span>{extractRefundReason(item.log_details)}</span>
                        <span className="font-semibold whitespace-nowrap">
                            {'\u20B1'}{fmt(Math.abs(parseFloat(item.log_money) || 0))}
                        </span>
                    </div>
                    {item.log_member_account && (
                        <span className="text-gray-400 text-[10px]">
                            Account: {item.log_member_account}
                        </span>
                    )}
                </div>
            ))}
        </div>
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
                                tooltip={buildRefundTooltip(row.refund_items) || row.refund_reason || `Refund: ${'\u20B1'}${fmt(Math.abs(row.refunds))}`}
                            />
                            <AnimatedCell
                                value={row.center_expenses}
                                className={row.center_expenses < 0 ? 'text-orange-500' : 'text-gray-700 dark:text-gray-300'}
                                tooltip={buildExpenseTooltip(row.expense_items) || `Expense: ${'\u20B1'}${fmt(Math.abs(row.center_expenses))}`}
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
