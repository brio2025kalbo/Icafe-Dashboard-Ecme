import Select from '@/components/ui/Select'
import { useCafeStore } from '@/store/cafeStore'

const CafeSelector = () => {
    const cafes = useCafeStore((state) => state.cafes)
    const selectedCafeId = useCafeStore((state) => state.selectedCafeId)
    const setSelectedCafeId = useCafeStore((state) => state.setSelectedCafeId)

    const options = cafes.map((cafe) => ({
        value: cafe.id,
        label: cafe.name,
    }))

    const selectedOption = options.find((o) => o.value === selectedCafeId) ?? null

    return (
        <Select
            className="min-w-[160px]"
            size="sm"
            placeholder="Select cafe"
            value={selectedOption}
            options={options}
            isSearchable={false}
            onChange={(option) => {
                if (option?.value) {
                    setSelectedCafeId(option.value)
                }
            }}
        />
    )
}

export default CafeSelector
