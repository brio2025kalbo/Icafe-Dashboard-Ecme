import { useRef, useImperativeHandle, useState, useEffect, useCallback } from 'react'
import AuthContext from './AuthContext'
import appConfig from '@/configs/app.config'
import { useSessionUser, useToken } from '@/store/authStore'
import { apiSignIn, apiSignOut, apiSignUp } from '@/services/AuthService'
import { REDIRECT_URL_KEY } from '@/constants/app.constant'
import { TOKEN_NAME_IN_STORAGE } from '@/constants/api.constant'
import { useNavigate } from 'react-router'
import type {
    SignInCredential,
    SignUpCredential,
    AuthResult,
    OauthSignInCallbackPayload,
    User,
    Token,
} from '@/@types/auth'
import { useCafeStore } from '@/store/cafeStore'
import type { ReactNode, Ref } from 'react'
import type { NavigateFunction } from 'react-router'

type AuthProviderProps = { children: ReactNode }

export type IsolatedNavigatorRef = {
    navigate: NavigateFunction
}

const IsolatedNavigator = ({ ref }: { ref: Ref<IsolatedNavigatorRef> }) => {
    const navigate = useNavigate()

    useImperativeHandle(ref, () => {
        return {
            navigate,
        }
    }, [navigate])

    return <></>
}

function AuthProvider({ children }: AuthProviderProps) {
    const signedIn = useSessionUser((state) => state.session.signedIn)
    const user = useSessionUser((state) => state.user)
    const setUser = useSessionUser((state) => state.setUser)
    const setSessionSignedIn = useSessionUser(
        (state) => state.setSessionSignedIn,
    )
    const { token, setToken } = useToken()
    const [tokenState, setTokenState] = useState(token)

    // Start in verifying state if there is a persisted token to validate.
    // This blocks rendering until we confirm the token is still valid on the server.
    const hasPersistedToken = Boolean(localStorage.getItem(TOKEN_NAME_IN_STORAGE) && signedIn)
    const [verifying, setVerifying] = useState<boolean>(hasPersistedToken)

    // Track whether the current sign-in was just performed (fresh login)
    // so we can skip the verification step for that case.
    const justSignedInRef = useRef(false)

    const authenticated = Boolean(tokenState && signedIn)

    const fetchCafes = useCafeStore((s) => s.fetchCafes)
    const setCafes = useCafeStore((s) => s.setCafes)
    const setSelectedCafeId = useCafeStore((s) => s.setSelectedCafeId)

    const navigatorRef = useRef<IsolatedNavigatorRef>(null)

    // On mount: validate the stored token against the server.
    // If the server rejects it (expired, revoked, server restarted), clear the
    // local session so the user is sent to /sign-in instead of a broken dashboard.
    useEffect(() => {
        const storedToken = localStorage.getItem(TOKEN_NAME_IN_STORAGE)
        if (!storedToken || !signedIn) {
            setVerifying(false)
            return
        }

        // Skip verification if we just signed in (token was freshly issued)
        if (justSignedInRef.current) {
            justSignedInRef.current = false
            setVerifying(false)
            return
        }

        fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${storedToken}` },
        })
            .then(async (res) => {
                if (!res.ok) {
                    // Token is invalid or session was revoked — clear everything
                    setToken('')
                    setTokenState('')
                    setSessionSignedIn(false)
                    setUser({})
                } else {
                    // Refresh user data from server in case role/avatar changed
                    const data = await res.json()
                    setUser(data)
                }
            })
            .catch(() => {
                // Network error — keep existing state (offline tolerance)
            })
            .finally(() => {
                setVerifying(false)
            })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const redirect = () => {
        const search = window.location.search
        const params = new URLSearchParams(search)
        const redirectUrl = params.get(REDIRECT_URL_KEY)

        navigatorRef.current?.navigate(
            redirectUrl ? redirectUrl : appConfig.authenticatedEntryPath,
        )
    }

    // Re-fetch cafes after sign-in so the correct access-filtered list is loaded
    // immediately for the signed-in user, without requiring a page refresh.
    const refreshCafes = useCallback(async (accessToken: string) => {
        try {
            const res = await fetch('/api/cafes', {
                headers: { Authorization: `Bearer ${accessToken}` },
            })
            const data = await res.json()
            if (data.ok && data.cafes.length > 0) {
                setCafes(data.cafes)
                setSelectedCafeId(data.cafes[0].id)
            } else {
                setCafes([])
                setSelectedCafeId(null)
            }
        } catch {
            // Non-critical — cafes will load on next navigation
        }
    }, [setCafes, setSelectedCafeId])

    const handleSignIn = (tokens: Token, user?: User) => {
        setToken(tokens.accessToken)
        setTokenState(tokens.accessToken)
        setSessionSignedIn(true)

        if (user) {
            setUser(user)
        }

        // Re-fetch cafes with the new token so access-filtered list is applied immediately
        refreshCafes(tokens.accessToken)
    }

    const handleSignOut = () => {
        setToken('')
        setTokenState('')
        setUser({})
        setSessionSignedIn(false)
        // Clear the cafe list so the next user starts fresh
        setCafes([])
        setSelectedCafeId(null)
    }

    const signIn = async (values: SignInCredential): AuthResult => {
        try {
            const resp = await apiSignIn(values)
            if (resp) {
                justSignedInRef.current = true
                handleSignIn({ accessToken: resp.token }, resp.user)
                redirect()
                return {
                    status: 'success',
                    message: '',
                }
            }
            return {
                status: 'failed',
                message: 'Unable to sign in',
            }
            // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        } catch (errors: any) {
            return {
                status: 'failed',
                message: errors?.response?.data?.message || errors.toString(),
            }
        }
    }

    const signUp = async (values: SignUpCredential): AuthResult => {
        try {
            const resp = await apiSignUp(values)
            if (resp) {
                justSignedInRef.current = true
                handleSignIn({ accessToken: resp.token }, resp.user)
                redirect()
                return {
                    status: 'success',
                    message: '',
                }
            }
            return {
                status: 'failed',
                message: 'Unable to sign up',
            }
            // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        } catch (errors: any) {
            return {
                status: 'failed',
                message: errors?.response?.data?.message || errors.toString(),
            }
        }
    }

    const signOut = async () => {
        try {
            await apiSignOut()
        } finally {
            handleSignOut()
            navigatorRef.current?.navigate('/sign-in')
        }
    }

    const oAuthSignIn = (
        callback: (payload: OauthSignInCallbackPayload) => void,
    ) => {
        callback({
            onSignIn: handleSignIn,
            redirect,
        })
    }

    // While verifying the stored token, show a minimal loading screen
    // to avoid a flash of the sign-in page or an incorrect redirect
    if (verifying) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                background: 'var(--color-gray-50, #f9fafb)',
            }}>
                <div style={{
                    width: 40,
                    height: 40,
                    border: '3px solid #e5e7eb',
                    borderTopColor: '#6366f1',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    return (
        <AuthContext.Provider
            value={{
                authenticated,
                user,
                signIn,
                signUp,
                signOut,
                oAuthSignIn,
            }}
        >
            {children}
            <IsolatedNavigator ref={navigatorRef} />
        </AuthContext.Provider>
    )
}

export default AuthProvider
