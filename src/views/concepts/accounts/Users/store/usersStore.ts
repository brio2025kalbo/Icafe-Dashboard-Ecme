import { create } from 'zustand'
import type { User, Users } from '../types'

export type UserDialog = {
    type: '' | 'edit' | 'new'
    open: boolean
    user: User | null
}

export type UsersState = {
    query: string
    selectedUsers: Users
    dialog: UserDialog
}

type UsersAction = {
    setQuery: (query: string) => void
    setSelectedUsers: (checked: boolean, user: User) => void
    setSelectAllUsers: (users: Users) => void
    setDialog: (dialog: UserDialog) => void
}

const initialState: UsersState = {
    query: '',
    selectedUsers: [],
    dialog: { type: '', open: false, user: null },
}

export const useUsersStore = create<UsersState & UsersAction>((set) => ({
    ...initialState,
    setQuery: (query) => set(() => ({ query })),
    setSelectedUsers: (checked, user) =>
        set((state) => {
            const prev = state.selectedUsers
            if (checked) {
                return { selectedUsers: [...prev, user] }
            }
            return {
                selectedUsers: prev.filter((u) => u.id !== user.id),
            }
        }),
    setSelectAllUsers: (users) => set(() => ({ selectedUsers: users })),
    setDialog: (dialog) => set(() => ({ dialog })),
}))
