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
    apiGetXeroSettings,
    apiSaveXeroSettings,
    apiGetXeroAuthUrl,
    apiDisconnectXero,
    apiGetXeroAccounts,
    apiGetXeroMappings,
    apiSaveXeroMappings,
    apiSendXeroReport,
    apiGetXeroSchedule,
    apiSaveXeroSchedule,
    apiGetXeroHistory,
    apiGetXeroSchedulerLogs,
} from '@/services/XeroService'
import useSWR, { mutate } from 'swr'
import { useCafeStore } from '@/store/cafeStore'

// ── Types ────────────────────────────────────────────────────────────────────

type XeroSettings = {
    client_id: string
    client_secret: string
    xero_redirect_uri: string
    is_connected: boolean
    tenant_id: string
    tenant_name: string
}

type XeroAuthUrlResponse = {
    auth_url: string
    state: string
}

type XeroAccount = {
    id: string
    name: string
}

type XeroMappings = {
    topups_account: string
    shop_sales_account: string
    refunds_account: string
    center_expenses_account: string
    bank_account: string
}

type XeroSchedule = {
    schedule_type: string
    schedule_time: string
    last_run_date: string
}

type XeroHistoryItem = {
    id: string
    cafe_name: string
    report_date: string
    sent_at: string
    status: string
    sent_by: string
}

type XeroSchedulerLog = {
    id: number
    report_date: string
    run_at: string
    schedule_type: string
    success_count: number
    skip_count: number
    fail_count: number
    details: string
}

type SelectOption = {
    value: string
    label: string
}

// ── Connection Settings Card ─────────────────────────────────────────────────

function ConnectionSettingsCard() {
    const { data, isLoading } = useSWR<XeroSettings>(
        '/xero/settings',
        () => apiGetXeroSettings<XeroSettings>(),
        { revalidateOnFocus: false },
    )

    const [clientId, setClientId] = useState('')
    const [clientSecret, setClientSecret] = useState('')
    const [redirectUri, setRedirectUri] = useState('')
    const [saving, setSaving] = useState(false)
    const [connecting, setConnecting] = useState(false)

    useEffect(() => {
        if (data) {
            setClientId(data.client_id || '')
            setClientSecret(data.client_secret || '')
            setRedirectUri(data.xero_redirect_uri || '')
        }
    }, [data])

    // Handle OAuth callback query parameters on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        if (params.get('xero_connected') === 'true') {
            toast.push(
                <Notification type="success" title="Connected">
                    Successfully connected to Xero!
                </Notification>,
            )
            mutate('/xero/settings')
            mutate('/xero/accounts')
            window.history.replaceState({}, '', window.location.pathname)
        }
        const xeroError = params.get('xero_error')
        if (xeroError) {
            toast.push(
                <Notification type="danger" title="Connection Failed">
                    Xero OAuth error: {xeroError}
                </Notification>,
            )
            window.history.replaceState({}, '', window.location.pathname)
        }
    }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            await apiSaveXeroSettings({
                client_id: clientId,
                client_secret: clientSecret,
                xero_redirect_uri: redirectUri,
            })
            mutate('/xero/settings')
            toast.push(
                <Notification type="success" title="Settings Saved">
                    Xero connection settings saved successfully.
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
            const result = await apiGetXeroAuthUrl<XeroAuthUrlResponse>()
            window.location.href = result.auth_url
        } catch {
            toast.push(
                <Notification type="danger" title="Error">
                    Failed to initiate Xero connection. Make sure you have saved your Client ID, Client Secret, and Redirect URI.
                </Notification>,
            )
            setConnecting(false)
        }
    }

    const handleDisconnect = async () => {
        setConnecting(true)
        try {
            await apiDisconnectXero()
            mutate('/xero/settings')
            mutate('/xero/accounts')
            toast.push(
                <Notification type="success" title="Disconnected">
                    Disconnected from Xero. Tokens have been revoked.
                </Notification>,
            )
        } catch {
            toast.push(
                <Notification type="danger" title="Error">
                    Failed to disconnect from Xero.
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
                        Client ID
                    </label>
                    <Input
                        placeholder="Enter Xero Client ID"
                        value={clientId}
                        onChange={(e) => setClientId((e.target as HTMLInputElement).value)}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Client Secret
                    </label>
                    <Input
                        placeholder="Enter Xero Client Secret"
                        value={clientSecret}
                        type="password"
                        onChange={(e) =>
                            setClientSecret((e.target as HTMLInputElement).value)
                        }
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Redirect URI
                    </label>
                    <Input
                        placeholder="e.g. http://localhost:3000/api/xero/callback"
                        value={redirectUri}
                        onChange={(e) =>
                            setRedirectUri((e.target as HTMLInputElement).value)
                        }
                    />
                </div>
                {isConnected && data?.tenant_name && (
                    <div className="text-sm text-gray-500">
                        Connected to organisation:{' '}
                        <strong>{data.tenant_name}</strong>
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
                            Connect to Xero
                        </Button>
                    )}
                </div>
            </div>
        </Card>
    )
}

// ── Account Mappings Card ────────────────────────────────────────────────────

function AccountMappingsCard() {
    const { data: settings } = useSWR<XeroSettings>(
        '/xero/settings',
        () => apiGetXeroSettings<XeroSettings>(),
        { revalidateOnFocus: false },
    )

    const isConnected = settings?.is_connected ?? false

    const { data: accounts } = useSWR<XeroAccount[]>(
        isConnected ? '/xero/accounts' : null,
        () => apiGetXeroAccounts<XeroAccount[]>(),
        { revalidateOnFocus: false },
    )

    const { data: mappings } = useSWR<XeroMappings>(
        '/xero/mappings',
        () => apiGetXeroMappings<XeroMappings>(),
        { revalidateOnFocus: false },
    )

    const [topups, setTopups] = useState('')
    const [shopSales, setShopSales] = useState('')
    const [refunds, setRefunds] = useState('')
    const [centerExpenses, setCenterExpenses] = useState('')
    const [bankAccount, setBankAccount] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (mappings) {
            setTopups(mappings.topups_account || '')
            setShopSales(mappings.shop_sales_account || '')
            setRefunds(mappings.refunds_account || '')
            setCenterExpenses(mappings.center_expenses_account || '')
            setBankAccount(mappings.bank_account || '')
        }
    }, [mappings])

    const accountOptions: SelectOption[] = (accounts || []).map((a) => ({
        value: a.id,
        label: a.name,
    }))

    const handleSave = async () => {
        setSaving(true)
        try {
            await apiSaveXeroMappings({
                topups_account: topups,
                shop_sales_account: shopSales,
                refunds_account: refunds,
                center_expenses_account: centerExpenses,
                bank_account: bankAccount,
            })
            mutate('/xero/mappings')
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
                    Connect to Xero first to load your Chart of Accounts.
                </p>
            ) : (
                <div className="flex flex-col gap-4">
                    {accountOptions.length === 0 ? (
                        <p className="text-gray-500">Loading accounts from Xero...</p>
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
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Clearing / Offset Account
                                </label>
                                <p className="text-xs text-gray-500 mb-1">
                                    The balancing debit line for net income. Must be a non-bank account (e.g. Trade Debtors, Clearing). Bank accounts are excluded — they cannot be used in Xero Manual Journals.
                                </p>
                                <Select
                                    placeholder="Select Clearing or Offset account"
                                    options={accountOptions}
                                    value={
                                        accountOptions.find(
                                            (o) => o.value === bankAccount,
                                        ) || null
                                    }
                                    onChange={(opt) =>
                                        setBankAccount(
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
    const [forceResend, setForceResend] = useState(false)
    const [sending, setSending] = useState(false)

    const cafeOptions: SelectOption[] = cafes.map((c) => ({
        value: c.id,
        label: c.name,
    }))

    const handleSend = async () => {
        if (!selectedCafe || !reportDate) return
        setSending(true)
        try {
            const y = reportDate.getFullYear()
            const m = String(reportDate.getMonth() + 1).padStart(2, '0')
            const d = String(reportDate.getDate()).padStart(2, '0')
            const dateStr = `${y}-${m}-${d}`
            const result = await apiSendXeroReport<{
                ok: boolean
                totals?: { top_ups: number; shop_sales: number; refunds: number; center_expenses: number }
            }>({ cafe_id: selectedCafe, report_date: dateStr, force: forceResend })
            mutate('/xero/history')
            const totals = result.totals
            toast.push(
                <Notification type="success" title="Report Sent to Xero">
                    {totals
                        ? `Top-ups: ${totals.top_ups.toFixed(2)}, Shop Sales: ${totals.shop_sales.toFixed(2)}, Refunds: ${totals.refunds.toFixed(2)}, Expenses: ${totals.center_expenses.toFixed(2)}`
                        : 'Daily report manual journal created in Xero.'}
                </Notification>,
            )
            setForceResend(false)
        } catch (err: unknown) {
            const errorMsg =
                err && typeof err === 'object' && 'response' in err
                    ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to send report.')
                    : 'Failed to send report.'
            toast.push(
                <Notification type="danger" title="Error">
                    {errorMsg}
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
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                        type="checkbox"
                        className="w-4 h-4"
                        checked={forceResend}
                        onChange={(e) => setForceResend(e.target.checked)}
                    />
                    Force re-send (override duplicate check)
                </label>
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
    const { data: schedule } = useSWR<XeroSchedule>(
        '/xero/schedule',
        () => apiGetXeroSchedule<XeroSchedule>(),
        { revalidateOnFocus: false },
    )

    const { data: schedulerLogs } = useSWR<XeroSchedulerLog[]>(
        '/xero/scheduler-logs',
        () => apiGetXeroSchedulerLogs<XeroSchedulerLog[]>(),
        { revalidateOnFocus: false, refreshInterval: 60000 },
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
            await apiSaveXeroSchedule({
                schedule_type: scheduleType,
                schedule_time:
                    scheduleType === 'daily_at_time'
                        ? scheduleTime
                        : undefined,
            })
            mutate('/xero/schedule')
            toast.push(
                <Notification type="success" title="Schedule Saved">
                    Automated report schedule saved. Times use
                    Philippines timezone (Asia/Manila).
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
                            Time (Philippines timezone)
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
                {schedule?.last_run_date && (
                    <p className="text-sm text-gray-500 mt-2">
                        Last automated run: reports for{' '}
                        <span className="font-medium">
                            {schedule.last_run_date}
                        </span>
                    </p>
                )}
                {schedulerLogs && schedulerLogs.length > 0 && (
                    <div className="mt-4">
                        <h6 className="text-sm font-semibold mb-2">
                            Scheduler Run History
                        </h6>
                        <div className="overflow-auto max-h-64">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left text-xs text-gray-500">
                                        <th className="py-1 px-2">
                                            Report Date
                                        </th>
                                        <th className="py-1 px-2">
                                            Run At
                                        </th>
                                        <th className="py-1 px-2">
                                            Result
                                        </th>
                                        <th className="py-1 px-2">
                                            Details
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {schedulerLogs.map((log) => (
                                        <tr
                                            key={log.id}
                                            className="border-b last:border-0"
                                        >
                                            <td className="py-1 px-2">
                                                {log.report_date}
                                            </td>
                                            <td className="py-1 px-2">
                                                {new Date(
                                                    log.run_at,
                                                ).toLocaleString()}
                                            </td>
                                            <td className="py-1 px-2">
                                                <span className="text-emerald-600">
                                                    {log.success_count}✓
                                                </span>{' '}
                                                <span className="text-gray-400">
                                                    {log.skip_count}⊘
                                                </span>{' '}
                                                {log.fail_count > 0 && (
                                                    <span className="text-red-500">
                                                        {log.fail_count}
                                                        ✗
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-1 px-2 text-xs text-gray-500 whitespace-pre-line">
                                                {log.details}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    )
}

// ── Send History Card ────────────────────────────────────────────────────────

function SendHistoryCard() {
    const { data: history, isLoading } = useSWR<XeroHistoryItem[]>(
        '/xero/history',
        () => apiGetXeroHistory<XeroHistoryItem[]>(),
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
                                <th className="text-left py-2 px-3">Sent By</th>
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
                                    <td className="py-2 px-3">
                                        <Tag
                                            className={
                                                item.sent_by === 'scheduler'
                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300'
                                            }
                                        >
                                            {item.sent_by === 'scheduler'
                                                ? 'Auto'
                                                : 'Manual'}
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

// ── Main Xero Page ───────────────────────────────────────────────────────────

const Xero = () => {
    return (
        <div className="flex flex-col gap-6">
            <h3 className="font-bold">Xero Integration</h3>
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

export default Xero
