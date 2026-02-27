import type { KeyedMutator } from 'swr'

export type User = {
    id: string
    username: string
    email: string
    role: string
    is_active: number
    created_at: string
}

export type Users = User[]

export type GetUsersResponse = {
    ok: boolean
    users: Users
}

export type MutateUsersResponse = KeyedMutator<GetUsersResponse>
