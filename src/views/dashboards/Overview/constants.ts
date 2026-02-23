import type { Period, EcommercePeriod } from './types'

export const options: { value: Period; label: string }[] = [
    { value: 'thisDay', label: 'Daily' },
    { value: 'thisWeek', label: 'Weekly' },
    { value: 'thisMonth', label: 'Monthly' },
    { value: 'thisYear', label: 'Yearly' },
]

/** Options for ecommerce-only components (excludes Daily) */
export const ecommerceOptions: { value: EcommercePeriod; label: string }[] = [
    { value: 'thisWeek', label: 'Weekly' },
    { value: 'thisMonth', label: 'Monthly' },
    { value: 'thisYear', label: 'Yearly' },
]
