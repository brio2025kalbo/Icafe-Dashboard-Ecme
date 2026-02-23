import type { ReactNode } from 'react'
import { Spinner } from '@/components/ui'
import useCountUp from '@/hooks/useCountUp'

type Props = {
    label: string
    value: number          // raw numeric value — formatted internally
    icon: ReactNode
    iconBg?: string
    loading?: boolean
    prefix?: string
    size?: 'sm' | 'md'
}

function formatCurrency(val: number): string {
    return val.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })
}

const ShiftStatCard = ({
    label,
    value,
    icon,
    iconBg = 'bg-blue-100 text-blue-600',
    loading,
    prefix,
    size = 'md',
}: Props) => {
    const animated = useCountUp(loading ? 0 : value)

    const valueClass = size === 'sm'
        ? 'text-lg font-bold text-gray-900 dark:text-white break-all'
        : 'text-2xl font-bold text-gray-900 dark:text-white break-all'
    const prefixClass = size === 'sm'
        ? 'text-sm font-semibold mr-0.5'
        : 'text-base font-semibold mr-0.5'
    const iconSize = size === 'sm'
        ? 'w-7 h-7 text-base'
        : 'w-8 h-8 text-lg'

    return (
        <div className="flex flex-col gap-1 p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 min-w-0">
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide leading-tight">
                    {label}
                </span>
                <span className={`flex items-center justify-center rounded-full flex-shrink-0 ${iconSize} ${iconBg}`}>
                    {icon}
                </span>
            </div>
            {loading ? (
                <div className="flex items-center gap-2 h-7">
                    <Spinner size={18} />
                    <span className="text-xs text-gray-400">Loading…</span>
                </div>
            ) : (
                <div className={valueClass}>
                    {prefix && <span className={prefixClass}>{prefix}</span>}
                    {formatCurrency(animated)}
                </div>
            )}
        </div>
    )
}

export default ShiftStatCard
