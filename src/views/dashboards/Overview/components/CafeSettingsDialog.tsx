import { useState } from 'react'
import Button from '@/components/ui/Button'
import Dialog from '@/components/ui/Dialog'
import Input from '@/components/ui/Input'
import { FormItem, FormContainer } from '@/components/ui/Form'
import { useCafeStore } from '@/store/cafeStore'
import { TbPlus, TbTrash, TbEdit, TbCheck, TbX } from 'react-icons/tb'
import type { CafeConfig } from '@/store/cafeStore'

type CafeSettingsDialogProps = {
    isOpen: boolean
    onClose: () => void
}

type EditingCafe = Omit<CafeConfig, 'id'> & { id?: string }

const emptyForm: EditingCafe = { name: '', cafeId: '', apiKey: '' }

const CafeSettingsDialog = ({ isOpen, onClose }: CafeSettingsDialogProps) => {
    const { cafes, addCafe, updateCafe, removeCafe } = useCafeStore()
    const [editingId, setEditingId] = useState<string | 'new' | null>(null)
    const [form, setForm] = useState<EditingCafe>(emptyForm)

    const startAdd = () => {
        setForm(emptyForm)
        setEditingId('new')
    }

    const startEdit = (cafe: CafeConfig) => {
        setForm({ name: cafe.name, cafeId: cafe.cafeId, apiKey: cafe.apiKey })
        setEditingId(cafe.id)
    }

    const cancelEdit = () => {
        setEditingId(null)
        setForm(emptyForm)
    }

    const saveEdit = () => {
        if (!form.name.trim() || !form.cafeId.trim() || !form.apiKey.trim())
            return
        if (editingId === 'new') {
            addCafe(form)
        } else if (editingId) {
            updateCafe(editingId, form)
        }
        setEditingId(null)
        setForm(emptyForm)
    }

    return (
        <Dialog
            isOpen={isOpen}
            width={560}
            onClose={onClose}
            onRequestClose={onClose}
        >
            <h5 className="mb-4">Manage Cafes</h5>
            <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
                {cafes.map((cafe) => (
                    <div
                        key={cafe.id}
                        className="border border-gray-200 dark:border-gray-600 rounded-lg p-3"
                    >
                        {editingId === cafe.id ? (
                            <CafeForm
                                form={form}
                                onChange={setForm}
                                onSave={saveEdit}
                                onCancel={cancelEdit}
                            />
                        ) : (
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="font-semibold truncate">
                                        {cafe.name}
                                    </div>
                                    <div className="text-xs text-gray-500 truncate">
                                        ID: {cafe.cafeId}
                                    </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <Button
                                        size="xs"
                                        variant="plain"
                                        icon={<TbEdit />}
                                        onClick={() => startEdit(cafe)}
                                    />
                                    <Button
                                        size="xs"
                                        variant="plain"
                                        icon={<TbTrash />}
                                        customColorClass={() =>
                                            'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                                        }
                                        onClick={() => {
                                            if (
                                                window.confirm(
                                                    `Remove "${cafe.name}"?`,
                                                )
                                            ) {
                                                removeCafe(cafe.id)
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {editingId === 'new' && (
                    <div className="border border-primary rounded-lg p-3">
                        <CafeForm
                            form={form}
                            onChange={setForm}
                            onSave={saveEdit}
                            onCancel={cancelEdit}
                        />
                    </div>
                )}
            </div>

            <div className="mt-4 flex justify-between">
                <Button
                    size="sm"
                    variant="solid"
                    icon={<TbPlus />}
                    disabled={editingId !== null}
                    onClick={startAdd}
                >
                    Add Cafe
                </Button>
                <Button size="sm" onClick={onClose}>
                    Done
                </Button>
            </div>
        </Dialog>
    )
}

type CafeFormProps = {
    form: EditingCafe
    onChange: (form: EditingCafe) => void
    onSave: () => void
    onCancel: () => void
}

const CafeForm = ({ form, onChange, onSave, onCancel }: CafeFormProps) => {
    return (
        <FormContainer layout="vertical">
            <div className="grid grid-cols-1 gap-2">
                <FormItem label="Cafe Name" className="mb-0">
                    <Input
                        size="sm"
                        placeholder="e.g. My Cyber Cafe"
                        value={form.name}
                        onChange={(e) =>
                            onChange({ ...form, name: e.target.value })
                        }
                    />
                </FormItem>
                <FormItem label="Cafe ID" className="mb-0">
                    <Input
                        size="sm"
                        placeholder="iCafeCloud Cafe ID"
                        value={form.cafeId}
                        onChange={(e) =>
                            onChange({ ...form, cafeId: e.target.value })
                        }
                    />
                </FormItem>
                <FormItem label="API Key" className="mb-0">
                    <Input
                        size="sm"
                        placeholder="iCafeCloud API Key"
                        value={form.apiKey}
                        onChange={(e) =>
                            onChange({ ...form, apiKey: e.target.value })
                        }
                    />
                </FormItem>
            </div>
            <div className="flex gap-2 mt-2">
                <Button
                    size="xs"
                    variant="solid"
                    icon={<TbCheck />}
                    disabled={
                        !form.name.trim() ||
                        !form.cafeId.trim() ||
                        !form.apiKey.trim()
                    }
                    onClick={onSave}
                >
                    Save
                </Button>
                <Button size="xs" variant="plain" icon={<TbX />} onClick={onCancel}>
                    Cancel
                </Button>
            </div>
        </FormContainer>
    )
}

export default CafeSettingsDialog
