export type AppConfig = {
    apiPrefix: string
    authenticatedEntryPath: string
    unAuthenticatedEntryPath: string
    locale: string
    accessTokenPersistStrategy: 'localStorage' | 'sessionStorage' | 'cookies'
    enableMock: boolean
    activeNavTranslation: boolean
}

const appConfig: AppConfig = {
    apiPrefix: '/api',
    authenticatedEntryPath: '/dashboards/overview',
    unAuthenticatedEntryPath: '/sign-in',
    locale: 'en',
    accessTokenPersistStrategy: 'localStorage',
    enableMock: true,
    activeNavTranslation: false,
}

export default appConfig
