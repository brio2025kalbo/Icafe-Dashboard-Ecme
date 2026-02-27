import { lazy } from 'react'
import { QUICKBOOKS_PREFIX_PATH } from '@/constants/route.constant'
import { ADMIN } from '@/constants/roles.constant'
import type { Routes } from '@/@types/routes'

const quickbooksRoute: Routes = [
    {
        key: 'quickbooks',
        path: `${QUICKBOOKS_PREFIX_PATH}`,
        component: lazy(() => import('@/views/quickbooks/QuickBooks')),
        authority: [ADMIN],
        meta: {
            pageContainerType: 'contained',
        },
    },
]

export default quickbooksRoute
