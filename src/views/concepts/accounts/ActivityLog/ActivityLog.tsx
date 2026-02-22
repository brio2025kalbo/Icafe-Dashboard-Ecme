import { useState, useEffect, useCallback } from 'react'
import AdaptiveCard from '@/components/shared/AdaptiveCard'
import Timeline from '@/components/ui/Timeline'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import Badge from '@/components/ui/Badge'
import dayjs from 'dayjs'
import { TOKEN_NAME_IN_STORAGE } from '@/constants/api.constant'

type LogEntry = {
    id: number
    action: string
    detail: string | null
    ip_address: string | null
    created_at: string
    username: string | null
    email: string | null
    role: string | null
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
    sign_in:          { label: 'Signed In',          color: 'bg-emerald-100 text-emerald-700' },
    sign_out:         { label: 'Signed Out',          color: 'bg-gray-100 text-gray-600' },
    sign_in_failed:   { label: 'Login Failed',        color: 'bg-red-100 text-red-700' },
    sign_up:          { label: 'Registered',          color: 'bg-blue-100 text-blue-700' },
    change_password:  { label: 'Password Changed',    color: 'bg-amber-100 text-amber-700' },
    update_profile:   { label: 'Profile Updated',     color: 'bg-indigo-100 text-indigo-700' },
    create_cafe:      { label: 'Cafe Added',          color: 'bg-purple-100 text-purple-700' },
    update_cafe:      { label: 'Cafe Updated',        color: 'bg-purple-100 text-purple-700' },
    delete_cafe:      { label: 'Cafe Deleted',        color: 'bg-red-100 text-red-700' },
    create_user:      { label: 'User Created',        color: 'bg-blue-100 text-blue-700' },
    update_user:      { label: 'User Updated',        color: 'bg-indigo-100 text-indigo-700' },
    delete_user:      { label: 'User Deleted',        color: 'bg-red-100 text-red-700' },
}

const PAGE_SIZE = 20

const ActivityLog = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [offset, setOffset] = useState(0)
    const [hasMore, setHasMore] = useState(true)

    const fetchLogs = useCallback(async (currentOffset: number) => {
        setIsLoading(true)
        try {
            const token = localStorage.getItem(TOKEN_NAME_IN_STORAGE) || ''
            const res = await fetch(
                `/api/activity-log?limit=${PAGE_SIZE}&offset=${currentOffset}`,
                { headers: { Authorization: `Bearer ${token}` } }
            )
            const data = await res.json()
            if (data.ok) {
                setLogs((prev) => currentOffset === 0 ? data.logs : [...prev, ...data.logs])
                setHasMore(data.logs.length === PAGE_SIZE)
            }
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchLogs(0)
    }, [fetchLogs])

    const handleLoadMore = () => {
        const newOffset = offset + PAGE_SIZE
        setOffset(newOffset)
        fetchLogs(newOffset)
    }

    // Group logs by date
    const grouped = logs.reduce<Record<string, LogEntry[]>>((acc, log) => {
        const day = dayjs(log.created_at).format('YYYY-MM-DD')
        if (!acc[day]) acc[day] = []
        acc[day].push(log)
        return acc
    }, {})

    return (
        <AdaptiveCard>
            <div className="max-w-[800px] mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h3>Activity Log</h3>
                    <Button size="sm" variant="plain" onClick={() => { setOffset(0); fetchLogs(0) }}>
                        Refresh
                    </Button>
                </div>

                {isLoading && logs.length === 0 ? (
                    <div className="flex justify-center py-12">
                        <Spinner size={40} />
                    </div>
                ) : logs.length === 0 ? (
                    <p className="text-center text-gray-400 py-12">No activity recorded yet.</p>
                ) : (
                    <>
                        {Object.entries(grouped).map(([day, entries]) => (
                            <div key={day} className="mb-8">
                                <div className="mb-4 font-semibold uppercase text-sm text-gray-500">
                                    {dayjs(day).format('dddd, DD MMMM YYYY')}
                                </div>
                                <Timeline>
                                    {entries.map((log) => {
                                        const meta = ACTION_LABELS[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-600' }
                                        return (
                                            <Timeline.Item key={log.id}>
                                                <div className="flex flex-col gap-1 mt-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.color}`}>
                                                            {meta.label}
                                                        </span>
                                                        {log.username && (
                                                            <span className="text-sm font-medium">{log.username}</span>
                                                        )}
                                                        {log.role && (
                                                            <span className="text-xs text-gray-400 capitalize">({log.role})</span>
                                                        )}
                                                    </div>
                                                    {log.detail && (
                                                        <p className="text-xs text-gray-500">{log.detail}</p>
                                                    )}
                                                    <div className="flex items-center gap-3 text-xs text-gray-400">
                                                        <span>{dayjs(log.created_at).format('HH:mm:ss')}</span>
                                                        {log.ip_address && <span>IP: {log.ip_address}</span>}
                                                    </div>
                                                </div>
                                            </Timeline.Item>
                                        )
                                    })}
                                </Timeline>
                            </div>
                        ))}

                        <div className="text-center mt-4">
                            {hasMore ? (
                                <Button loading={isLoading} onClick={handleLoadMore}>
                                    Load More
                                </Button>
                            ) : (
                                <span className="text-sm text-gray-400">No more activity to load</span>
                            )}
                        </div>
                    </>
                )}
            </div>
        </AdaptiveCard>
    )
}

export default ActivityLog
