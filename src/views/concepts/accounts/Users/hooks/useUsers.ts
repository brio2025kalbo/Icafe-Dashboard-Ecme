import useSWR from 'swr'
import { apiGetUsers } from '@/services/AccontsService'
import type { GetUsersResponse } from '../types'

export default function useUsers() {
    const { data, isLoading, error, mutate } = useSWR(
        '/api/users',
        () => apiGetUsers<GetUsersResponse>(),
        {
            revalidateOnFocus: false,
            revalidateIfStale: false,
            revalidateOnReconnect: false,
        },
    )

    const userList = data?.users || []

    return {
        userList,
        error,
        isLoading,
        mutate,
    }
}
