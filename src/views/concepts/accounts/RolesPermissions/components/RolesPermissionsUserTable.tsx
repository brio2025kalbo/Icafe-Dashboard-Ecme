import { useMemo, useState } from 'react'
import Avatar from '@/components/ui/Avatar'
import Tag from '@/components/ui/Tag'
import Dropdown from '@/components/ui/Dropdown'
import Button from '@/components/ui/Button'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import DataTable from '@/components/shared/DataTable'
import CafeAccessDialog from './CafeAccessDialog'
import { useRolePermissionsStore } from '../store/rolePermissionsStore'
import { apiUpdateUserRole } from '@/services/RbacService'
import dayjs from 'dayjs'
import cloneDeep from 'lodash/cloneDeep'
import { TbChevronDown, TbBuildingStore } from 'react-icons/tb'
import type {
    User,
    Users,
    MutateRolesPermissionsUsersResponse,
    Roles,
} from '../types'
import type { OnSortParam, ColumnDef, Row } from '@/components/shared/DataTable'
import type { TableQueries } from '@/@types/common'

type RolesPermissionsUserTableProps = {
    isLoading: boolean
    userList: Users
    roleList: Roles
    userListTotal: number
    mutate: MutateRolesPermissionsUsersResponse
}

const statusColor: Record<string, string> = {
    active: 'bg-emerald-200 dark:bg-emerald-200 text-gray-900 dark:text-gray-900',
    blocked: 'bg-red-200 dark:bg-red-200 text-gray-900 dark:text-gray-900',
}

const RolesPermissionsUserTable = (props: RolesPermissionsUserTableProps) => {
    const { userList, userListTotal, isLoading, roleList, mutate } = props

    const {
        tableData,
        selectedUser,
        setTableData,
        setSelectedUser,
        setSelectAllUser,
    } = useRolePermissionsStore()

    // Cafe Access Dialog state
    const [cafeDialogUser, setCafeDialogUser] = useState<User | null>(null)
    const [cafeDialogOpen, setCafeDialogOpen] = useState(false)

    const openCafeDialog = (user: User) => {
        setCafeDialogUser(user)
        setCafeDialogOpen(true)
    }

    const closeCafeDialog = () => {
        setCafeDialogOpen(false)
        setCafeDialogUser(null)
    }

    const handleSetTableData = (data: TableQueries) => {
        setTableData(data)
        if (selectedUser.length > 0) {
            setSelectAllUser([])
        }
    }

    const handlePaginationChange = (page: number) => {
        const newTableData = cloneDeep(tableData)
        newTableData.pageIndex = page
        handleSetTableData(newTableData)
    }

    const handleSelectChange = (value: number) => {
        const newTableData = cloneDeep(tableData)
        newTableData.pageSize = Number(value)
        newTableData.pageIndex = 1
        handleSetTableData(newTableData)
    }

    const handleSort = (sort: OnSortParam) => {
        const newTableData = cloneDeep(tableData)
        newTableData.sort = sort
        handleSetTableData(newTableData)
    }

    const handleRowSelect = (checked: boolean, row: User) => {
        setSelectedUser(checked, row)
    }

    const handleAllRowSelect = (checked: boolean, rows: Row<User>[]) => {
        if (checked) {
            const originalRows = rows.map((row) => row.original)
            setSelectAllUser(originalRows)
        } else {
            setSelectAllUser([])
        }
    }

    const handleRoleChange = async (role: string, id: string, userName: string) => {
        // Optimistic update — update local SWR cache immediately
        const newUserList = structuredClone(userList).map((user) => {
            if (user.id === id) {
                user.role = role
            }
            return user
        })
        mutate({ list: newUserList, total: userListTotal }, false)

        try {
            await apiUpdateUserRole(id, role)
            toast.push(
                <Notification type="success" title="Role updated">
                    {userName}&apos;s role changed to <strong>{role}</strong>
                </Notification>,
                { placement: 'top-end' },
            )
            // Re-fetch from server to confirm
            mutate()
        } catch {
            // Roll back the optimistic update on failure
            mutate({ list: userList, total: userListTotal }, false)
            toast.push(
                <Notification type="danger" title="Failed to update role">
                    Could not change {userName}&apos;s role. Please try again.
                </Notification>,
                { placement: 'top-end' },
            )
        }
    }

    const columns: ColumnDef<User>[] = useMemo(
        () => [
            {
                header: 'Name',
                accessorKey: 'name',
                cell: (props) => {
                    const row = props.row.original
                    return (
                        <div className="flex items-center gap-2">
                            <Avatar size={40} shape="circle" src={row.img} />
                            <div>
                                <div className="font-bold heading-text">
                                    {row.name}
                                </div>
                                <div>{row.email}</div>
                            </div>
                        </div>
                    )
                },
            },
            {
                header: 'Status',
                accessorKey: 'status',
                cell: (props) => {
                    const row = props.row.original
                    return (
                        <div className="flex items-center">
                            <Tag className={statusColor[row.status]}>
                                <span className="capitalize">{row.status}</span>
                            </Tag>
                        </div>
                    )
                },
            },
            {
                header: 'Last online',
                accessorKey: 'lastOnline',
                cell: (props) => {
                    const row = props.row.original
                    return (
                        <div className="flex flex-col">
                            <span className="font-semibold">
                                {dayjs
                                    .unix(row.lastOnline)
                                    .format('MMMM, D YYYY')}
                            </span>
                            <small>
                                {dayjs.unix(row.lastOnline).format('hh:mm A')}
                            </small>
                        </div>
                    )
                },
            },
            {
                header: 'Role',
                accessorKey: 'role',
                size: 70,
                cell: (props) => {
                    const row = props.row.original
                    return (
                        <Dropdown
                            renderTitle={
                                <div
                                    className="inline-flex items-center gap-2 py-2 px-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                                    role="button"
                                >
                                    <span className="font-bold heading-text">
                                        {
                                            roleList.find(
                                                (role) => role.id === row.role,
                                            )?.name
                                        }
                                    </span>
                                    <TbChevronDown />
                                </div>
                            }
                        >
                            {roleList
                                .filter((role) => role.id !== row.role)
                                .map((role) => (
                                    <Dropdown.Item
                                        key={role.id}
                                        eventKey={role.id}
                                        onClick={() =>
                                            handleRoleChange(role.id, row.id, row.name)
                                        }
                                    >
                                        {role.name}
                                    </Dropdown.Item>
                                ))}
                        </Dropdown>
                    )
                },
            },
            {
                header: 'Cafe Access',
                id: 'cafeAccess',
                size: 130,
                cell: (props) => {
                    const row = props.row.original
                    // Admins always have full access — no need to manage
                    if (row.role === 'admin') {
                        return (
                            <span className="text-xs text-gray-400 italic">
                                All cafes (admin)
                            </span>
                        )
                    }
                    return (
                        <Button
                            size="xs"
                            variant="twoTone"
                            icon={<TbBuildingStore />}
                            onClick={() => openCafeDialog(row)}
                        >
                            Manage
                        </Button>
                    )
                },
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [roleList, userList],
    )

    return (
        <>
            <DataTable
                selectable
                columns={columns}
                data={userList}
                noData={!isLoading && userList.length === 0}
                skeletonAvatarColumns={[0]}
                skeletonAvatarProps={{ width: 28, height: 28 }}
                loading={isLoading}
                pagingData={{
                    total: userListTotal,
                    pageIndex: tableData.pageIndex as number,
                    pageSize: tableData.pageSize as number,
                }}
                checkboxChecked={(row) =>
                    selectedUser.some((selected) => selected.id === row.id)
                }
                hoverable={false}
                onPaginationChange={handlePaginationChange}
                onSelectChange={handleSelectChange}
                onSort={handleSort}
                onCheckBoxChange={handleRowSelect}
                onIndeterminateCheckBoxChange={handleAllRowSelect}
            />

            <CafeAccessDialog
                user={cafeDialogUser}
                open={cafeDialogOpen}
                onClose={closeCafeDialog}
                onSaved={() => mutate()}
            />
        </>
    )
}

export default RolesPermissionsUserTable
