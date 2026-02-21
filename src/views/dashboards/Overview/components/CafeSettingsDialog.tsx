import { useState } from 'react'
import Dialog from '@/components/ui/Dialog'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useCafeStore } from '@/store/cafeStore'
import { TbSettings, TbPlus, TbTrash } from 'react-icons/tb'
import type { Cafe } from '@/@types/cafe'

const CafeSettingsDialog = () => {
    const [open, setOpen] = useState(false)
    const cafes = useCafeStore((state) => state.cafes)
    const setCafes = useCafeStore((state) => state.setCafes)
    const setSelectedCafeId = useCafeStore((state) => state.setSelectedCafeId)
    const selectedCafeId = useCafeStore((state) => state.selectedCafeId)

    const [localCafes, setLocalCafes] = useState<Cafe[]>([])

    const handleOpen = () => {
        setLocalCafes(cafes.map((c) => ({ ...c })))
        setOpen(true)
    }

    const handleClose = () => setOpen(false)

    const handleSave = () => {
        setCafes(localCafes)
        // If the currently selected cafe was removed, select the first one
        if (!localCafes.find((c) => c.id === selectedCafeId)) {
            setSelectedCafeId(localCafes[0]?.id ?? null)
        }
        setOpen(false)
    }

    const handleAdd = () => {
        const newId = `cafe_${Date.now()}`
        setLocalCafes([...localCafes, { id: newId, name: 'New Cafe', cafeId: '', apiKey: '' }])
    }

    const handleRemove = (id: string) => {
        setLocalCafes(localCafes.filter((c) => c.id !== id))
    }

    const handleChange = (id: string, field: keyof Omit<Cafe, 'id'>, value: string) => {
        setLocalCafes(
            localCafes.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
        )
    }

    return (
        <>
            <Button
                size="sm"
                variant="plain"
                icon={<TbSettings />}
                onClick={handleOpen}
                title="Manage Cafes"
            />
            <Dialog
                isOpen={open}
                onClose={handleClose}
                onRequestClose={handleClose}
                width={640}
            >
                <h5 className="mb-4">Manage Cafes</h5>
                <p className="text-sm text-gray-500 mb-4">
                    Configure each cafe's display name, Cafe ID (the numeric ID from iCafeCloud),
                    and API key (Bearer token from Settings → API settings in your iCafeCloud admin).
                </p>
                <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
                    {localCafes.map((cafe) => (
                        <div
                            key={cafe.id}
                            className="grid grid-cols-12 gap-2 items-center bg-gray-50 dark:bg-gray-800 rounded-xl p-3"
                        >
                            <div className="col-span-3">
                                <label className="text-xs text-gray-500 mb-1 block">
                                    Name
                                </label>
                                <Input
                                    size="sm"
                                    value={cafe.name}
                                    onChange={(e) =>
                                        handleChange(cafe.id, 'name', e.target.value)
                                    }
                                    placeholder="Cafe name"
                                />
                            </div>
                            <div className="col-span-3">
                                <label className="text-xs text-gray-500 mb-1 block">
                                    Cafe ID
                                </label>
                                <Input
                                    size="sm"
                                    value={cafe.cafeId}
                                    onChange={(e) =>
                                        handleChange(cafe.id, 'cafeId', e.target.value)
                                    }
                                    placeholder="e.g. 87127"
                                />
                            </div>
                            <div className="col-span-5">
                                <label className="text-xs text-gray-500 mb-1 block">
                                    API Key
                                </label>
                                <Input
                                    size="sm"
                                    value={cafe.apiKey}
                                    onChange={(e) =>
                                        handleChange(cafe.id, 'apiKey', e.target.value)
                                    }
                                    placeholder="Bearer token"
                                />
                            </div>
                            <div className="col-span-1 flex justify-end pt-4">
                                <Button
                                    size="xs"
                                    variant="plain"
                                    icon={<TbTrash />}
                                    onClick={() => handleRemove(cafe.id)}
                                    className="text-red-500 hover:text-red-700"
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-between mt-4">
                    <Button
                        size="sm"
                        variant="solid"
                        icon={<TbPlus />}
                        onClick={handleAdd}
                    >
                        Add Cafe
                    </Button>
                    <div className="flex gap-2">
                        <Button size="sm" variant="plain" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button size="sm" variant="solid" onClick={handleSave}>
                            Save
                        </Button>
                    </div>
                </div>
            </Dialog>
        </>
    )
}

export default CafeSettingsDialog
