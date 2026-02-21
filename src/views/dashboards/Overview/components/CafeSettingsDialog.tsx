import { useState } from 'react'
import Dialog from '@/components/ui/Dialog'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useCafeStore } from '@/store/cafeStore'
import { TbSettings, TbPlus, TbTrash, TbLoader2 } from 'react-icons/tb'
import type { Cafe } from '@/@types/cafe'

type LocalCafe = Cafe & { _isNew?: boolean; _deleted?: boolean }

const CafeSettingsDialog = () => {
    const [open, setOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)

    const cafes = useCafeStore((s) => s.cafes)
    const addCafe = useCafeStore((s) => s.addCafe)
    const updateCafe = useCafeStore((s) => s.updateCafe)
    const deleteCafe = useCafeStore((s) => s.deleteCafe)
    const setSelectedCafeId = useCafeStore((s) => s.setSelectedCafeId)
    const selectedCafeId = useCafeStore((s) => s.selectedCafeId)

    const [localCafes, setLocalCafes] = useState<LocalCafe[]>([])

    const handleOpen = () => {
        setLocalCafes(cafes.map((c) => ({ ...c })))
        setSaveError(null)
        setOpen(true)
    }
    const handleClose = () => {
        if (!saving) setOpen(false)
    }

    const handleSave = async () => {
        setSaving(true)
        setSaveError(null)
        try {
            const originalIds = new Set(cafes.map((c) => c.id))

            for (const lc of localCafes) {
                if (lc._deleted) {
                    if (originalIds.has(lc.id)) await deleteCafe(lc.id)
                } else if (lc._isNew) {
                    await addCafe({ name: lc.name, cafeId: lc.cafeId, apiKey: lc.apiKey })
                } else {
                    await updateCafe(lc.id, { name: lc.name, cafeId: lc.cafeId, apiKey: lc.apiKey })
                }
            }

            // If selected cafe was deleted, pick first remaining
            const remaining = localCafes.filter((c) => !c._deleted)
            if (!remaining.find((c) => c.id === selectedCafeId)) {
                setSelectedCafeId(remaining[0]?.id ?? null)
            }
            setOpen(false)
        } catch (e) {
            setSaveError(e instanceof Error ? e.message : 'Failed to save')
        } finally {
            setSaving(false)
        }
    }

    const handleAdd = () => {
        const tempId = `_new_${Date.now()}`
        setLocalCafes([...localCafes, { id: tempId, name: 'New Cafe', cafeId: '', apiKey: '', _isNew: true }])
    }

    const handleRemove = (id: string) => {
        setLocalCafes((prev) =>
            prev.map((c) => c.id === id ? { ...c, _deleted: true } : c)
        )
    }

    const handleChange = (id: string, field: keyof Omit<Cafe, 'id'>, value: string) => {
        setLocalCafes((prev) =>
            prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
        )
    }

    const visibleCafes = localCafes.filter((c) => !c._deleted)

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
                    {visibleCafes.map((cafe) => (
                        <div
                            key={cafe.id}
                            className="grid grid-cols-12 gap-2 items-center bg-gray-50 dark:bg-gray-800 rounded-xl p-3"
                        >
                            <div className="col-span-3">
                                <label className="text-xs text-gray-500 mb-1 block">Name</label>
                                <Input
                                    size="sm"
                                    value={cafe.name}
                                    onChange={(e) => handleChange(cafe.id, 'name', e.target.value)}
                                    placeholder="Cafe name"
                                />
                            </div>
                            <div className="col-span-3">
                                <label className="text-xs text-gray-500 mb-1 block">Cafe ID</label>
                                <Input
                                    size="sm"
                                    value={cafe.cafeId}
                                    onChange={(e) => handleChange(cafe.id, 'cafeId', e.target.value)}
                                    placeholder="e.g. 87127"
                                />
                            </div>
                            <div className="col-span-5">
                                <label className="text-xs text-gray-500 mb-1 block">API Key</label>
                                <Input
                                    size="sm"
                                    value={cafe.apiKey}
                                    onChange={(e) => handleChange(cafe.id, 'apiKey', e.target.value)}
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
                    {visibleCafes.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-4">No cafes configured. Click "Add Cafe" to get started.</p>
                    )}
                </div>
                {saveError && (
                    <p className="text-xs text-red-500 mt-2">{saveError}</p>
                )}
                <div className="flex justify-between mt-4">
                    <Button
                        size="sm"
                        variant="solid"
                        icon={<TbPlus />}
                        onClick={handleAdd}
                        disabled={saving}
                    >
                        Add Cafe
                    </Button>
                    <div className="flex gap-2">
                        <Button size="sm" variant="plain" onClick={handleClose} disabled={saving}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            variant="solid"
                            onClick={handleSave}
                            loading={saving}
                            icon={saving ? <TbLoader2 className="animate-spin" /> : undefined}
                        >
                            {saving ? 'Saving…' : 'Save'}
                        </Button>
                    </div>
                </div>
            </Dialog>
        </>
    )
}

export default CafeSettingsDialog
