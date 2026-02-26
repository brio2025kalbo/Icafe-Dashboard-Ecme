import { lazy } from 'react'
import { XERO_PREFIX_PATH } from '@/constants/route.constant'
import { ADMIN } from '@/constants/roles.constant'
import type { Routes } from '@/@types/routes'

const xeroRoute: Routes = [
    {
        key: 'xero',
        path: `${XERO_PREFIX_PATH}`,
        component: lazy(() => import('@/views/xero/Xero')),
        authority: [ADMIN],
        meta: {
            pageContainerType: 'contained',
        },
    },
]

export default xeroRoute
