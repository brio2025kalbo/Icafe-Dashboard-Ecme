import { useState } from 'react'
import StickyFooter from '@/components/shared/StickyFooter'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { useUsersStore } from '../store/usersStore'
import { apiDeleteUser } from '@/services/AccontsService'
import { TbChecks } from 'react-icons/tb'
import type { MutateUsersResponse } from '../types'

type UsersSelectedProps = {
    mutate: MutateUsersResponse
}

const UsersSelected = ({ mutate }: UsersSelectedProps) => {
    const { selectedUsers, setSelectAllUsers } = useUsersStore()
    const [confirmOpen, setConfirmOpen] = useState(false)

    const handleConfirmDelete = async () => {
        try {
            await Promise.all(selectedUsers.map((u) => apiDeleteUser(u.id)))
            toast.push(
                <Notification type="success" title="Users deleted">
                    {selectedUsers.length} user(s) have been deleted.
                </Notification>,
                { placement: 'top-end' },
            )
            setSelectAllUsers([])
            mutate()
        } catch {
            toast.push(
                <Notification type="danger" title="Error">
                    Failed to delete some users.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setConfirmOpen(false)
        }
    }

    if (selectedUsers.length === 0) return null

    return (
        <>
            <StickyFooter
                className="-mx-8 flex items-center justify-between py-4 bg-white dark:bg-gray-800"
                stickyClass="border-t border-gray-200 dark:border-gray-700 px-8"
                defaultClass="container mx-auto px-8 rounded-xl border border-gray-200 dark:border-gray-600 mt-4"
            >
                <div className="container mx-auto">
                    <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <span className="text-lg text-primary">
                                <TbChecks />
                            </span>
                            <span className="font-semibold flex items-center gap-1">
                                <span className="heading-text">
                                    {selectedUsers.length} Users
                                </span>
                                <span>selected</span>
                            </span>
                        </span>
                        <Button
                            size="sm"
                            type="button"
                            customColorClass={() =>
                                'border-error ring-1 ring-error text-error hover:border-error hover:ring-error hover:text-error'
                            }
                            onClick={() => setConfirmOpen(true)}
                        >
                            Delete
                        </Button>
                    </div>
                </div>
            </StickyFooter>
            <ConfirmDialog
                isOpen={confirmOpen}
                type="danger"
                title="Delete selected users"
                onClose={() => setConfirmOpen(false)}
                onRequestClose={() => setConfirmOpen(false)}
                onCancel={() => setConfirmOpen(false)}
                onConfirm={handleConfirmDelete}
            >
                <p>
                    Are you sure you want to delete {selectedUsers.length}{' '}
                    user(s)? This action can&apos;t be undone.
                </p>
            </ConfirmDialog>
        </>
    )
}

export default UsersSelected
