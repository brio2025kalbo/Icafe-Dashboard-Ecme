import { useCallback } from 'react'
import useDarkMode from '@/utils/hooks/useDarkMode'
import withHeaderItem from '@/utils/hoc/withHeaderItem'
import { TbSun, TbMoon } from 'react-icons/tb'
import type { CommonProps } from '@/@types/common'

const _HeaderModeSwitcher = ({ className }: CommonProps) => {
    const [isDark, setIsDark] = useDarkMode()

    const onSwitchChange = useCallback(() => {
        setIsDark(isDark ? 'light' : 'dark')
    }, [isDark, setIsDark])

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
