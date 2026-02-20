/**
 * iCafe Cloud API v2 — Service layer.
 *
 * ── Single-café usage (default) ──────────────────────────────────────────────
 * Import the named exports directly:
 *   import { apiGetMembers, apiTopUpMember } from '@/services/IcafeService'
 * These use the credentials from VITE_ICAFE_API_KEY / VITE_ICAFE_CAFE_ID.
 *
 * ── Multi-café usage ─────────────────────────────────────────────────────────
 * Call the factory with a specific café's config:
 *   import { createIcafeService } from '@/services/IcafeService'
 *   import { icafeCafes } from '@/configs/icafe.config'
 *
 *   const branchA = createIcafeService(icafeCafes[0])
 *   const branchB = createIcafeService(icafeCafes[1])
 *   const members = await branchA.apiGetMembers()
 *
 * Reference: https://dev.icafecloud.com/docs/
 */
import { createIcafeAxios } from './axios/IcafeAxios'
import icafeConfig from '@/configs/icafe.config'
import type {
    IcafeCafeConfig,
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
    IcafeStaff,
    IcafeCreateStaffRequest,
    IcafeUpdateStaffRequest,
    IcafeBillingLogParams,
    IcafeBillingLogListResponse,
    IcafeTransactionParams,
    IcafeTransactionListResponse,
    IcafeReceipt,
    IcafePushClientStatusRequest,
} from '@/@types/icafe'

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a fully scoped iCafe Cloud service client for a single café.
 * Every returned function uses `cafeConfig.cafeId` in the URL and
 * `cafeConfig.apiKey` in the Authorization header.
 */
export function createIcafeService(cafeConfig: IcafeCafeConfig) {
    const http = createIcafeAxios(cafeConfig)
    const v2 = (path: string) =>
        `/api/v2/cafe/${cafeConfig.cafeId}${path}`

    // ── Café info ─────────────────────────────────────────────────────────────

    /** GET /api/v2/cafe/{cafeId} */
    async function apiGetCafeInfo() {
        const res = await http.get<IcafeResponse<IcafeCafe>>(v2(''))
        return res.data
    }

    // ── Members ───────────────────────────────────────────────────────────────

    /** GET /api/v2/cafe/{cafeId}/members */
    async function apiGetMembers() {
        const res = await http.get<IcafeResponse<IcafeMember[]>>(v2('/members'))
        return res.data
    }

    /** POST /api/v2/cafe/{cafeId}/members/action/create */
    async function apiCreateMember(data: IcafeCreateMemberRequest) {
        const res = await http.post<IcafeResponse<IcafeMember>>(
            v2('/members/action/create'),
            data,
        )
        return res.data
    }

    /** POST /api/v2/cafe/{cafeId}/members/action/update */
    async function apiUpdateMember(data: IcafeUpdateMemberRequest) {
        const res = await http.post<IcafeResponse<IcafeMember>>(
            v2('/members/action/update'),
            data,
        )
        return res.data
    }

    /** POST /api/v2/cafe/{cafeId}/members/action/deductBalance */
    async function apiDeductMemberBalance(data: IcafeDeductBalanceRequest) {
        const res = await http.post<IcafeResponse<IcafeDeductBalanceResponse>>(
            v2('/members/action/deductBalance'),
            data,
        )
        return res.data
    }

    /** POST /api/v2/cafe/{cafeId}/members/action/convertToMember */
    async function apiConvertGuestToMember(data: IcafeConvertGuestRequest) {
        const res = await http.post<IcafeResponse<IcafeMember>>(
            v2('/members/action/convertToMember'),
            data,
        )
        return res.data
    }

    /**
     * POST /api/v2/cafe/{cafeId}/members/action/fetchBonus
     * Call before apiTopUpMember() to retrieve the applicable bonus.
     */
    async function apiFetchTopUpBonus(data: IcafeFetchBonusRequest) {
        const res = await http.post<IcafeResponse<IcafeFetchBonusResponse>>(
            v2('/members/action/fetchBonus'),
            data,
        )
        return res.data
    }

    /**
     * POST /api/v2/cafe/{cafeId}/members/action/topup
     * Recommended: call apiFetchTopUpBonus() first and pass the bonus in.
     */
    async function apiTopUpMember(data: IcafeTopUpRequest) {
        const res = await http.post<IcafeResponse<IcafeTopUpResponse>>(
            v2('/members/action/topup'),
            data,
        )
        return res.data
    }

    // ── Sessions ──────────────────────────────────────────────────────────────

    /** GET /api/v2/cafe/{cafeId}/sessions */
    async function apiGetSessions() {
        const res = await http.get<IcafeResponse<IcafeSession[]>>(
            v2('/sessions'),
        )
        return res.data
    }

    /** POST /api/v2/cafe/{cafeId}/sessions/{sessionId}/end */
    async function apiEndSession(sessionId: string) {
        const res = await http.post<IcafeResponse<null>>(
            v2(`/sessions/${sessionId}/end`),
        )
        return res.data
    }

    // ── PCs ───────────────────────────────────────────────────────────────────

    /** GET /api/v2/cafe/{cafeId}/pcs */
    async function apiGetPCs() {
        const res = await http.get<IcafeResponse<IcafePC[]>>(v2('/pcs'))
        return res.data
    }

    /** POST /api/v2/cafe/{cafeId}/pcSessions/sendWssCommand */
    async function apiSendPCPowerCommand(data: IcafePCPowerRequest) {
        const res = await http.post<IcafePCPowerResponse>(
            v2('/pcSessions/sendWssCommand'),
            data,
        )
        return res.data
    }

    // ── PC Groups ─────────────────────────────────────────────────────────────

    /** GET /api/v2/cafe/{cafeId}/pcgroups */
    async function apiGetPCGroups() {
        const res = await http.get<IcafeResponse<IcafePCGroup[]>>(
            v2('/pcgroups'),
        )
        return res.data
    }

    // ── Zones ─────────────────────────────────────────────────────────────────

    /** GET /api/v2/cafe/{cafeId}/zones */
    async function apiGetZones() {
        const res = await http.get<IcafeResponse<IcafeZone[]>>(v2('/zones'))
        return res.data
    }

    // ── Packages ──────────────────────────────────────────────────────────────

    /** GET /api/v2/cafe/{cafeId}/packages */
    async function apiGetPackages() {
        const res = await http.get<IcafeResponse<IcafePackage[]>>(
            v2('/packages'),
        )
        return res.data
    }

    /** POST /api/v2/cafe/{cafeId}/packages/action/create */
    async function apiCreatePackage(data: IcafeCreatePackageRequest) {
        const res = await http.post<IcafeResponse<IcafePackage>>(
            v2('/packages/action/create'),
            data,
        )
        return res.data
    }

    /** POST /api/v2/cafe/{cafeId}/packages/action/update */
    async function apiUpdatePackage(data: IcafeUpdatePackageRequest) {
        const res = await http.post<IcafeResponse<IcafePackage>>(
            v2('/packages/action/update'),
            data,
        )
        return res.data
    }

    // ── Bookings ──────────────────────────────────────────────────────────────

    /** GET /api/v2/cafe/{cafeId}/bookings */
    async function apiGetBookings() {
        const res = await http.get<IcafeResponse<IcafeBooking[]>>(
            v2('/bookings'),
        )
        return res.data
    }

    /** POST /api/v2/cafe/{cafeId}/bookings */
    async function apiCreateBooking(data: IcafeCreateBookingRequest) {
        const res = await http.post<IcafeResponse<IcafeBooking>>(
            v2('/bookings'),
            data,
        )
        return res.data
    }

    /** DELETE /api/v2/cafe/{cafeId}/bookings/{bookingId} */
    async function apiCancelBooking(bookingId: number) {
        const res = await http.delete<IcafeResponse<null>>(
            v2(`/bookings/${bookingId}`),
        )
        return res.data
    }

    // ── Food Orders ───────────────────────────────────────────────────────────

    /** GET /api/v2/cafe/{cafeId}/orders/food */
    async function apiGetFoodOrders() {
        const res = await http.get<IcafeResponse<IcafeFoodOrder[]>>(
            v2('/orders/food'),
        )
        return res.data
    }

    /** POST /api/v2/cafe/{cafeId}/orders/food */
    async function apiCreateFoodOrder(data: IcafeCreateFoodOrderRequest) {
        const res = await http.post<IcafeResponse<IcafeFoodOrder>>(
            v2('/orders/food'),
            data,
        )
        return res.data
    }

    // ── Announcements ─────────────────────────────────────────────────────────

    /** GET /api/v2/cafe/{cafeId}/announcements */
    async function apiGetAnnouncements() {
        const res = await http.get<IcafeResponse<IcafeAnnouncement[]>>(
            v2('/announcements'),
        )
        return res.data
    }

    /** POST /api/v2/cafe/{cafeId}/announcements */
    async function apiCreateAnnouncement(
        data: IcafeCreateAnnouncementRequest,
    ) {
        const res = await http.post<IcafeResponse<IcafeAnnouncement>>(
            v2('/announcements'),
            data,
        )
        return res.data
    }

    // ── Reports ───────────────────────────────────────────────────────────────

    /** GET /api/v2/cafe/{cafeId}/reports */
    async function apiGetReports(params: IcafeReportParams) {
        const res = await http.get<IcafeResponse<IcafeReport>>(v2('/reports'), {
            params,
        })
        return res.data
    }

    // ── Staff ─────────────────────────────────────────────────────────────────

    /** GET /api/v2/cafe/{cafeId}/staff */
    async function apiGetStaff() {
        const res = await http.get<IcafeResponse<IcafeStaff[]>>(v2('/staff'))
        return res.data
    }

    /** POST /api/v2/cafe/{cafeId}/staff/action/create */
    async function apiCreateStaff(data: IcafeCreateStaffRequest) {
        const res = await http.post<IcafeResponse<IcafeStaff>>(
            v2('/staff/action/create'),
            data,
        )
        return res.data
    }

    /** POST /api/v2/cafe/{cafeId}/staff/action/update */
    async function apiUpdateStaff(data: IcafeUpdateStaffRequest) {
        const res = await http.post<IcafeResponse<IcafeStaff>>(
            v2('/staff/action/update'),
            data,
        )
        return res.data
    }

    /** DELETE /api/v2/cafe/{cafeId}/staff/{staffId} */
    async function apiDeleteStaff(staffId: number) {
        const res = await http.delete<IcafeResponse<null>>(
            v2(`/staff/${staffId}`),
        )
        return res.data
    }

    // ── Billing Logs ──────────────────────────────────────────────────────────

    /** GET /api/v2/cafe/{cafeId}/billing-logs */
    async function apiGetBillingLogs(params?: IcafeBillingLogParams) {
        const res = await http.get<IcafeResponse<IcafeBillingLogListResponse>>(
            v2('/billing-logs'),
            { params },
        )
        return res.data
    }

    /** GET /api/v2/cafe/{cafeId}/transactions */
    async function apiGetTransactions(params?: IcafeTransactionParams) {
        const res = await http.get<
            IcafeResponse<IcafeTransactionListResponse>
        >(v2('/transactions'), { params })
        return res.data
    }

    /** GET /api/v2/cafe/{cafeId}/receipts/{receiptId} */
    async function apiGetReceipt(receiptId: string) {
        const res = await http.get<IcafeResponse<IcafeReceipt>>(
            v2(`/receipts/${receiptId}`),
        )
        return res.data
    }

    // ── Client status ─────────────────────────────────────────────────────────

    /**
     * POST /api/v2/cafe/{cafeId}/clients/pushClientStatus
     * Call after apiTopUpMember() to sync the client PC's balance display.
     */
    async function apiPushClientStatus(data: IcafePushClientStatusRequest) {
        const res = await http.post<IcafeResponse<null>>(
            v2('/clients/pushClientStatus'),
            data,
        )
        return res.data
    }

    return {
        apiGetCafeInfo,
        apiGetMembers,
        apiCreateMember,
        apiUpdateMember,
        apiDeductMemberBalance,
        apiConvertGuestToMember,
        apiFetchTopUpBonus,
        apiTopUpMember,
        apiGetSessions,
        apiEndSession,
        apiGetPCs,
        apiSendPCPowerCommand,
        apiGetPCGroups,
        apiGetZones,
        apiGetPackages,
        apiCreatePackage,
        apiUpdatePackage,
        apiGetBookings,
        apiCreateBooking,
        apiCancelBooking,
        apiGetFoodOrders,
        apiCreateFoodOrder,
        apiGetAnnouncements,
        apiCreateAnnouncement,
        apiGetReports,
        apiGetStaff,
        apiCreateStaff,
        apiUpdateStaff,
        apiDeleteStaff,
        apiGetBillingLogs,
        apiGetTransactions,
        apiGetReceipt,
        apiPushClientStatus,
    }
}

// ─── Default single-café exports (backwards compat) ──────────────────────────
// These use the credentials from VITE_ICAFE_API_KEY / VITE_ICAFE_CAFE_ID.
// Existing code that imports these named functions continues to work unchanged.

const _default = createIcafeService(icafeConfig)

export const apiGetCafeInfo = _default.apiGetCafeInfo
export const apiGetMembers = _default.apiGetMembers
export const apiCreateMember = _default.apiCreateMember
export const apiUpdateMember = _default.apiUpdateMember
export const apiDeductMemberBalance = _default.apiDeductMemberBalance
export const apiConvertGuestToMember = _default.apiConvertGuestToMember
export const apiFetchTopUpBonus = _default.apiFetchTopUpBonus
export const apiTopUpMember = _default.apiTopUpMember
export const apiGetSessions = _default.apiGetSessions
export const apiEndSession = _default.apiEndSession
export const apiGetPCs = _default.apiGetPCs
export const apiSendPCPowerCommand = _default.apiSendPCPowerCommand
export const apiGetPCGroups = _default.apiGetPCGroups
export const apiGetZones = _default.apiGetZones
export const apiGetPackages = _default.apiGetPackages
export const apiCreatePackage = _default.apiCreatePackage
export const apiUpdatePackage = _default.apiUpdatePackage
export const apiGetBookings = _default.apiGetBookings
export const apiCreateBooking = _default.apiCreateBooking
export const apiCancelBooking = _default.apiCancelBooking
export const apiGetFoodOrders = _default.apiGetFoodOrders
export const apiCreateFoodOrder = _default.apiCreateFoodOrder
export const apiGetAnnouncements = _default.apiGetAnnouncements
export const apiCreateAnnouncement = _default.apiCreateAnnouncement
export const apiGetReports = _default.apiGetReports
export const apiGetStaff = _default.apiGetStaff
export const apiCreateStaff = _default.apiCreateStaff
export const apiUpdateStaff = _default.apiUpdateStaff
export const apiDeleteStaff = _default.apiDeleteStaff
export const apiGetBillingLogs = _default.apiGetBillingLogs
export const apiGetTransactions = _default.apiGetTransactions
export const apiGetReceipt = _default.apiGetReceipt
export const apiPushClientStatus = _default.apiPushClientStatus

