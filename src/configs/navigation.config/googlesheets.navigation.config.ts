import { GOOGLESHEETS_PREFIX_PATH } from '@/constants/route.constant'
import { NAV_ITEM_TYPE_ITEM } from '@/constants/navigation.constant'
import { ADMIN } from '@/constants/roles.constant'
import type { NavigationTree } from '@/@types/navigation'

const googlesheetsNavigationConfig: NavigationTree[] = [
    {
        key: 'googlesheets',
        path: `${GOOGLESHEETS_PREFIX_PATH}`,
        title: 'Google Sheets',
        translateKey: 'nav.googlesheets',
        icon: 'googlesheets',
        type: NAV_ITEM_TYPE_ITEM,
        authority: [ADMIN],
        subMenu: [],
    },
]

export default googlesheetsNavigationConfig
