import { BrowserRouter } from 'react-router'
import Theme from '@/components/template/Theme'
import Layout from '@/components/layouts'
import { AuthProvider } from '@/auth'
import Views from '@/views'
import appConfig from './configs/app.config';
import { useCafeStore } from '@/store/cafeStore';
import { useEffect } from 'react';

if (appConfig.enableMock) {
    import('./mock')
}

function App() {
    const setCafes = useCafeStore((state) => state.setCafes);
    const setSelectedCafeId = useCafeStore((state) => state.setSelectedCafeId);

    const cafes = useCafeStore((state) => state.cafes);

    useEffect(() => {
        // Only seed defaults when the user has no saved cafes yet (first visit)
        if (cafes.length === 0 && appConfig.initialCafes.length > 0) {
            setCafes(appConfig.initialCafes);
            setSelectedCafeId(appConfig.initialCafes[0].id);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return (
        <Theme>
            <BrowserRouter>
                <AuthProvider>
                    <Layout>
                        <Views />
                    </Layout>
                </AuthProvider>
            </BrowserRouter>
        </Theme>
    )
}

export default App
