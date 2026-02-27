import Container from '@/components/shared/Container'
import UsersAction from './components/UsersAction'
import UsersTable from './components/UsersTable'
import UsersSelected from './components/UsersSelected'
import UserFormDialog from './components/UserFormDialog'
import useUsers from './hooks/useUsers'

const Users = () => {
    const { userList, isLoading, mutate } = useUsers()

    return (
        <>
            <Container>
                <div className="mb-6 flex flex-col gap-5">
                    <h3>Users</h3>
                    <UsersAction />
                </div>
                <UsersTable
                    userList={userList}
                    isLoading={isLoading}
                    mutate={mutate}
                />
            </Container>
            <UsersSelected mutate={mutate} />
            <UserFormDialog mutate={mutate} />
        </>
    )
}

export default Users
