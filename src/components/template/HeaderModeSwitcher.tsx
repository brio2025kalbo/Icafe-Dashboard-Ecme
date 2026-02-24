import { useCallback } from 'react'
import useDarkMode from '@/utils/hooks/useDarkMode'
import withHeaderItem from '@/utils/hoc/withHeaderItem'
import { useAuth } from '@/auth'
import { useToken } from '@/store/authStore'
import { TbSun, TbMoon } from 'react-icons/tb'
import type { CommonProps } from '@/@types/common'

const _HeaderModeSwitcher = ({ className }: CommonProps) => {
    const [isDark, setIsDark] = useDarkMode()
    const { user } = useAuth()
    const { token } = useToken()

    const onSwitchChange = useCallback(async () => {
        const newMode = isDark ? 'light' : 'dark'
        setIsDark(newMode)

        // Persist to database if user is logged in
        if (user?.userId && token) {
            try {
                await fetch(`/api/users/${user.userId}/profile`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ theme_mode: newMode }),
                })
            } catch (error) {
                console.error('Failed to save theme preference:', error)
            }
        }
    }, [isDark, setIsDark, user, token])

    return (
        <div className={className} onClick={onSwitchChange}>
            <div className="text-2xl">
                {isDark ? <TbSun /> : <TbMoon />}
            </div>
        </div>
    )
}

const HeaderModeSwitcher = withHeaderItem(_HeaderModeSwitcher)

export default HeaderModeSwitcher
