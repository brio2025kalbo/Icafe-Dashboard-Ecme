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
    IcafeCreateMemberRequest,
    IcafeUpdateMemberRequest,
    IcafeDeductBalanceRequest,
    IcafeDeductBalanceResponse,
    IcafeConvertGuestRequest,
    IcafeTopUpRequest,
    IcafeTopUpResponse,
    IcafeFetchBonusRequest,
    IcafeFetchBonusResponse,
    IcafeSession,
    IcafePC,
    IcafePCPowerRequest,
    IcafePCPowerResponse,
    IcafePCGroup,
    IcafeZone,
    IcafePackage,
    IcafeCreatePackageRequest,
    IcafeUpdatePackageRequest,
    IcafeBooking,
    IcafeCreateBookingRequest,
    IcafeFoodOrder,
    IcafeCreateFoodOrderRequest,
    IcafeAnnouncement,
    IcafeCreateAnnouncementRequest,
    IcafeReportParams,
    IcafeReport,
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
    const response = await IcafeAxios.get<IcafeResponse<IcafeCafe>>(v2(''))
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
 * POST /api/v2/cafe/{cafeId}/members/action/create
 * Registers a new member in the system.
 */
export async function apiCreateMember(data: IcafeCreateMemberRequest) {
    const response = await IcafeAxios.post<IcafeResponse<IcafeMember>>(
        v2('/members/action/create'),
        data,
    )
    return response.data
}

/**
 * POST /api/v2/cafe/{cafeId}/members/action/update
 * Updates an existing member's details (nickname, email, phone, group, status).
 */
export async function apiUpdateMember(data: IcafeUpdateMemberRequest) {
    const response = await IcafeAxios.post<IcafeResponse<IcafeMember>>(
        v2('/members/action/update'),
        data,
    )
    return response.data
}

/**
 * POST /api/v2/cafe/{cafeId}/members/action/deductBalance
 * Deducts credit from a member's account (e.g. for purchases or penalties).
 */
export async function apiDeductMemberBalance(
    data: IcafeDeductBalanceRequest,
) {
    const response = await IcafeAxios.post<
        IcafeResponse<IcafeDeductBalanceResponse>
    >(v2('/members/action/deductBalance'), data)
    return response.data
}

/**
 * POST /api/v2/cafe/{cafeId}/members/action/convertToMember
 * Converts a guest account into a permanent member.
 */
export async function apiConvertGuestToMember(
    data: IcafeConvertGuestRequest,
) {
    const response = await IcafeAxios.post<IcafeResponse<IcafeMember>>(
        v2('/members/action/convertToMember'),
        data,
    )
    return response.data
}

/**
 * POST /api/v2/cafe/{cafeId}/members/action/fetchBonus
 * Calculates the bonus amount for a top-up before performing the top-up.
 * Call this first, then pass the returned bonus into apiTopUpMember().
 */
export async function apiFetchTopUpBonus(data: IcafeFetchBonusRequest) {
    const response = await IcafeAxios.post<
        IcafeResponse<IcafeFetchBonusResponse>
    >(v2('/members/action/fetchBonus'), data)
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

// ─── PC Groups ───────────────────────────────────────────────────────────────

/**
 * GET /api/v2/cafe/{cafeId}/pcgroups
 * Returns all PC groups defined in the café (used for zone/pricing segmentation).
 */
export async function apiGetPCGroups() {
    const response = await IcafeAxios.get<IcafeResponse<IcafePCGroup[]>>(
        v2('/pcgroups'),
    )
    return response.data
}

// ─── Zones ───────────────────────────────────────────────────────────────────

/**
 * GET /api/v2/cafe/{cafeId}/zones
 * Returns all physical or logical zones configured in the café.
 */
export async function apiGetZones() {
    const response = await IcafeAxios.get<IcafeResponse<IcafeZone[]>>(
        v2('/zones'),
    )
    return response.data
}

// ─── Packages ────────────────────────────────────────────────────────────────

/**
 * GET /api/v2/cafe/{cafeId}/packages
 * Returns all time/prepaid packages available at the café.
 */
export async function apiGetPackages() {
    const response = await IcafeAxios.get<IcafeResponse<IcafePackage[]>>(
        v2('/packages'),
    )
    return response.data
}

/**
 * POST /api/v2/cafe/{cafeId}/packages/action/create
 * Creates a new time or prepaid package.
 */
export async function apiCreatePackage(data: IcafeCreatePackageRequest) {
    const response = await IcafeAxios.post<IcafeResponse<IcafePackage>>(
        v2('/packages/action/create'),
        data,
    )
    return response.data
}

/**
 * POST /api/v2/cafe/{cafeId}/packages/action/update
 * Updates an existing package.
 */
export async function apiUpdatePackage(data: IcafeUpdatePackageRequest) {
    const response = await IcafeAxios.post<IcafeResponse<IcafePackage>>(
        v2('/packages/action/update'),
        data,
    )
    return response.data
}

// ─── Bookings ────────────────────────────────────────────────────────────────

/**
 * GET /api/v2/cafe/{cafeId}/bookings
 * Returns all current and upcoming seat bookings.
 */
export async function apiGetBookings() {
    const response = await IcafeAxios.get<IcafeResponse<IcafeBooking[]>>(
        v2('/bookings'),
    )
    return response.data
}

/**
 * POST /api/v2/cafe/{cafeId}/bookings
 * Creates a new seat booking for a member.
 */
export async function apiCreateBooking(data: IcafeCreateBookingRequest) {
    const response = await IcafeAxios.post<IcafeResponse<IcafeBooking>>(
        v2('/bookings'),
        data,
    )
    return response.data
}

/**
 * DELETE /api/v2/cafe/{cafeId}/bookings/{bookingId}
 * Cancels an existing booking.
 */
export async function apiCancelBooking(bookingId: number) {
    const response = await IcafeAxios.delete<IcafeResponse<null>>(
        v2(`/bookings/${bookingId}`),
    )
    return response.data
}

// ─── Food Orders ─────────────────────────────────────────────────────────────

/**
 * GET /api/v2/cafe/{cafeId}/orders/food
 * Returns all food orders placed at the café.
 */
export async function apiGetFoodOrders() {
    const response = await IcafeAxios.get<IcafeResponse<IcafeFoodOrder[]>>(
        v2('/orders/food'),
    )
    return response.data
}

/**
 * POST /api/v2/cafe/{cafeId}/orders/food
 * Places a new food order on behalf of a member at a PC.
 */
export async function apiCreateFoodOrder(data: IcafeCreateFoodOrderRequest) {
    const response = await IcafeAxios.post<IcafeResponse<IcafeFoodOrder>>(
        v2('/orders/food'),
        data,
    )
    return response.data
}

// ─── Announcements ────────────────────────────────────────────────────────────

/**
 * GET /api/v2/cafe/{cafeId}/announcements
 * Returns all announcements visible to café clients.
 */
export async function apiGetAnnouncements() {
    const response = await IcafeAxios.get<IcafeResponse<IcafeAnnouncement[]>>(
        v2('/announcements'),
    )
    return response.data
}

/**
 * POST /api/v2/cafe/{cafeId}/announcements
 * Broadcasts a new announcement to café clients.
 */
export async function apiCreateAnnouncement(
    data: IcafeCreateAnnouncementRequest,
) {
    const response = await IcafeAxios.post<IcafeResponse<IcafeAnnouncement>>(
        v2('/announcements'),
        data,
    )
    return response.data
}

// ─── Reports ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v2/cafe/{cafeId}/reports
 * Fetches activity / revenue / session reports for a given date range.
 *
 * Example:
 *   apiGetReports({ startDate: '2024-01-01', endDate: '2024-01-31', type: 'revenue' })
 */
export async function apiGetReports(params: IcafeReportParams) {
    const response = await IcafeAxios.get<IcafeResponse<IcafeReport>>(
        v2('/reports'),
        { params },
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
