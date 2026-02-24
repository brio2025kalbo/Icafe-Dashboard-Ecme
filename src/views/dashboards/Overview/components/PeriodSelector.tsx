import Select from '@/components/ui/Select'
import { PERIOD_OPTIONS } from '../utils/periodUtils'
import type { PeriodType } from '../icafeTypes'

type PeriodSelectorProps = {
    value: PeriodType
    onChange: (value: PeriodType) => void
    className?: string
}

const PeriodSelector = ({
    value,
    onChange,
    className = 'w-[120px]',
}: PeriodSelectorProps) => {
    const selectedOption = PERIOD_OPTIONS.find((o) => o.value === value)

    return (
        <Select
            className={className}
            size="sm"
            placeholder="Select period"
            value={selectedOption}
            options={PERIOD_OPTIONS}
            isSearchable={false}
            onChange={(option) => {
                if (option?.value) {
                    onChange(option.value)
                }
            }}
        />
    )
}

export default PeriodSelector
