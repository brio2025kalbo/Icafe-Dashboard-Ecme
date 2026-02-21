import { BrowserRouter } from 'react-router'
import Theme from '@/components/template/Theme'
import Layout from '@/components/layouts'
import { AuthProvider } from '@/auth'
import Views from '@/views'
import appConfig from './configs/app.config'
import { useCafeStore } from '@/store/cafeStore'
import { useEffect } from 'react'

if (appConfig.enableMock) {
    import('./mock')
}

function App() {
    const cafes = useCafeStore((s) => s.cafes)
    const fetchCafes = useCafeStore((s) => s.fetchCafes)
    const setSelectedCafeId = useCafeStore((s) => s.setSelectedCafeId)

    useEffect(() => {
        // Load cafes from database on app startup
        fetchCafes().then(() => {
            // If no cafes in DB yet, seed with defaults
            if (cafes.length === 0 && appConfig.initialCafes.length > 0) {
                appConfig.initialCafes.forEach((cafe) => {
                    useCafeStore.getState().addCafe({
                        name: cafe.name,
                        cafeId: cafe.cafeId,
                        apiKey: cafe.apiKey,
                    })
                })
                setSelectedCafeId(appConfig.initialCafes[0].id)
            } else if (cafes.length > 0) {
                setSelectedCafeId(cafes[0].id)
            }
        })
    }, [])

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
