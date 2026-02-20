/**
 * iCafe Cloud API configuration.
 *
 * Values are read from environment variables so they can be changed per
 * deployment without touching source code.  Copy `.env.example` to `.env`
 * and fill in the values for your café.
 */
const icafeConfig = {
    /**
     * Base URL of the iCafe Cloud REST API.
     * Default: https://api.icafecloud.com
     */
    apiUrl: import.meta.env.VITE_ICAFE_API_URL || 'https://api.icafecloud.com',

    /**
     * Bearer API token generated in the iCafe Cloud Admin Panel under
     * Settings → API settings → Generate API token.
     */
    apiKey: import.meta.env.VITE_ICAFE_API_KEY || '',

    /**
     * The unique Café ID shown in the iCafe Cloud dashboard.
     * All v2 endpoints are scoped to this ID: /api/v2/cafe/{cafeId}/...
     */
    cafeId: import.meta.env.VITE_ICAFE_CAFE_ID || '',
}

export default icafeConfig
