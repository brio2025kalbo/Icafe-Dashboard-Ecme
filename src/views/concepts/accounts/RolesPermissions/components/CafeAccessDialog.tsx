import { useState, useEffect } from 'react'
import Dialog from '@/components/ui/Dialog'
import Button from '@/components/ui/Button'
import Checkbox from '@/components/ui/Checkbox'
import Spinner from '@/components/ui/Spinner'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { apiGetUserCafes, apiSetUserCafes } from '@/services/RbacService'
import type { User } from '../types'

type CafeItem = {
    id: string
    name: string
    cafeId: string
    hasAccess: boolean
}

type CafeAccessDialogProps = {
    user: User | null
    open: boolean
    onClose: () => void
    onSaved: () => void
}

const CafeAccessDialog = ({ user, open, onClose, onSaved }: CafeAccessDialogProps) => {
    const [cafes, setCafes] = useState<CafeItem[]>([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [selected, setSelected] = useState<Set<string>>(new Set())

    // Load cafes with access flags when dialog opens
    useEffect(() => {
        if (!open || !user) return
        setLoading(true)
        apiGetUserCafes(user.id)
            .then((data) => {
                setCafes(data.cafes || [])
                setSelected(new Set(data.cafes.filter((c: CafeItem) => c.hasAccess).map((c: CafeItem) => c.id)))
            })
            .catch(() => {
                toast.push(
                    <Notification type="danger" title="Failed to load cafe list" />,
                    { placement: 'top-center' },
                )
            })
            .finally(() => setLoading(false))
    }, [open, user])

    const toggle = (cafeId: string) => {
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(cafeId)) next.delete(cafeId)
            else next.add(cafeId)
            return next
        })
    }

    const toggleAll = () => {
        if (selected.size === cafes.length) {
            setSelected(new Set())
        } else {
            setSelected(new Set(cafes.map((c) => c.id)))
        }
    }

    const handleSave = async () => {
        if (!user) return
        setSaving(true)
        try {
            await apiSetUserCafes(user.id, Array.from(selected))
            toast.push(
                <Notification type="success" title={`Cafe access updated for ${user.name}`} />,
                { placement: 'top-center' },
            )
            onSaved()
            onClose()
        } catch {
            toast.push(
                <Notification type="danger" title="Failed to update cafe access" />,
                { placement: 'top-center' },
            )
        } finally {
            setSaving(false)
        }
    }

    const allSelected = cafes.length > 0 && selected.size === cafes.length
    const someSelected = selected.size > 0 && selected.size < cafes.length

    return (
        <Dialog
            isOpen={open}
            onClose={onClose}
            onRequestClose={onClose}
            width={480}
        >
            <h5 className="mb-1">Manage Cafe Access</h5>
            {user && (
                <p className="text-sm text-gray-500 mb-4">
                    Assign which cafes <strong>{user.name}</strong> can view.
                </p>
            )}

            {loading ? (
                <div className="flex justify-center py-8">
                    <Spinner size={32} />
                </div>
            ) : cafes.length === 0 ? (
                <p className="text-gray-400 text-sm py-4 text-center">
                    No cafes have been added yet. Add cafes first from the dashboard.
                </p>
            ) : (
                <div className="space-y-1">
                    {/* Select All */}
                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 mb-2">
                        <Checkbox
                            checked={allSelected}
                            indeterminate={someSelected}
                            onChange={toggleAll}
                        />
                        <span className="font-semibold text-sm">
                            {allSelected ? 'Deselect All' : 'Select All'} ({cafes.length} cafes)
                        </span>
                    </div>

                    {/* Individual cafes */}
                    {cafes.map((cafe) => (
                        <div
                            key={cafe.id}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                            onClick={() => toggle(cafe.id)}
                        >
                            <Checkbox
                                checked={selected.has(cafe.id)}
                                onChange={() => toggle(cafe.id)}
                            />
                            <div>
                                <div className="font-medium text-sm">{cafe.name}</div>
                                <div className="text-xs text-gray-400">ID: {cafe.cafeId}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
                <Button variant="plain" onClick={onClose} disabled={saving}>
                    Cancel
                </Button>
                <Button
                    variant="solid"
                    loading={saving}
                    disabled={loading || cafes.length === 0}
                    onClick={handleSave}
                >
                    Save Access
                </Button>
            </div>
        </Dialog>
    )
}

export default CafeAccessDialog
