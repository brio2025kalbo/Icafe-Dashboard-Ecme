import type { PeriodType } from '../icafeTypes'

/**
 * Business day definition:
 *   A business day starts at 06:00 and ends at 05:59 the following calendar day.
 *
 *   So if the current time is BEFORE 06:00, we are still in the PREVIOUS business day.
 *   If the current time is AT or AFTER 06:00, we are in TODAY's business day.
 *
 *   The API's shiftList accepts date_start / date_end (calendar dates) plus
 *   time_start / time_end.  To capture a full business day we query:
 *     date_start = business day start date,  time_start = "06:00"
 *     date_end   = business day start date + 1,  time_end = "05:59"
 */

export const BUSINESS_DAY_START_HOUR = 6   // 06:00
export const BUSINESS_DAY_START_TIME = '06:00'
export const BUSINESS_DAY_END_TIME   = '05:59'

export type DateRange = {
    /** Calendar date for the start of the query window (YYYY-MM-DD) */
    date_start: string
    /** Calendar date for the end of the query window (YYYY-MM-DD) */
    date_end: string
    /** 06:00 – always the business day open time */
    time_start: string
    /** 05:59 – always the business day close time (next calendar day) */
    time_end: string
    /** Human-readable label */
    label: string
}

function fmt(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

function addDays(d: Date, n: number): Date {
    const r = new Date(d)
    r.setDate(r.getDate() + n)
    return r
}

/**
 * Returns the "business date" for a given wall-clock moment.
 * If the time is before 06:00, the business date is yesterday.
 */
function getBusinessDate(now: Date): Date {
    if (now.getHours() < BUSINESS_DAY_START_HOUR) {
        return addDays(now, -1)
    }
    return now
}

/**
 * Returns the DateRange for a specific business date (used by the daily date picker).
 * Accepts a YYYY-MM-DD string representing the business day start date.
 */
export function getBusinessDayRange(businessDateStr: string): DateRange {
    const parts = businessDateStr.split('-').map(Number)
    const bizDate = new Date(parts[0], parts[1] - 1, parts[2])
    // date_start === date_end signals to apiGetShiftStats to use the
    // two-query business-day strategy (same-day + overnight shifts).
    return {
        date_start: fmt(bizDate),
        date_end:   fmt(bizDate),   // intentionally same as date_start
        time_start: BUSINESS_DAY_START_TIME,
        time_end:   BUSINESS_DAY_END_TIME,
        label:      businessDateStr,
    }
}

/**
 * Returns today's business date as YYYY-MM-DD string.
 * If current time is before 06:00, returns yesterday.
 */
export function getTodayBusinessDateStr(): string {
    return fmt(getBusinessDate(new Date()))
}

export function getDateRange(period: PeriodType, referenceDate?: Date): DateRange {
    const now = referenceDate ?? new Date()
    const bizDate = getBusinessDate(now)

    switch (period) {
        case 'daily': {
            // Business day: bizDate 06:00 → bizDate+1 05:59
            return {
                date_start: fmt(bizDate),
                date_end:   fmt(addDays(bizDate, 1)),
                time_start: BUSINESS_DAY_START_TIME,
                time_end:   BUSINESS_DAY_END_TIME,
                label: 'Today',
            }
        }

        case 'weekly': {
            // Current business week: Mon–Sun (business days)
            // Find Monday of the current business week
            const day = bizDate.getDay() // 0=Sun
            const diffToMon = day === 0 ? -6 : 1 - day
            const mon = addDays(bizDate, diffToMon)
            const sun = addDays(mon, 6)
            // Query window: Mon 06:00 → Sun+1 05:59
            return {
                date_start: fmt(mon),
                date_end:   fmt(addDays(sun, 1)),
                time_start: BUSINESS_DAY_START_TIME,
                time_end:   BUSINESS_DAY_END_TIME,
                label: 'This Week',
            }
        }

        case 'monthly': {
            // First business day of month: 1st of month
            // Last business day of month: last day of month
            const firstOfMonth = new Date(bizDate.getFullYear(), bizDate.getMonth(), 1)
            const lastOfMonth  = new Date(bizDate.getFullYear(), bizDate.getMonth() + 1, 0)
            // Query window: 1st 06:00 → last+1 05:59
            return {
                date_start: fmt(firstOfMonth),
                date_end:   fmt(addDays(lastOfMonth, 1)),
                time_start: BUSINESS_DAY_START_TIME,
                time_end:   BUSINESS_DAY_END_TIME,
                label: 'This Month',
            }
        }

        case 'yearly': {
            const firstOfYear = new Date(bizDate.getFullYear(), 0, 1)
            const lastOfYear  = new Date(bizDate.getFullYear(), 11, 31)
            return {
                date_start: fmt(firstOfYear),
                date_end:   fmt(addDays(lastOfYear, 1)),
                time_start: BUSINESS_DAY_START_TIME,
                time_end:   BUSINESS_DAY_END_TIME,
                label: 'This Year',
            }
        }
    }
}

export const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
    { value: 'daily',   label: 'Daily' },
    { value: 'weekly',  label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly',  label: 'Yearly' },
]
