import { useSessionUser, useToken } from '@/store/authStore'
import { TOKEN_NAME_IN_STORAGE } from '@/constants/api.constant'
import type { AxiosError } from 'axios'

const unauthorizedCode = [401, 419, 440]

const AxiosResponseIntrceptorErrorCallback = (error: AxiosError) => {
    const { response, config } = error
    const { setToken } = useToken()

    if (response && unauthorizedCode.includes(response.status)) {
        // Extract the token that was sent with this specific request
        const requestAuthHeader = config?.headers?.['Authorization'] as string | undefined
        const requestToken = requestAuthHeader?.replace(/^Bearer\s+/i, '') ?? ''

        // Only clear the session if the rejected token matches the currently
        // stored token. If the user just signed in with a new token, a stale
        // in-flight request from the previous session should NOT sign them out.
        const currentToken = localStorage.getItem(TOKEN_NAME_IN_STORAGE) ?? ''

        if (!requestToken || requestToken === currentToken) {
            setToken('')
            useSessionUser.getState().setUser({})
            useSessionUser.getState().setSessionSignedIn(false)
        }
    }
}

export default AxiosResponseIntrceptorErrorCallback
