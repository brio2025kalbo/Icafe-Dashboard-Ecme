import { useState, useEffect, useCallback } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import DatePicker from '@/components/ui/DatePicker'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import Badge from '@/components/ui/Badge'
import Tag from '@/components/ui/Tag'
import {
    apiGetQBSettings,
    apiSaveQBSettings,
    apiGetQBAuthUrl,
    apiDisconnectQB,
    apiGetQBAccounts,
    apiGetQBMappings,
    apiSaveQBMappings,
    apiSendQBReport,
    apiGetQBSchedule,
    apiSaveQBSchedule,
    apiGetQBHistory,
} from '@/services/QuickBooksService'
import useSWR, { mutate } from 'swr'
import { useCafeStore } from '@/store/cafeStore'

// ── Types ────────────────────────────────────────────────────────────────────

type QBSettings = {
    qb_client_id: string
    qb_client_secret: string
    qb_redirect_uri: string
    is_connected: boolean
    realm_id: string
}

type QBAuthUrlResponse = {
    auth_url: string
    state: string
}

type QBAccount = {
    id: string
    name: string
}

type QBMappings = {
    topups_account: string
    shop_sales_account: string
    refunds_account: string
    center_expenses_account: string
}

type QBSchedule = {
    schedule_type: string
    schedule_time: string
}

type QBHistoryItem = {
    id: string
    cafe_name: string
    report_date: string
    sent_at: string
    status: string
}

type SelectOption = {
    value: string
    label: string
}

// ── Connection Settings Card ─────────────────────────────────────────────────

function ConnectionSettingsCard() {
    const { data, isLoading } = useSWR<QBSettings>(
        '/quickbooks/settings',
        () => apiGetQBSettings<QBSettings>(),
        { revalidateOnFocus: false },
    )

    const [clientId, setClientId] = useState('')
    const [clientSecret, setClientSecret] = useState('')
    const [redirectUri, setRedirectUri] = useState('')
    const [saving, setSaving] = useState(false)
    const [connecting, setConnecting] = useState(false)

    useEffect(() => {
        if (data) {
            setClientId(data.qb_client_id || '')
            setClientSecret(data.qb_client_secret || '')
            setRedirectUri(data.qb_redirect_uri || '')
        }
    }, [data])

    // Handle OAuth callback query parameters on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        if (params.get('qb_connected') === 'true') {
            toast.push(
                <Notification type="success" title="Connected">
                    Successfully connected to QuickBooks!
                </Notification>,
            )
            mutate('/quickbooks/settings')
            mutate('/quickbooks/accounts')
            // Clean up URL
            window.history.replaceState({}, '', window.location.pathname)
        }
        const qbError = params.get('qb_error')
        if (qbError) {
            toast.push(
                <Notification type="danger" title="Connection Failed">
                    QuickBooks OAuth error: {qbError}
                </Notification>,
            )
            window.history.replaceState({}, '', window.location.pathname)
        }
    }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            await apiSaveQBSettings({
                qb_client_id: clientId,
                qb_client_secret: clientSecret,
                qb_redirect_uri: redirectUri,
            })
            mutate('/quickbooks/settings')
            toast.push(
                <Notification type="success" title="Settings Saved">
                    QuickBooks connection settings saved successfully.
                </Notification>,
            )
        } catch {
            toast.push(
                <Notification type="danger" title="Error">
                    Failed to save settings.
                </Notification>,
            )
        }
        setSaving(false)
    }

    const handleConnect = async () => {
        setConnecting(true)
        try {
            const result = await apiGetQBAuthUrl<QBAuthUrlResponse>()
            // Redirect the user to QuickBooks OAuth authorization page
            window.location.href = result.auth_url
        } catch {
            toast.push(
                <Notification type="danger" title="Error">
                    Failed to initiate QuickBooks connection. Make sure you have saved your Client ID, Client Secret, and Redirect URI.
                </Notification>,
            )
            setConnecting(false)
        }
    }

    const handleDisconnect = async () => {
        setConnecting(true)
        try {
            await apiDisconnectQB()
            mutate('/quickbooks/settings')
            mutate('/quickbooks/accounts')
            toast.push(
                <Notification type="success" title="Disconnected">
                    Disconnected from QuickBooks. Tokens have been revoked.
                </Notification>,
            )
        } catch {
            toast.push(
                <Notification type="danger" title="Error">
                    Failed to disconnect from QuickBooks.
                </Notification>,
            )
        }
        setConnecting(false)
    }

    const isConnected = data?.is_connected ?? false

    return (
        <Card
            header={{
                content: (
                    <div className="flex items-center justify-between w-full">
                        <h5>Connection Settings</h5>
                        {isConnected ? (
                            <Badge className="bg-emerald-500">Connected</Badge>
                        ) : (
                            <Badge className="bg-red-500">Disconnected</Badge>
                        )}
                    </div>
                ),
                bordered: true,
            }}
        >
            <div className="flex flex-col gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">
                        QB Client ID
                    </label>
                    <Input
                        placeholder="Enter QuickBooks Client ID"
                        value={clientId}
                        onChange={(e) => setClientId((e.target as HTMLInputElement).value)}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">
                        QB Client Secret
                    </label>
                    <Input
                        placeholder="Enter QuickBooks Client Secret"
                        value={clientSecret}
                        type="password"
                        onChange={(e) =>
                            setClientSecret((e.target as HTMLInputElement).value)
                        }
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">
                        QB Redirect URI
                    </label>
                    <Input
                        placeholder="e.g. http://localhost:3000/api/quickbooks/callback"
                        value={redirectUri}
                        onChange={(e) =>
                            setRedirectUri((e.target as HTMLInputElement).value)
                        }
                    />
                </div>
                {isConnected && data?.realm_id && (
                    <div className="text-sm text-gray-500">
                        Connected to Company ID: <strong>{data.realm_id}</strong>
                    </div>
                )}
                <div className="flex gap-2">
                    <Button
                        variant="solid"
                        loading={saving}
                        onClick={handleSave}
                    >
                        Save Settings
                    </Button>
                    {isConnected ? (
                        <Button
                            variant="default"
                            loading={connecting}
                            onClick={handleDisconnect}
                        >
                            Disconnect
                        </Button>
                    ) : (
                        <Button
                            variant="solid"
                            loading={connecting}
                            onClick={handleConnect}
                            disabled={!clientId || !clientSecret || !redirectUri}
                        >
                            Connect to QuickBooks
                        </Button>
                    )}
                </div>
            </div>
        </Card>
    )
}

// ── Account Mappings Card ────────────────────────────────────────────────────

function AccountMappingsCard() {
    const { data: settings } = useSWR<QBSettings>(
        '/quickbooks/settings',
        () => apiGetQBSettings<QBSettings>(),
        { revalidateOnFocus: false },
    )

    const isConnected = settings?.is_connected ?? false

    const { data: accounts } = useSWR<QBAccount[]>(
        isConnected ? '/quickbooks/accounts' : null,
        () => apiGetQBAccounts<QBAccount[]>(),
        { revalidateOnFocus: false },
    )

    const { data: mappings } = useSWR<QBMappings>(
        '/quickbooks/mappings',
        () => apiGetQBMappings<QBMappings>(),
        { revalidateOnFocus: false },
    )

    const [topups, setTopups] = useState('')
    const [shopSales, setShopSales] = useState('')
    const [refunds, setRefunds] = useState('')
    const [centerExpenses, setCenterExpenses] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (mappings) {
            setTopups(mappings.topups_account || '')
            setShopSales(mappings.shop_sales_account || '')
            setRefunds(mappings.refunds_account || '')
            setCenterExpenses(mappings.center_expenses_account || '')
        }
    }, [mappings])

    const accountOptions: SelectOption[] = (accounts || []).map((a) => ({
        value: a.id,
        label: a.name,
    }))

    const handleSave = async () => {
        setSaving(true)
        try {
            await apiSaveQBMappings({
                topups_account: topups,
                shop_sales_account: shopSales,
                refunds_account: refunds,
                center_expenses_account: centerExpenses,
            })
            mutate('/quickbooks/mappings')
            toast.push(
                <Notification type="success" title="Mappings Saved">
                    Account mappings saved successfully.
                </Notification>,
            )
        } catch {
            toast.push(
                <Notification type="danger" title="Error">
                    Failed to save account mappings.
                </Notification>,
            )
        }
        setSaving(false)
    }

    return (
        <Card
            header={{
                content: <h5>Account Mappings</h5>,
                bordered: true,
            }}
        >
            {!isConnected ? (
                <p className="text-gray-500">
                    Connect to QuickBooks first to load your Chart of Accounts.
                </p>
            ) : (
                <div className="flex flex-col gap-4">
                    {accountOptions.length === 0 ? (
                        <p className="text-gray-500">Loading accounts from QuickBooks...</p>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Top-ups Account
                                </label>
                                <Select
                                    placeholder="Select account for Top-ups"
                                    options={accountOptions}
                                    value={accountOptions.find((o) => o.value === topups) || null}
                                    onChange={(opt) =>
                                        setTopups((opt as SelectOption)?.value || '')
                                    }
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Shop Sales Account
                                </label>
                                <Select
                                    placeholder="Select account for Shop Sales"
                                    options={accountOptions}
                                    value={
                                        accountOptions.find((o) => o.value === shopSales) ||
                                        null
                                    }
                                    onChange={(opt) =>
                                        setShopSales((opt as SelectOption)?.value || '')
                                    }
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Refunds Account
                                </label>
                                <Select
                                    placeholder="Select account for Refunds"
                                    options={accountOptions}
                                    value={
                                        accountOptions.find((o) => o.value === refunds) ||
                                        null
                                    }
                                    onChange={(opt) =>
                                        setRefunds((opt as SelectOption)?.value || '')
                                    }
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Center Expenses Account
                                </label>
                                <Select
                                    placeholder="Select account for Center Expenses"
                                    options={accountOptions}
                                    value={
                                        accountOptions.find(
                                            (o) => o.value === centerExpenses,
                                        ) || null
                                    }
                                    onChange={(opt) =>
                                        setCenterExpenses(
                                            (opt as SelectOption)?.value || '',
                                        )
                                    }
                                />
                            </div>
                            <Button
                                variant="solid"
                                loading={saving}
                                onClick={handleSave}
                            >
                                Save Mappings
                            </Button>
                        </>
                    )}
                </div>
            )}
        </Card>
    )
}

// ── Send Daily Report Card ───────────────────────────────────────────────────

function SendDailyReportCard() {
    const { cafes } = useCafeStore()
    const [selectedCafe, setSelectedCafe] = useState('')
    const [reportDate, setReportDate] = useState<Date | null>(null)
    const [sending, setSending] = useState(false)

    const cafeOptions: SelectOption[] = cafes.map((c) => ({
        value: c.id,
        label: c.name,
    }))

    const handleSend = async () => {
        if (!selectedCafe || !reportDate) return
        setSending(true)
        try {
            const dateStr = reportDate.toISOString().split('T')[0]
            await apiSendQBReport({ cafe_id: selectedCafe, report_date: dateStr })
            mutate('/quickbooks/history')
            toast.push(
                <Notification type="success" title="Report Sent">
                    Daily report sent to QuickBooks successfully.
                </Notification>,
            )
        } catch {
            toast.push(
                <Notification type="danger" title="Error">
                    Failed to send report. It may have already been sent for
                    this date.
                </Notification>,
            )
        }
        setSending(false)
    }

    return (
        <Card
            header={{
                content: <h5>Send Daily Report</h5>,
                bordered: true,
            }}
        >
            <div className="flex flex-col gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Select Cafe
                    </label>
                    <Select
                        placeholder="Select a cafe"
                        options={cafeOptions}
                        value={
                            cafeOptions.find(
                                (o) => o.value === selectedCafe,
                            ) || null
                        }
                        onChange={(opt) =>
                            setSelectedCafe(
                                (opt as SelectOption)?.value || '',
                            )
                        }
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Report Date
                    </label>
                    <DatePicker
                        placeholder="Select report date"
                        value={reportDate}
                        onChange={(date) => setReportDate(date)}
                    />
                </div>
                <Button
                    variant="solid"
                    loading={sending}
                    onClick={handleSend}
                    disabled={!selectedCafe || !reportDate}
                >
                    Send Report
                </Button>
            </div>
        </Card>
    )
}

// ── Automated Report Sending Card ────────────────────────────────────────────

const scheduleTypeOptions: SelectOption[] = [
    { value: 'daily_at_time', label: 'Daily at specific time' },
    { value: 'after_business_day', label: 'After business day ends (6 AM)' },
    { value: 'after_last_shift', label: 'After last shift closes' },
]

function AutomatedReportCard() {
    const { data: schedule } = useSWR<QBSchedule>(
        '/quickbooks/schedule',
        () => apiGetQBSchedule<QBSchedule>(),
        { revalidateOnFocus: false },
    )

    const [scheduleType, setScheduleType] = useState('')
    const [scheduleTime, setScheduleTime] = useState('06:00')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (schedule) {
            setScheduleType(schedule.schedule_type || '')
            setScheduleTime(schedule.schedule_time || '06:00')
        }
    }, [schedule])

    const handleSave = async () => {
        setSaving(true)
        try {
            await apiSaveQBSchedule({
                schedule_type: scheduleType,
                schedule_time:
                    scheduleType === 'daily_at_time'
                        ? scheduleTime
                        : undefined,
            })
            mutate('/quickbooks/schedule')
            toast.push(
                <Notification type="success" title="Schedule Saved">
                    Automated report schedule saved.
                </Notification>,
            )
        } catch {
            toast.push(
                <Notification type="danger" title="Error">
                    Failed to save schedule.
                </Notification>,
            )
        }
        setSaving(false)
    }

    return (
        <Card
            header={{
                content: <h5>Automated Report Sending</h5>,
                bordered: true,
            }}
        >
            <div className="flex flex-col gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Schedule Type
                    </label>
                    <Select
                        placeholder="Select schedule type"
                        options={scheduleTypeOptions}
                        value={
                            scheduleTypeOptions.find(
                                (o) => o.value === scheduleType,
                            ) || null
                        }
                        onChange={(opt) =>
                            setScheduleType(
                                (opt as SelectOption)?.value || '',
                            )
                        }
                    />
                </div>
                {scheduleType === 'daily_at_time' && (
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Time
                        </label>
                        <Input
                            type="time"
                            value={scheduleTime}
                            onChange={(e) =>
                                setScheduleTime(
                                    (e.target as HTMLInputElement).value,
                                )
                            }
                        />
                    </div>
                )}
                <Button
                    variant="solid"
                    loading={saving}
                    onClick={handleSave}
                    disabled={!scheduleType}
                >
                    Save Schedule
                </Button>
            </div>
        </Card>
    )
}

// ── Send History Card ────────────────────────────────────────────────────────

function SendHistoryCard() {
    const { data: history, isLoading } = useSWR<QBHistoryItem[]>(
        '/quickbooks/history',
        () => apiGetQBHistory<QBHistoryItem[]>(),
        { revalidateOnFocus: false },
    )

    return (
        <Card
            header={{
                content: <h5>Send History</h5>,
                bordered: true,
            }}
        >
            {isLoading ? (
                <p className="text-gray-500">Loading history...</p>
            ) : !history || history.length === 0 ? (
                <p className="text-gray-500">No reports sent yet.</p>
            ) : (
                <div className="overflow-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 px-3">Cafe</th>
                                <th className="text-left py-2 px-3">
                                    Report Date
                                </th>
                                <th className="text-left py-2 px-3">Sent At</th>
                                <th className="text-left py-2 px-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((item) => (
                                <tr
                                    key={item.id}
                                    className="border-b last:border-0"
                                >
                                    <td className="py-2 px-3">
                                        {item.cafe_name}
                                    </td>
                                    <td className="py-2 px-3">
                                        {item.report_date}
                                    </td>
                                    <td className="py-2 px-3">
                                        {new Date(
                                            item.sent_at,
                                        ).toLocaleString()}
                                    </td>
                                    <td className="py-2 px-3">
                                        <Tag
                                            className={
                                                item.status === 'success'
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                                                    : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                                            }
                                        >
                                            {item.status === 'success'
                                                ? 'Sent'
                                                : 'Failed'}
                                        </Tag>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Card>
    )
}

// ── Main QuickBooks Page ─────────────────────────────────────────────────────

const QuickBooks = () => {
    return (
        <div className="flex flex-col gap-6">
            <h3 className="font-bold">QuickBooks Integration</h3>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ConnectionSettingsCard />
                <AccountMappingsCard />
                <SendDailyReportCard />
                <AutomatedReportCard />
            </div>
            <SendHistoryCard />
        </div>
    )
}

export default QuickBooks
