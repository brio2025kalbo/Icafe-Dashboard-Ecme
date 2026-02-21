import type { Period, IcafePeriod } from './types'

export const options: { value: Period; label: string }[] = [
    { value: 'thisMonth', label: 'Monthly' },
    { value: 'thisWeek', label: 'Weekly' },
    { value: 'thisYear', label: 'Annualy' },
]

export const icafeOptions: { value: IcafePeriod; label: string }[] = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
]
