/**
 * iCafe Cloud API v2 — Service layer.
 *
 * All functions call the real iCafe Cloud REST API at https://api.icafecloud.com
 * using the dedicated IcafeAxios instance (Bearer token injected automatically).
 *
 * Reference: https://dev.icafecloud.com/docs/
 */
import IcafeAxios from './axios/IcafeAxios'
import icafeConfig from '@/configs/icafe.config'
import type {
    IcafeResponse,
    IcafeCafe,
    IcafeMember,
    IcafeTopUpRequest,
    IcafeTopUpResponse,
    IcafeFetchBonusRequest,
    IcafeFetchBonusResponse,
    IcafeSession,
    IcafePC,
    IcafePCPowerRequest,
    IcafePCPowerResponse,
    IcafePushClientStatusRequest,
} from '@/@types/icafe'

const cafeId = icafeConfig.cafeId
const v2 = (path: string) => `/api/v2/cafe/${cafeId}${path}`

// ─── Café info ───────────────────────────────────────────────────────────────

/**
 * GET /api/v2/cafe/{cafeId}
 * Returns general information about the café.
 */
export async function apiGetCafeInfo() {
    const response =
        await IcafeAxios.get<IcafeResponse<IcafeCafe>>(v2(''))
    return response.data
}

// ─── Members ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v2/cafe/{cafeId}/members
 * Returns the full list of members registered at the café.
 */
export async function apiGetMembers() {
    const response = await IcafeAxios.get<IcafeResponse<IcafeMember[]>>(
        v2('/members'),
    )
    return response.data
}

/**
 * POST /api/v2/cafe/{cafeId}/members/action/fetchBonus
 * Calculates the bonus amount for a top-up before performing the top-up.
 * Call this first, then pass the returned bonus into apiTopUpMember().
 */
export async function apiFetchTopUpBonus(data: IcafeFetchBonusRequest) {
    const response = await IcafeAxios.post<IcafeResponse<IcafeFetchBonusResponse>>(
        v2('/members/action/fetchBonus'),
        data,
    )
    return response.data
}

/**
 * POST /api/v2/cafe/{cafeId}/members/action/topup
 * Adds credit to a member's account.
 * Recommended flow: call apiFetchTopUpBonus() first, then include the
 * returned bonus as topup_balance_bonus in the request body.
 */
export async function apiTopUpMember(data: IcafeTopUpRequest) {
    const response = await IcafeAxios.post<IcafeResponse<IcafeTopUpResponse>>(
        v2('/members/action/topup'),
        data,
    )
    return response.data
}

// ─── Sessions ────────────────────────────────────────────────────────────────

/**
 * GET /api/v2/cafe/{cafeId}/sessions
 * Returns all active (and recent) sessions at the café.
 */
export async function apiGetSessions() {
    const response = await IcafeAxios.get<IcafeResponse<IcafeSession[]>>(
        v2('/sessions'),
    )
    return response.data
}

/**
 * POST /api/v2/cafe/{cafeId}/sessions/{sessionId}/end
 * Ends (kicks) an active session.
 */
export async function apiEndSession(sessionId: string) {
    const response = await IcafeAxios.post<IcafeResponse<null>>(
        v2(`/sessions/${sessionId}/end`),
    )
    return response.data
}

// ─── PCs ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/v2/cafe/{cafeId}/pcs
 * Returns status information for all PCs in the café.
 */
export async function apiGetPCs() {
    const response = await IcafeAxios.get<IcafeResponse<IcafePC[]>>(
        v2('/pcs'),
    )
    return response.data
}

/**
 * POST /api/v2/cafe/{cafeId}/pcSessions/sendWssCommand
 * Sends a power command (boot / shutdown / reboot) to one or more PCs.
 *
 * Example:
 *   apiSendPCPowerCommand({ action: 'power', target: 'reboot', data: { power_type: 'reboot', ids: [1, 2, 3] } })
 */
export async function apiSendPCPowerCommand(data: IcafePCPowerRequest) {
    const response = await IcafeAxios.post<IcafePCPowerResponse>(
        v2('/pcSessions/sendWssCommand'),
        data,
    )
    return response.data
}

// ─── Client status ────────────────────────────────────────────────────────────

/**
 * POST /api/v2/cafe/{cafeId}/clients/pushClientStatus
 * Notifies a client PC of a balance or status change (e.g. after a top-up).
 * Call this after apiTopUpMember() to ensure the PC session reflects the new balance.
 */
export async function apiPushClientStatus(data: IcafePushClientStatusRequest) {
    const response = await IcafeAxios.post<IcafeResponse<null>>(
        v2('/clients/pushClientStatus'),
        data,
    )
    return response.data
}
