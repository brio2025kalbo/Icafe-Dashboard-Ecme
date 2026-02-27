import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import DatePicker from '@/components/ui/DatePicker'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import Tag from '@/components/ui/Tag'
import {
    apiGetGSSettings,
    apiSaveGSSettings,
    apiGetGSAuthUrl,
    apiDisconnectGS,
    apiGetGSSheetConfig,
    apiSaveGSSheetConfig,
    apiSendGSReport,
    apiGetGSSchedule,
    apiSaveGSSchedule,
    apiGetGSHistory,
    apiGetGSSchedulerLogs,
} from '@/services/GoogleSheetsService'
import useSWR, { mutate } from 'swr'
import { useCafeStore } from '@/store/cafeStore'

// ── Types ────────────────────────────────────────────────────────────────────

type GSSettings = {
    client_id: string
    client_secret: string
    redirect_uri: string
    is_connected: boolean
}

type GSAuthUrlResponse = {
    auth_url: string
}

type GSSheetConfig = {
    spreadsheet_id: string
    sheet_name: string
}

type GSSchedule = {
    schedule_type: string
    schedule_time: string
    last_run_date: string
}

type GSHistoryItem = {
    id: string
    cafe_name: string
    report_date: string
    sent_at: string
    status: string
    sent_by: string
}

type GSSchedulerLog = {
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
    const { data, isLoading } = useSWR<GSSettings>(
        '/googlesheets/settings',
        () => apiGetGSSettings<GSSettings>(),
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
            setRedirectUri(data.redirect_uri || '')
        }
    }, [data])

    // Handle OAuth callback query parameters on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        if (params.get('gs_connected') === 'true') {
            toast.push(
                <Notification type="success" title="Connected">
                    Successfully connected to Google Sheets!
                </Notification>,
            )
            mutate('/googlesheets/settings')
            window.history.replaceState({}, '', window.location.pathname)
        }
        const gsError = params.get('gs_error')
        if (gsError) {
            toast.push(
                <Notification type="danger" title="Connection Failed">
                    Google Sheets OAuth error: {gsError}
                </Notification>,
            )
            window.history.replaceState({}, '', window.location.pathname)
        }
    }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            await apiSaveGSSettings({
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
            })
            mutate('/googlesheets/settings')
            toast.push(
                <Notification type="success" title="Settings Saved">
                    Google Sheets connection settings saved successfully.
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
            const result = await apiGetGSAuthUrl<GSAuthUrlResponse>()
            window.location.href = result.auth_url
        } catch {
            toast.push(
                <Notification type="danger" title="Error">
                    Failed to initiate Google Sheets connection. Make sure you have saved your Client ID, Client Secret, and Redirect URI.
                </Notification>,
            )
            setConnecting(false)
        }
    }

    const handleDisconnect = async () => {
        setConnecting(true)
        try {
            await apiDisconnectGS()
            mutate('/googlesheets/settings')
            toast.push(
                <Notification type="success" title="Disconnected">
                    Disconnected from Google Sheets. Tokens have been revoked.
                </Notification>,
            )
        } catch {
            toast.push(
                <Notification type="danger" title="Error">
                    Failed to disconnect.
                </Notification>,
            )
        }
        setConnecting(false)
    }

    if (isLoading) {
        return (
            <Card header={{ content: <h5>Connection Settings</h5>, bordered: true }}>
                <p className="text-gray-500">Loading...</p>
            </Card>
        )
    }

    return (
        <Card header={{ content: <h5>Connection Settings</h5>, bordered: true }}>
            <div className="flex flex-col gap-4">
                <p className="text-sm text-gray-500">
                    Create OAuth 2.0 credentials in the{' '}
                    <a
                        href="https://console.cloud.google.com/apis/credentials"
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-500 underline"
                    >
                        Google Cloud Console
                    </a>{' '}
                    and enable the Google Sheets API. Set your Authorized Redirect URI to match the value below.
                </p>
                <div>
                    <label className="block text-sm font-medium mb-1">Client ID</label>
                    <Input
                        placeholder="Google OAuth2 Client ID"
                        value={clientId}
                        onChange={(e) => setClientId((e.target as HTMLInputElement).value)}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Client Secret</label>
                    <Input
                        type="password"
                        placeholder="Google OAuth2 Client Secret"
                        value={clientSecret}
                        onChange={(e) => setClientSecret((e.target as HTMLInputElement).value)}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Redirect URI</label>
                    <Input
                        placeholder="e.g. https://yourdomain.com/api/googlesheets/callback"
                        value={redirectUri}
                        onChange={(e) => setRedirectUri((e.target as HTMLInputElement).value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="solid" loading={saving} onClick={handleSave}>
                        Save Settings
                    </Button>
                    {data?.is_connected ? (
                        <>
                            <Tag className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                                Connected
                            </Tag>
                            <Button
                                variant="default"
                                loading={connecting}
                                onClick={handleDisconnect}
                            >
                                Disconnect
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="solid"
                            loading={connecting}
                            onClick={handleConnect}
                            disabled={!clientId || !clientSecret || !redirectUri}
                        >
                            Connect to Google Sheets
                        </Button>
                    )}
                </div>
            </div>
        </Card>
    )
}

// ── Sheet Configuration Card ─────────────────────────────────────────────────

function SheetConfigCard() {
    const { data: sheetConfig } = useSWR<GSSheetConfig>(
        '/googlesheets/sheet-config',
        () => apiGetGSSheetConfig<GSSheetConfig>(),
        { revalidateOnFocus: false },
    )

    const [spreadsheetId, setSpreadsheetId] = useState('')
    const [sheetName, setSheetName] = useState('Sheet1')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (sheetConfig) {
            setSpreadsheetId(sheetConfig.spreadsheet_id || '')
            setSheetName(sheetConfig.sheet_name || 'Sheet1')
        }
    }, [sheetConfig])

    const handleSave = async () => {
        setSaving(true)
        try {
            await apiSaveGSSheetConfig({
                spreadsheet_id: spreadsheetId,
                sheet_name: sheetName,
            })
            mutate('/googlesheets/sheet-config')
            toast.push(
                <Notification type="success" title="Sheet Config Saved">
                    Google Sheets configuration saved successfully.
                </Notification>,
            )
        } catch {
            toast.push(
                <Notification type="danger" title="Error">
                    Failed to save sheet configuration.
                </Notification>,
            )
        }
        setSaving(false)
    }

    return (
        <Card header={{ content: <h5>Sheet Configuration</h5>, bordered: true }}>
            <div className="flex flex-col gap-4">
                <p className="text-sm text-gray-500">
                    Specify the Google Spreadsheet and sheet tab where daily reports will be appended. Each report adds a new row: Date, Cafe, Top-ups, Shop Sales, Refunds, Center Expenses.
                </p>
                <div>
                    <label className="block text-sm font-medium mb-1">Spreadsheet ID</label>
                    <Input
                        placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                        value={spreadsheetId}
                        onChange={(e) => setSpreadsheetId((e.target as HTMLInputElement).value)}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        Found in the Google Sheets URL: /spreadsheets/d/<strong>SPREADSHEET_ID</strong>/edit
                    </p>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Sheet Name (Tab)</label>
                    <Input
                        placeholder="Sheet1"
                        value={sheetName}
                        onChange={(e) => setSheetName((e.target as HTMLInputElement).value)}
                    />
                </div>
                <Button variant="solid" loading={saving} onClick={handleSave}>
                    Save Configuration
                </Button>
            </div>
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
            const y = reportDate.getFullYear()
            const m = String(reportDate.getMonth() + 1).padStart(2, '0')
            const d = String(reportDate.getDate()).padStart(2, '0')
            const dateStr = `${y}-${m}-${d}`
            const result = await apiSendGSReport<{
                ok: boolean
                totals?: { top_ups: number; shop_sales: number; refunds: number; center_expenses: number }
            }>({ cafe_id: selectedCafe, report_date: dateStr })
            mutate('/googlesheets/history')
            const totals = result.totals
            toast.push(
                <Notification type="success" title="Report Sent to Google Sheets">
                    {totals
                        ? `Top-ups: ${totals.top_ups.toFixed(2)}, Shop Sales: ${totals.shop_sales.toFixed(2)}, Refunds: ${totals.refunds.toFixed(2)}, Expenses: ${totals.center_expenses.toFixed(2)}`
                        : 'Daily report row appended to Google Sheets.'}
                </Notification>,
            )
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
        <Card header={{ content: <h5>Send Daily Report</h5>, bordered: true }}>
            <div className="flex flex-col gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Select Cafe</label>
                    <Select
                        placeholder="Select a cafe"
                        options={cafeOptions}
                        value={cafeOptions.find((o) => o.value === selectedCafe) || null}
                        onChange={(opt) => setSelectedCafe((opt as SelectOption)?.value || '')}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Report Date</label>
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
    const { data: schedule } = useSWR<GSSchedule>(
        '/googlesheets/schedule',
        () => apiGetGSSchedule<GSSchedule>(),
        { revalidateOnFocus: false },
    )

    const { data: schedulerLogs } = useSWR<GSSchedulerLog[]>(
        '/googlesheets/scheduler-logs',
        () => apiGetGSSchedulerLogs<GSSchedulerLog[]>(),
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
            await apiSaveGSSchedule({
                schedule_type: scheduleType,
                schedule_time: scheduleType === 'daily_at_time' ? scheduleTime : undefined,
            })
            mutate('/googlesheets/schedule')
            toast.push(
                <Notification type="success" title="Schedule Saved">
                    Automated report schedule saved. Times use Philippines timezone (Asia/Manila).
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
        <Card header={{ content: <h5>Automated Report Sending</h5>, bordered: true }}>
            <div className="flex flex-col gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Schedule Type</label>
                    <Select
                        placeholder="Select schedule type"
                        options={scheduleTypeOptions}
                        value={scheduleTypeOptions.find((o) => o.value === scheduleType) || null}
                        onChange={(opt) => setScheduleType((opt as SelectOption)?.value || '')}
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
                            onChange={(e) => setScheduleTime((e.target as HTMLInputElement).value)}
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
                        <span className="font-medium">{schedule.last_run_date}</span>
                    </p>
                )}
                {schedulerLogs && schedulerLogs.length > 0 && (
                    <div className="mt-4">
                        <h6 className="text-sm font-semibold mb-2">Scheduler Run History</h6>
                        <div className="overflow-auto max-h-64">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left text-xs text-gray-500">
                                        <th className="py-1 px-2">Report Date</th>
                                        <th className="py-1 px-2">Run At</th>
                                        <th className="py-1 px-2">Result</th>
                                        <th className="py-1 px-2">Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {schedulerLogs.map((log) => (
                                        <tr key={log.id} className="border-b last:border-0">
                                            <td className="py-1 px-2">{log.report_date}</td>
                                            <td className="py-1 px-2">
                                                {new Date(log.run_at).toLocaleString()}
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
                                                        {log.fail_count}✗
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
    const { data: history, isLoading } = useSWR<GSHistoryItem[]>(
        '/googlesheets/history',
        () => apiGetGSHistory<GSHistoryItem[]>(),
        { revalidateOnFocus: false },
    )

    return (
        <Card header={{ content: <h5>Send History</h5>, bordered: true }}>
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
                                <th className="text-left py-2 px-3">Report Date</th>
                                <th className="text-left py-2 px-3">Sent At</th>
                                <th className="text-left py-2 px-3">Status</th>
                                <th className="text-left py-2 px-3">Sent By</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((item) => (
                                <tr key={item.id} className="border-b last:border-0">
                                    <td className="py-2 px-3">{item.cafe_name}</td>
                                    <td className="py-2 px-3">{item.report_date}</td>
                                    <td className="py-2 px-3">
                                        {new Date(item.sent_at).toLocaleString()}
                                    </td>
                                    <td className="py-2 px-3">
                                        <Tag
                                            className={
                                                item.status === 'success'
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                                                    : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                                            }
                                        >
                                            {item.status === 'success' ? 'Sent' : 'Failed'}
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
                                            {item.sent_by === 'scheduler' ? 'Auto' : 'Manual'}
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

// ── Main Google Sheets Page ──────────────────────────────────────────────────

const GoogleSheets = () => {
    return (
        <div className="flex flex-col gap-6">
            <h3 className="font-bold">Google Sheets Integration</h3>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ConnectionSettingsCard />
                <SheetConfigCard />
                <SendDailyReportCard />
                <AutomatedReportCard />
            </div>
            <SendHistoryCard />
        </div>
    )
}

export default GoogleSheets
