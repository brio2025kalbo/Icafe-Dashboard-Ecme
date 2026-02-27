import { QUICKBOOKS_PREFIX_PATH } from '@/constants/route.constant'
import { NAV_ITEM_TYPE_ITEM } from '@/constants/navigation.constant'
import { ADMIN } from '@/constants/roles.constant'
import type { NavigationTree } from '@/@types/navigation'

const quickbooksNavigationConfig: NavigationTree[] = [
    {
        key: 'quickbooks',
        path: `${QUICKBOOKS_PREFIX_PATH}`,
        title: 'QuickBooks',
        translateKey: 'nav.quickbooks',
        icon: 'quickbooks',
        type: NAV_ITEM_TYPE_ITEM,
        authority: [ADMIN],
        subMenu: [],
    },
]

export default quickbooksNavigationConfig
