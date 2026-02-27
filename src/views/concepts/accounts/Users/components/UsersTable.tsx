import { useMemo, useState } from 'react'
import Tag from '@/components/ui/Tag'
import Button from '@/components/ui/Button'
import Tooltip from '@/components/ui/Tooltip'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import DataTable from '@/components/shared/DataTable'
import { useUsersStore } from '../store/usersStore'
import { apiDeleteUser } from '@/services/AccontsService'
import { useSessionUser } from '@/store/authStore'
import { TbPencil, TbTrash } from 'react-icons/tb'
import type { User, Users, MutateUsersResponse } from '../types'
import type { ColumnDef, Row } from '@/components/shared/DataTable'

type UsersTableProps = {
    userList: Users
    isLoading: boolean
    mutate: MutateUsersResponse
}

const statusColor: Record<number, string> = {
    1: 'bg-emerald-200 dark:bg-emerald-200 text-gray-900 dark:text-gray-900',
    0: 'bg-red-200 dark:bg-red-200 text-gray-900 dark:text-gray-900',
}

const UsersTable = ({ userList, isLoading, mutate }: UsersTableProps) => {
    const currentUser = useSessionUser((state) => state.user)
    const { query, selectedUsers, setSelectedUsers, setSelectAllUsers, setDialog } =
        useUsersStore()

    const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
    const [deleteOpen, setDeleteOpen] = useState(false)

    const filteredList = useMemo(() => {
        if (!query) return userList
        const q = query.toLowerCase()
        return userList.filter(
            (u) =>
                u.username.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q) ||
                u.role.toLowerCase().includes(q),
        )
    }, [userList, query])

    const handleEdit = (user: User) => {
        setDialog({ type: 'edit', open: true, user })
    }

    const handleDeleteClick = (user: User) => {
        setDeleteTarget(user)
        setDeleteOpen(true)
    }

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return
        try {
            await apiDeleteUser(deleteTarget.id)
            toast.push(
                <Notification type="success" title="User deleted">
                    {deleteTarget.username} has been deleted.
                </Notification>,
                { placement: 'top-end' },
            )
            mutate()
        } catch {
            toast.push(
                <Notification type="danger" title="Error">
                    Failed to delete user.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setDeleteOpen(false)
            setDeleteTarget(null)
        }
    }

    const columns: ColumnDef<User>[] = useMemo(
        () => [
            {
                header: 'Username',
                accessorKey: 'username',
            },
            {
                header: 'Email',
                accessorKey: 'email',
            },
            {
                header: 'Role',
                accessorKey: 'role',
                cell: (props) => (
                    <span className="capitalize">{props.row.original.role}</span>
                ),
            },
            {
                header: 'Status',
                accessorKey: 'is_active',
                cell: (props) => {
                    const active = props.row.original.is_active
                    return (
                        <Tag className={statusColor[active]}>
                            {active ? 'Active' : 'Blocked'}
                        </Tag>
                    )
                },
            },
            {
                header: 'Actions',
                id: 'actions',
                cell: (props) => {
                    const row = props.row.original
                    const isSelf = row.id === currentUser.userId
                    return (
                        <div className="flex items-center gap-2">
                            <Tooltip title="Edit">
                                <Button
                                    size="xs"
                                    variant="plain"
                                    icon={<TbPencil />}
                                    onClick={() => handleEdit(row)}
                                />
                            </Tooltip>
                            <Tooltip
                                title={
                                    isSelf
                                        ? 'Cannot delete your own account'
                                        : 'Delete'
                                }
                            >
                                <Button
                                    size="xs"
                                    variant="plain"
                                    customColorClass={() =>
                                        'text-error hover:text-error'
                                    }
                                    icon={<TbTrash />}
                                    disabled={isSelf}
                                    onClick={() => handleDeleteClick(row)}
                                />
                            </Tooltip>
                        </div>
                    )
                },
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [currentUser, userList],
    )

    const handleRowSelect = (checked: boolean, row: User) => {
        setSelectedUsers(checked, row)
    }

    const handleAllRowSelect = (checked: boolean, rows: Row<User>[]) => {
        if (checked) {
            setSelectAllUsers(rows.map((r) => r.original))
        } else {
            setSelectAllUsers([])
        }
    }

    return (
        <>
            <DataTable
                selectable
                columns={columns}
                data={filteredList}
                noData={!isLoading && filteredList.length === 0}
                loading={isLoading}
                hoverable={false}
                checkboxChecked={(row) =>
                    selectedUsers.some((u) => u.id === row.id)
                }
                onCheckBoxChange={handleRowSelect}
                onIndeterminateCheckBoxChange={handleAllRowSelect}
            />
            <ConfirmDialog
                isOpen={deleteOpen}
                type="danger"
                title="Delete user"
                onClose={() => setDeleteOpen(false)}
                onRequestClose={() => setDeleteOpen(false)}
                onCancel={() => setDeleteOpen(false)}
                onConfirm={handleDeleteConfirm}
            >
                <p>
                    Are you sure you want to delete{' '}
                    <strong>{deleteTarget?.username}</strong>? This action
                    can&apos;t be undone.
                </p>
            </ConfirmDialog>
        </>
    )
}

export default UsersTable
