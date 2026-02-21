import { useCafeStore } from '@/store/cafeStore'
import IcafeReportChart from './IcafeReportChart'
import CafeSelector from './CafeSelector'
import CafeSettingsDialog from './CafeSettingsDialog'

const IcafeReportsSection = () => {
    const cafes = useCafeStore((state) => state.cafes)
    const selectedCafeId = useCafeStore((state) => state.selectedCafeId)

    const selectedCafe = cafes.find((c) => c.id === selectedCafeId)

    return (
        <div className="flex flex-col gap-4">
            {/* Header row */}
            <div className="flex items-center justify-between">
                <h4 className="mb-0">iCafeCloud Reports</h4>
                <div className="flex items-center gap-2">
                    <CafeSelector />
                    <CafeSettingsDialog />
                </div>
            </div>

            {/* No cafes configured */}
            {cafes.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center text-gray-400 text-sm">
                    No cafes configured. Click the settings icon to add a cafe.
                </div>
            )}

            {/* Selected cafe chart */}
            {selectedCafe && (
                <IcafeReportChart
                    key={selectedCafe.id}
                    cafeId={selectedCafe.id}
                    cafeName={selectedCafe.name}
                />
            )}

            {/* All cafes summary row (when more than one) */}
            {cafes.length > 1 && (
                <>
                    <h5 className="mb-0 mt-2">All Cafes Overview</h5>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {cafes.map((cafe) => (
                            <IcafeReportChart
                                key={cafe.id}
                                cafeId={cafe.id}
                                cafeName={cafe.name}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

export default IcafeReportsSection
