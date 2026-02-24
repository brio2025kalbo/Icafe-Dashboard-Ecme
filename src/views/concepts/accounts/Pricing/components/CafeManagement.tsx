import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useCafeStore } from '@/store/cafeStore'
import { useAuth } from '@/auth'
import { TbPlus, TbTrash, TbLoader2, TbDeviceDesktop } from 'react-icons/tb'
import type { Cafe } from '@/@types/cafe'

type LocalCafe = Cafe & { _isNew?: boolean; _deleted?: boolean }

const CafeManagement = () => {
    const { user } = useAuth()
    const isAdmin = user?.authority?.includes('admin')

    const cafes = useCafeStore((s) => s.cafes)
    const addCafe = useCafeStore((s) => s.addCafe)
    const updateCafe = useCafeStore((s) => s.updateCafe)
    const deleteCafe = useCafeStore((s) => s.deleteCafe)
    const setSelectedCafeId = useCafeStore((s) => s.setSelectedCafeId)
    const selectedCafeId = useCafeStore((s) => s.selectedCafeId)

    const [localCafes, setLocalCafes] = useState<LocalCafe[]>([])
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [isDirty, setIsDirty] = useState(false)

    useEffect(() => {
        setLocalCafes(cafes.map((c) => ({ ...c })))
    }, [cafes])

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
                    // Only update if changed
                    const original = cafes.find(c => c.id === lc.id)
                    if (original && (original.name !== lc.name || original.cafeId !== lc.cafeId || original.apiKey !== lc.apiKey)) {
                        await updateCafe(lc.id, { name: lc.name, cafeId: lc.cafeId, apiKey: lc.apiKey })
                    }
                }
            }

            // If selected cafe was deleted, pick first remaining
            const remaining = localCafes.filter((c) => !c._deleted)
            if (!remaining.find((c) => c.id === selectedCafeId)) {
                setSelectedCafeId(remaining[0]?.id ?? null)
            }
            setIsDirty(false)
        } catch (e) {
            setSaveError(e instanceof Error ? e.message : 'Failed to save')
        } finally {
            setSaving(false)
        }
    }

    const handleAdd = () => {
        const tempId = `_new_${Date.now()}`
        setLocalCafes([...localCafes, { id: tempId, name: 'New Cafe', cafeId: '', apiKey: '', _isNew: true }])
        setIsDirty(true)
    }

    const handleRemove = (id: string) => {
        setLocalCafes((prev) =>
            prev.map((c) => c.id === id ? { ...c, _deleted: true } : c)
        )
        setIsDirty(true)
    }

    const handleChange = (id: string, field: keyof Omit<Cafe, 'id'>, value: string) => {
        setLocalCafes((prev) =>
            prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
        )
        setIsDirty(true)
    }

    const visibleCafes = localCafes.filter((c) => !c._deleted)

    if (!isAdmin) {
        return (
            <Card>
                <div className="flex items-center gap-2 mb-4">
                    <TbDeviceDesktop className="text-xl text-blue-500" />
                    <h4 className="mb-0">My Cafes</h4>
                </div>
                <p className="text-sm text-gray-500 mb-6">
                    You have access to the following internet cafes. Contact your administrator to request access to more locations.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cafes.map(cafe => (
                        <div key={cafe.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800">
                            <h6 className="font-bold">{cafe.name}</h6>
                            <p className="text-xs text-gray-500 mt-1">ID: {cafe.cafeId}</p>
                        </div>
                    ))}
                    {cafes.length === 0 && (
                        <div className="col-span-full py-8 text-center text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                            No cafes assigned to your account.
                        </div>
                    )}
                </div>
            </Card>
        )
    }

    return (
        <Card>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <TbDeviceDesktop className="text-xl text-blue-500" />
                    <h4 className="mb-0">Manage Cafes</h4>
                </div>
                <div className="flex gap-2">
                    {isDirty && (
                        <Button 
                            size="sm" 
                            variant="plain" 
                            onClick={() => {
                                setLocalCafes(cafes.map(c => ({...c})))
                                setIsDirty(false)
                                setSaveError(null)
                            }}
                            disabled={saving}
                        >
                            Discard
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="solid"
                        onClick={handleSave}
                        loading={saving}
                        disabled={!isDirty || saving}
                        icon={saving ? <TbLoader2 className="animate-spin" /> : undefined}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </div>
            
            <p className="text-sm text-gray-500 mb-6">
                Configure your internet cafe locations. Each cafe requires a display name, the numeric Cafe ID from iCafeCloud, 
                and the API Bearer token found in iCafeCloud Settings → API settings.
            </p>

            <div className="flex flex-col gap-4">
                {visibleCafes.map((cafe) => (
                    <div
                        key={cafe.id}
                        className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl p-4"
                    >
                        <div className="md:col-span-3">
                            <label className="text-xs font-semibold text-gray-400 uppercase mb-1 block">Display Name</label>
                            <Input
                                value={cafe.name}
                                onChange={(e) => handleChange(cafe.id, 'name', e.target.value)}
                                placeholder="e.g. Downtown Branch"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs font-semibold text-gray-400 uppercase mb-1 block">Cafe ID</label>
                            <Input
                                value={cafe.cafeId}
                                onChange={(e) => handleChange(cafe.id, 'cafeId', e.target.value)}
                                placeholder="e.g. 12345"
                            />
                        </div>
                        <div className="md:col-span-6">
                            <label className="text-xs font-semibold text-gray-400 uppercase mb-1 block">API Key (Bearer Token)</label>
                            <Input
                                value={cafe.apiKey}
                                onChange={(e) => handleChange(cafe.id, 'apiKey', e.target.value)}
                                placeholder="Paste your iCafeCloud API token here"
                                type="password"
                            />
                        </div>
                        <div className="md:col-span-1 flex justify-end">
                            <Button
                                size="sm"
                                variant="plain"
                                icon={<TbTrash />}
                                onClick={() => handleRemove(cafe.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            />
                        </div>
                    </div>
                ))}

                {visibleCafes.length === 0 && (
                    <div className="py-12 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                        <p className="text-gray-400">No cafes configured yet.</p>
                    </div>
                )}

                <div className="mt-2">
                    <Button
                        size="sm"
                        variant="outline"
                        icon={<TbPlus />}
                        onClick={handleAdd}
                        disabled={saving}
                    >
                        Add New Cafe
                    </Button>
                </div>

                {saveError && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-500 text-sm rounded-lg border border-red-100 dark:border-red-900/30">
                        {saveError}
                    </div>
                )}
            </div>
        </Card>
    )
}

export default CafeManagement
