
export type CafeConfig = {
    id: string;
    name: string;
    /** Numeric Cafe ID used in iCafeCloud API URLs */
    cafeId: string;
    apiKey: string;
};

export type AppConfig = {
    apiPrefix: string;
    authenticatedEntryPath: string;
    unAuthenticatedEntryPath: string;
    locale: string;
    accessTokenPersistStrategy: 'localStorage' | 'sessionStorage' | 'cookies';
    enableMock: boolean;
    activeNavTranslation: boolean;
    reportsApiPrefix: string;
    initialCafes: CafeConfig[];
};

const appConfig: AppConfig = {
    apiPrefix: '/api',
    authenticatedEntryPath: '/dashboards/overview',
    unAuthenticatedEntryPath: '/sign-in',
    locale: 'en',
    accessTokenPersistStrategy: 'localStorage',
    enableMock: true,
    activeNavTranslation: false,
    reportsApiPrefix: '/icafe-api',
    initialCafes: [
        { id: 'cafe1', name: 'Cafe A', cafeId: '', apiKey: '' },
        { id: 'cafe2', name: 'Cafe B', cafeId: '', apiKey: '' },
    ],
};

export default appConfig;
