import Button from '@/components/ui/Button'
import DebouceInput from '@/components/shared/DebouceInput'
import { useUsersStore } from '../store/usersStore'
import { TbSearch, TbUserPlus } from 'react-icons/tb'

const UsersAction = () => {
    const { query, setQuery, setDialog } = useUsersStore()

    return (
        <div className="flex items-center justify-between">
            <DebouceInput
                className="max-w-[300px]"
                placeholder="Search..."
                type="text"
                size="sm"
                prefix={<TbSearch className="text-lg" />}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            <Button
                size="sm"
                variant="solid"
                icon={<TbUserPlus />}
                onClick={() =>
                    setDialog({ type: 'new', open: true, user: null })
                }
            >
                Add User
            </Button>
        </div>
    )
}

export default UsersAction
