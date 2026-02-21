import type { ReactNode } from 'react'
import { Spinner } from '@/components/ui'

type Props = {
    label: string
    value: string | number
    icon: ReactNode
    iconBg?: string
    loading?: boolean
    prefix?: string
}

const ShiftStatCard = ({ label, value, icon, iconBg = 'bg-blue-100 text-blue-600', loading, prefix }: Props) => {
    return (
        <div className="flex flex-col gap-1 p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 min-w-0">
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    {label}
                </span>
                <span className={`w-8 h-8 flex items-center justify-center rounded-full text-lg ${iconBg}`}>
                    {icon}
                </span>
            </div>
            {loading ? (
                <div className="flex items-center gap-2 h-8">
                    <Spinner size={20} />
                    <span className="text-xs text-gray-400">Loading…</span>
                </div>
            ) : (
                <div className="text-2xl font-bold text-gray-900 dark:text-white truncate">
                    {prefix && <span className="text-base font-semibold mr-0.5">{prefix}</span>}
                    {value}
                </div>
            )}
        </div>
    )
}

export default ShiftStatCard
