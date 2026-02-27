import { lazy } from 'react'
import { GOOGLESHEETS_PREFIX_PATH } from '@/constants/route.constant'
import { ADMIN } from '@/constants/roles.constant'
import type { Routes } from '@/@types/routes'

const googlesheetsRoute: Routes = [
    {
        key: 'googlesheets',
        path: `${GOOGLESHEETS_PREFIX_PATH}`,
        component: lazy(() => import('@/views/googlesheets/GoogleSheets')),
        authority: [ADMIN],
        meta: {
            pageContainerType: 'contained',
        },
    },
]

export default googlesheetsRoute
