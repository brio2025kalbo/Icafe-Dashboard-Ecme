import { QUICKBOOKS_PREFIX_PATH, GOOGLESHEETS_PREFIX_PATH, XERO_PREFIX_PATH } from '@/constants/route.constant'
import { NAV_ITEM_TYPE_TITLE, NAV_ITEM_TYPE_ITEM } from '@/constants/navigation.constant'
import { ADMIN } from '@/constants/roles.constant'
import type { NavigationTree } from '@/@types/navigation'

const integrationsNavigationConfig: NavigationTree[] = [
    {
        key: 'integrations',
        path: '',
        title: 'Integrations',
        translateKey: 'nav.integrations',
        icon: '',
        type: NAV_ITEM_TYPE_TITLE,
        authority: [ADMIN],
        subMenu: [
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
            {
                key: 'xero',
                path: `${XERO_PREFIX_PATH}`,
                title: 'Xero',
                translateKey: 'nav.xero',
                icon: 'xero',
                type: NAV_ITEM_TYPE_ITEM,
                authority: [ADMIN],
                subMenu: [],
            },
        ],
    },
]

export default integrationsNavigationConfig
