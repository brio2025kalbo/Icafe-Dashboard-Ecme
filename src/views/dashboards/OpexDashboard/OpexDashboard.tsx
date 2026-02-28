import { useState, useCallback } from 'react'
import useSWR from 'swr'
import dayjs from 'dayjs'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import DatePicker from '@/components/ui/DatePicker'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import Drawer from '@/components/ui/Drawer'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { TbPlus, TbEdit, TbTrash, TbCoin, TbChartBar, TbCategory, TbReceiptTax } from 'react-icons/tb'
import { useCafeStore, ALL_CAFES_VALUE } from '@/store/cafeStore'
import Chart from '@/components/shared/Chart'
import {
    apiGetOpexCategories,
    apiGetOpexEntries,
    apiCreateOpexEntry,
    apiUpdateOpexEntry,
    apiDeleteOpexEntry,
    apiCreateOpexCategory,
    apiDeleteOpexCategory,
    type OpexEntry,
    type OpexCategory,
} from '@/services/OpexService'
import { apiGetShiftStats } from '@/services/ReportsService'
import { getDateRange, getTodayBusinessDateStr } from './utils'

const RECURRENCE_OPTIONS = [
    { value: 'none',    label: 'One-time' },
    { value: 'daily',   label: 'Daily' },
    { value: 'weekly',  label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly',  label: 'Yearly' },
]

const PERIOD_OPTIONS = [
    { value: 'thisDay',   label: 'Today' },
    { value: 'thisWeek',  label: 'This Week' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'thisYear',  label: 'This Year' },
]

type Period = 'thisDay' | 'thisWeek' | 'thisMonth' | 'thisYear'

function fmt(val: number) {
    return val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type SummaryCardProps = {
    title: string
    value: number
    icon: React.ReactNode
    colorClass: string
}

const SummaryCard = ({ title, value, icon, colorClass }: SummaryCardProps) => (
    <div className="rounded-xl p-4 bg-gray-50 dark:bg-gray-800 flex items-center gap-4">
        <div className={`flex items-center justify-center w-12 h-12 rounded-full text-2xl ${colorClass}`}>
            {icon}
        </div>
        <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
            <p className="text-xl font-bold text-gray-800 dark:text-white">₱{fmt(value)}</p>
        </div>
    </div>
)

type EntryFormData = {
    cafe_id: string
    category_id: string
    amount: string
    description: string
    entry_date: string
    recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
}

const EMPTY_FORM: EntryFormData = {
    cafe_id: '',
    category_id: '',
    amount: '',
    description: '',
    entry_date: getTodayBusinessDateStr(),
    recurrence: 'none',
}

const OpexDashboard = () => {
    const cafes = useCafeStore((s) => s.cafes)
    const allValidCafes = cafes.filter((c) => c.cafeId && c.apiKey)

    const [period, setPeriod] = useState<Period>('thisMonth')
    const [filterCafeId, setFilterCafeId] = useState(ALL_CAFES_VALUE)

    // Derive date range from selected period
    const dateRange = getDateRange(
        period === 'thisDay' ? 'daily' : period === 'thisWeek' ? 'weekly' : period === 'thisMonth' ? 'monthly' : 'yearly'
    )

    const cafeOptions = [
        { value: ALL_CAFES_VALUE, label: 'All Cafes' },
        ...allValidCafes.map((c) => ({ value: c.id, label: c.name })),
    ]

    // OPEX data
    const { data: entries = [], mutate: mutateEntries } = useSWR(
        ['opex/entries', filterCafeId, dateRange.date_start, dateRange.date_end],
        () => apiGetOpexEntries({
            cafe_id: filterCafeId === ALL_CAFES_VALUE ? undefined : filterCafeId,
            date_start: dateRange.date_start,
            date_end: dateRange.date_end,
        }),
        { revalidateOnFocus: false }
    )

    const { data: categories = [], mutate: mutateCategories } = useSWR(
        'opex/categories',
        apiGetOpexCategories,
        { revalidateOnFocus: false }
    )

    // Revenue data from iCafeCloud (same range as OPEX)
    const validCafesForRevenue = filterCafeId === ALL_CAFES_VALUE
        ? allValidCafes
        : allValidCafes.filter((c) => c.id === filterCafeId)

    const { data: revenueStats } = useSWR(
        ['opex/revenue', filterCafeId, dateRange.date_start, dateRange.date_end],
        async () => {
            if (validCafesForRevenue.length === 0) return { topUps: 0, shopSales: 0, centerExpenses: 0, refunds: 0 }
            const results = await Promise.allSettled(
                validCafesForRevenue.map((c) => apiGetShiftStats(c.id, {
                    date_start: dateRange.date_start,
                    date_end: dateRange.date_end,
                    time_start: dateRange.time_start,
                    time_end: dateRange.time_end,
                }))
            )
            return results.reduce(
                (acc, r) => {
                    if (r.status !== 'fulfilled') return acc
                    return {
                        topUps: acc.topUps + r.value.top_ups,
                        shopSales: acc.shopSales + r.value.shop_sales,
                        centerExpenses: acc.centerExpenses + r.value.center_expenses,
                        refunds: acc.refunds + r.value.refunds,
                    }
                },
                { topUps: 0, shopSales: 0, centerExpenses: 0, refunds: 0 }
            )
        },
        { revalidateOnFocus: false }
    )

    // Totals
    const totalOpex = entries.reduce((s, e) => s + Number(e.amount), 0)
    const grossRevenue = (revenueStats?.topUps ?? 0) + (revenueStats?.shopSales ?? 0)
    const totalDeductions = (revenueStats?.refunds ?? 0) + (revenueStats?.centerExpenses ?? 0)
    const netRevenue = grossRevenue - totalDeductions
    const netProfit = netRevenue - totalOpex

    // OPEX by category (for chart)
    const categoryTotals: Record<string, { name: string; color: string; total: number }> = {}
    for (const entry of entries) {
        const catId = entry.category_id ?? 'uncategorized'
        const catName = entry.category_name ?? 'Uncategorized'
        const catColor = entry.category_color ?? '#6b7280'
        if (!categoryTotals[catId]) categoryTotals[catId] = { name: catName, color: catColor, total: 0 }
        categoryTotals[catId].total += Number(entry.amount)
    }
    const categoryList = Object.values(categoryTotals).sort((a, b) => b.total - a.total)

    // Drawer state for entry form
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [editEntry, setEditEntry] = useState<OpexEntry | null>(null)
    const [formData, setFormData] = useState<EntryFormData>(EMPTY_FORM)
    const [saving, setSaving] = useState(false)

    // Category management state
    const [catDrawerOpen, setCatDrawerOpen] = useState(false)
    const [newCatName, setNewCatName] = useState('')
    const [newCatColor, setNewCatColor] = useState('#6366f1')
    const [catSaving, setCatSaving] = useState(false)

    // Confirm delete state
    const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null)
    const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null)

    const openAdd = useCallback(() => {
        setEditEntry(null)
        setFormData(EMPTY_FORM)
        setDrawerOpen(true)
    }, [])

    const openEdit = useCallback((entry: OpexEntry) => {
        setEditEntry(entry)
        setFormData({
            cafe_id: entry.cafe_id ?? '',
            category_id: entry.category_id ?? '',
            amount: String(entry.amount),
            description: entry.description,
            entry_date: entry.entry_date,
            recurrence: entry.recurrence,
        })
        setDrawerOpen(true)
    }, [])

    const handleSave = useCallback(async () => {
        if (!formData.amount || !formData.entry_date) {
            toast.push(<Notification type="warning">Amount and date are required.</Notification>)
            return
        }
        setSaving(true)
        try {
            const payload = {
                cafe_id: formData.cafe_id || null,
                category_id: formData.category_id || null,
                amount: parseFloat(formData.amount),
                description: formData.description,
                entry_date: formData.entry_date,
                recurrence: formData.recurrence,
            }
            if (editEntry) {
                await apiUpdateOpexEntry(editEntry.id, payload)
            } else {
                await apiCreateOpexEntry(payload)
            }
            await mutateEntries()
            setDrawerOpen(false)
            toast.push(<Notification type="success">{editEntry ? 'Entry updated.' : 'Entry added.'}</Notification>)
        } catch {
            toast.push(<Notification type="danger">Failed to save entry.</Notification>)
        } finally {
            setSaving(false)
        }
    }, [formData, editEntry, mutateEntries])

    const handleDelete = useCallback(async (id: string) => {
        setDeleteEntryId(id)
    }, [])

    const confirmDeleteEntry = useCallback(async () => {
        if (!deleteEntryId) return
        try {
            await apiDeleteOpexEntry(deleteEntryId)
            await mutateEntries()
            toast.push(<Notification type="success">Entry deleted.</Notification>)
        } catch {
            toast.push(<Notification type="danger">Failed to delete entry.</Notification>)
        } finally {
            setDeleteEntryId(null)
        }
    }, [deleteEntryId, mutateEntries])

    const handleAddCategory = useCallback(async () => {
        if (!newCatName.trim()) return
        setCatSaving(true)
        try {
            await apiCreateOpexCategory({ name: newCatName.trim(), color: newCatColor })
            await mutateCategories()
            setNewCatName('')
            setNewCatColor('#6366f1')
            toast.push(<Notification type="success">Category added.</Notification>)
        } catch {
            toast.push(<Notification type="danger">Failed to add category.</Notification>)
        } finally {
            setCatSaving(false)
        }
    }, [newCatName, newCatColor, mutateCategories])

    const handleDeleteCategory = useCallback(async (id: string) => {
        setDeleteCategoryId(id)
    }, [])

    const confirmDeleteCategory = useCallback(async () => {
        if (!deleteCategoryId) return
        try {
            await apiDeleteOpexCategory(deleteCategoryId)
            await mutateCategories()
            toast.push(<Notification type="success">Category deleted.</Notification>)
        } catch {
            toast.push(<Notification type="danger">Failed to delete category.</Notification>)
        } finally {
            setDeleteCategoryId(null)
        }
    }, [deleteCategoryId, mutateCategories])

    const categoryOptions = [
        { value: '', label: 'Uncategorized' },
        ...categories.map((c) => ({ value: c.id, label: c.name })),
    ]

    const profitBarData = [
        { label: 'Top-ups', value: revenueStats?.topUps ?? 0, color: '#3b82f6' },
        { label: 'Shop Sales', value: revenueStats?.shopSales ?? 0, color: '#10b981' },
        { label: 'Refunds', value: -(revenueStats?.refunds ?? 0), color: '#ef4444' },
        { label: 'Center Expenses', value: -(revenueStats?.centerExpenses ?? 0), color: '#f59e0b' },
        { label: 'OPEX', value: -totalOpex, color: '#8b5cf6' },
    ]

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h4 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <TbReceiptTax className="text-2xl text-violet-500" />
                        OPEX Tracker
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Track operational expenditures alongside your iCafe revenue data.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Select
                        size="sm"
                        className="min-w-[130px]"
                        value={cafeOptions.find((o) => o.value === filterCafeId)}
                        options={cafeOptions}
                        isSearchable={false}
                        onChange={(o) => o && setFilterCafeId(o.value)}
                    />
                    <Select
                        size="sm"
                        className="min-w-[130px]"
                        value={PERIOD_OPTIONS.find((o) => o.value === period)}
                        options={PERIOD_OPTIONS}
                        isSearchable={false}
                        onChange={(o) => o && setPeriod(o.value as Period)}
                    />
                    <Button
                        size="sm"
                        variant="default"
                        icon={<TbCategory />}
                        onClick={() => setCatDrawerOpen(true)}
                    >
                        Categories
                    </Button>
                    <Button
                        size="sm"
                        variant="solid"
                        icon={<TbPlus />}
                        onClick={openAdd}
                    >
                        Add Expense
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <SummaryCard
                    title="Gross Revenue"
                    value={grossRevenue}
                    icon={<TbCoin />}
                    colorClass="bg-blue-100 text-blue-600"
                />
                <SummaryCard
                    title="Total OPEX"
                    value={totalOpex}
                    icon={<TbReceiptTax />}
                    colorClass="bg-violet-100 text-violet-600"
                />
                <SummaryCard
                    title="Total Deductions"
                    value={totalDeductions}
                    icon={<TbChartBar />}
                    colorClass="bg-amber-100 text-amber-600"
                />
                <SummaryCard
                    title="Net Profit"
                    value={netProfit}
                    icon={<TbCoin />}
                    colorClass={netProfit >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                {/* OPEX vs Revenue Chart */}
                <div className="xl:col-span-7">
                    <Card header={{ content: <h6 className="font-semibold">Revenue & Expense Breakdown</h6> }}>
                        {profitBarData.every((d) => d.value === 0) ? (
                            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                                No data for selected period.
                            </div>
                        ) : (
                            <Chart
                                type="bar"
                                series={[{ name: 'Amount (₱)', data: profitBarData.map((d) => d.value) }]}
                                xAxis={profitBarData.map((d) => d.label)}
                                height="300px"
                                customOptions={{
                                    colors: profitBarData.map((d) => d.color),
                                    plotOptions: {
                                        bar: { distributed: true, borderRadius: 6 },
                                    },
                                    legend: { show: false },
                                    yaxis: {
                                        labels: {
                                            formatter: (v: number) => `₱${fmt(Math.abs(v))}`,
                                        },
                                    },
                                    tooltip: {
                                        y: {
                                            formatter: (v: number) => `₱${fmt(Math.abs(v))}`,
                                        },
                                    },
                                }}
                            />
                        )}
                    </Card>
                </div>

                {/* OPEX by Category */}
                <div className="xl:col-span-5">
                    <Card
                        className="h-full"
                        header={{ content: <h6 className="font-semibold">OPEX by Category</h6> }}
                    >
                        {categoryList.length === 0 ? (
                            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
                                No OPEX entries yet.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3 mt-2">
                                {categoryList.map((cat) => {
                                    const pct = totalOpex > 0 ? (cat.total / totalOpex) * 100 : 0
                                    return (
                                        <div key={cat.name}>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className="font-medium" style={{ color: cat.color }}>{cat.name}</span>
                                                <span className="text-gray-600 dark:text-gray-300">₱{fmt(cat.total)} ({pct.toFixed(1)}%)</span>
                                            </div>
                                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                <div
                                                    className="h-2 rounded-full transition-all duration-500"
                                                    style={{ width: `${pct}%`, backgroundColor: cat.color }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* OPEX Entries Table */}
            <Card header={{
                content: <h6 className="font-semibold">OPEX Entries</h6>,
                extra: (
                    <span className="text-sm text-gray-500">
                        {dateRange.date_start} → {dateRange.date_end}
                    </span>
                ),
            }}>
                {entries.length === 0 ? (
                    <div className="py-12 text-center text-gray-400 text-sm">
                        No OPEX entries for the selected period.{' '}
                        <button className="text-blue-500 hover:underline" onClick={openAdd}>
                            Add one now.
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                    <th className="pb-2 pr-4 font-medium">Date</th>
                                    <th className="pb-2 pr-4 font-medium">Category</th>
                                    <th className="pb-2 pr-4 font-medium">Cafe</th>
                                    <th className="pb-2 pr-4 font-medium">Description</th>
                                    <th className="pb-2 pr-4 font-medium">Recurrence</th>
                                    <th className="pb-2 pr-4 font-medium text-right">Amount</th>
                                    <th className="pb-2 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((entry) => (
                                    <tr
                                        key={entry.id}
                                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                    >
                                        <td className="py-2 pr-4 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                            {dayjs(entry.entry_date).format('MMM DD, YYYY')}
                                        </td>
                                        <td className="py-2 pr-4">
                                            {entry.category_name ? (
                                                <span
                                                    className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                                                    style={{ backgroundColor: entry.category_color ?? '#6b7280' }}
                                                >
                                                    {entry.category_name}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-xs">Uncategorized</span>
                                            )}
                                        </td>
                                        <td className="py-2 pr-4 text-gray-600 dark:text-gray-300 text-xs">
                                            {entry.cafe_name ?? <span className="text-gray-400">All</span>}
                                        </td>
                                        <td className="py-2 pr-4 text-gray-700 dark:text-gray-200 max-w-xs truncate">
                                            {entry.description || <span className="text-gray-400">—</span>}
                                        </td>
                                        <td className="py-2 pr-4 text-gray-500 text-xs capitalize">
                                            {entry.recurrence === 'none' ? 'One-time' : entry.recurrence}
                                        </td>
                                        <td className="py-2 pr-4 text-right font-semibold text-red-500 whitespace-nowrap">
                                            ₱{fmt(Number(entry.amount))}
                                        </td>
                                        <td className="py-2 text-right whitespace-nowrap">
                                            <button
                                                className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded mr-1"
                                                onClick={() => openEdit(entry)}
                                                title="Edit"
                                            >
                                                <TbEdit />
                                            </button>
                                            <button
                                                className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                                onClick={() => handleDelete(entry.id)}
                                                title="Delete"
                                            >
                                                <TbTrash />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                                    <td colSpan={5} className="pt-2 font-semibold text-gray-700 dark:text-gray-200">
                                        Total OPEX
                                    </td>
                                    <td className="pt-2 text-right font-bold text-red-500 whitespace-nowrap">
                                        ₱{fmt(totalOpex)}
                                    </td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </Card>

            {/* Add/Edit Entry Drawer */}
            <Drawer
                title={editEntry ? 'Edit OPEX Entry' : 'Add OPEX Entry'}
                isOpen={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                onRequestClose={() => setDrawerOpen(false)}
                footer={
                    <div className="flex justify-end gap-2">
                        <Button size="sm" variant="plain" onClick={() => setDrawerOpen(false)}>Cancel</Button>
                        <Button size="sm" variant="solid" loading={saving} onClick={handleSave}>
                            {editEntry ? 'Update' : 'Save'}
                        </Button>
                    </div>
                }
            >
                <div className="flex flex-col gap-4 p-1">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Date *</label>
                        <DatePicker
                            value={formData.entry_date ? new Date(formData.entry_date) : undefined}
                            inputFormat="YYYY-MM-DD"
                            clearable={false}
                            onChange={(d) => d && setFormData((f) => ({ ...f, entry_date: dayjs(d).format('YYYY-MM-DD') }))}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Amount (₱) *</label>
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.amount}
                            onChange={(e) => setFormData((f) => ({ ...f, amount: e.target.value }))}
                            placeholder="0.00"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Category</label>
                        <Select
                            value={categoryOptions.find((o) => o.value === formData.category_id) ?? categoryOptions[0]}
                            options={categoryOptions}
                            onChange={(o) => o && setFormData((f) => ({ ...f, category_id: o.value }))}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Cafe</label>
                        <Select
                            value={cafeOptions.find((o) => o.value === formData.cafe_id) ?? cafeOptions[0]}
                            options={cafeOptions}
                            onChange={(o) => o && setFormData((f) => ({ ...f, cafe_id: o.value === ALL_CAFES_VALUE ? '' : o.value }))}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Description</label>
                        <Input
                            value={formData.description}
                            onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                            placeholder="e.g. Monthly Meralco bill"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Recurrence</label>
                        <Select
                            value={RECURRENCE_OPTIONS.find((o) => o.value === formData.recurrence)}
                            options={RECURRENCE_OPTIONS}
                            isSearchable={false}
                            onChange={(o) => o && setFormData((f) => ({ ...f, recurrence: o.value as EntryFormData['recurrence'] }))}
                        />
                    </div>
                </div>
            </Drawer>

            {/* Category Management Drawer */}
            <Drawer
                title="Manage Categories"
                isOpen={catDrawerOpen}
                onClose={() => setCatDrawerOpen(false)}
                onRequestClose={() => setCatDrawerOpen(false)}
            >
                <div className="flex flex-col gap-4 p-1">
                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">New Category</label>
                            <Input
                                value={newCatName}
                                onChange={(e) => setNewCatName(e.target.value)}
                                placeholder="Category name"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Color</label>
                            <input
                                type="color"
                                value={newCatColor}
                                onChange={(e) => setNewCatColor(e.target.value)}
                                className="h-9 w-14 rounded border border-gray-300 cursor-pointer p-0.5"
                            />
                        </div>
                        <Button
                            size="sm"
                            variant="solid"
                            icon={<TbPlus />}
                            loading={catSaving}
                            onClick={handleAddCategory}
                            disabled={!newCatName.trim()}
                        >
                            Add
                        </Button>
                    </div>
                    <div className="flex flex-col gap-2 mt-2">
                        {categories.map((cat: OpexCategory) => (
                            <div
                                key={cat.id}
                                className="flex items-center justify-between p-2 rounded-lg border border-gray-200 dark:border-gray-700"
                            >
                                <div className="flex items-center gap-2">
                                    <span
                                        className="inline-block w-3 h-3 rounded-full"
                                        style={{ backgroundColor: cat.color }}
                                    />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{cat.name}</span>
                                </div>
                                <button
                                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                    onClick={() => handleDeleteCategory(cat.id)}
                                    title="Delete category"
                                >
                                    <TbTrash className="text-sm" />
                                </button>
                            </div>
                        ))}
                        {categories.length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-4">No categories yet.</p>
                        )}
                    </div>
                </div>
            </Drawer>

            {/* Delete Entry Confirmation */}
            <ConfirmDialog
                isOpen={!!deleteEntryId}
                type="danger"
                title="Delete OPEX Entry"
                confirmText="Delete"
                confirmButtonProps={{ variant: 'solid' }}
                onClose={() => setDeleteEntryId(null)}
                onRequestClose={() => setDeleteEntryId(null)}
                onCancel={() => setDeleteEntryId(null)}
                onConfirm={confirmDeleteEntry}
            >
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    Are you sure you want to delete this OPEX entry? This action cannot be undone.
                </p>
            </ConfirmDialog>

            {/* Delete Category Confirmation */}
            <ConfirmDialog
                isOpen={!!deleteCategoryId}
                type="danger"
                title="Delete Category"
                confirmText="Delete"
                confirmButtonProps={{ variant: 'solid' }}
                onClose={() => setDeleteCategoryId(null)}
                onRequestClose={() => setDeleteCategoryId(null)}
                onCancel={() => setDeleteCategoryId(null)}
                onConfirm={confirmDeleteCategory}
            >
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    Are you sure you want to delete this category? Associated entries will become uncategorized.
                </p>
            </ConfirmDialog>
        </div>
    )
}

export default OpexDashboard
