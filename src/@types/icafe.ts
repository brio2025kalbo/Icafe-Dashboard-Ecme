/**
 * TypeScript types for the iCafe Cloud REST API v2.
 * Reference: https://dev.icafecloud.com/docs/
 */

// ─── Generic wrapper ─────────────────────────────────────────────────────────

export type IcafeResponse<T = unknown> = {
    code: number
    message: string
    data: T
}

// ─── Café info ───────────────────────────────────────────────────────────────

export type IcafeCafe = {
    id: number
    name: string
    location: string
    activePCs: number
    totalPCs: number
    timezone: string
}

// ─── Members ─────────────────────────────────────────────────────────────────

export type IcafeMemberStatus = 'active' | 'inactive' | 'banned'
export type IcafeMemberType = 'member' | 'guest'

export type IcafeMember = {
    id: number
    username: string
    nickname: string
    email: string
    phone: string
    balance: number
    type: IcafeMemberType
    status: IcafeMemberStatus
    createdAt: string
}

export type IcafeCreateMemberRequest = {
    username: string
    password: string
    nickname?: string
    email?: string
    phone?: string
    group?: string
}

export type IcafeUpdateMemberRequest = {
    member_id: number
    nickname?: string
    email?: string
    phone?: string
    group?: string
    status?: IcafeMemberStatus
}

export type IcafeDeductBalanceRequest = {
    member_id: number
    amount: number
    reason?: string
}

export type IcafeDeductBalanceResponse = {
    memberId: number
    newBalance: number
}

export type IcafeConvertGuestRequest = {
    guest_id: number
    username: string
    password: string
    nickname?: string
    email?: string
    phone?: string
}

export type IcafeTopUpRequest = {
    memberId: number
    amount: number
    topup_balance_bonus?: number
    note?: string
}

export type IcafeTopUpResponse = {
    memberId: number
    newBalance: number
}

export type IcafeFetchBonusRequest = {
    memberId: number
    amount: number
}

export type IcafeFetchBonusResponse = {
    bonus: number
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export type IcafeSessionStatus = 'active' | 'ended' | 'paused'

export type IcafeSession = {
    sessionId: string
    memberId: number
    pcId: string
    pcName: string
    start: string
    end: string | null
    status: IcafeSessionStatus
    duration: number
    cost: number
}

// ─── PCs ─────────────────────────────────────────────────────────────────────

export type IcafePCStatus = 'online' | 'offline' | 'in-use' | 'maintenance'

export type IcafePC = {
    id: number
    name: string
    ip: string
    mac: string
    status: IcafePCStatus
    currentMemberId: number | null
    currentSessionId: string | null
    groupName: string
}

export type IcafePowerAction = 'boot' | 'shutdown' | 'reboot'

export type IcafePCPowerRequest = {
    action: 'power'
    target: IcafePowerAction
    data: {
        power_type: IcafePowerAction
        ids: number[]
    }
}

export type IcafePCPowerResult = {
    pcId: number
    status: 'ok' | 'error'
    message?: string
}

export type IcafePCPowerResponse = {
    code: number
    message: string
    results: IcafePCPowerResult[]
}

// ─── PC Groups ───────────────────────────────────────────────────────────────

export type IcafePCGroup = {
    id: number
    name: string
    description: string
    pricePerHour: number
    pcCount: number
}

// ─── Zones ───────────────────────────────────────────────────────────────────

export type IcafeZone = {
    id: number
    name: string
    description: string
    pcGroupId: number
    pcCount: number
}

// ─── Packages ────────────────────────────────────────────────────────────────

export type IcafePackageType = 'time' | 'prepaid' | 'unlimited'

export type IcafePackage = {
    id: number
    name: string
    type: IcafePackageType
    duration: number
    price: number
    pcGroup: string
    isActive: boolean
}

export type IcafeCreatePackageRequest = {
    name: string
    type: IcafePackageType
    duration: number
    price: number
    pcGroup?: string
}

export type IcafeUpdatePackageRequest = IcafeCreatePackageRequest & {
    id: number
}

// ─── Bookings ────────────────────────────────────────────────────────────────

export type IcafeBookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'

export type IcafeBooking = {
    id: number
    memberId: number
    memberName: string
    pcId: number
    pcName: string
    startTime: string
    endTime: string
    status: IcafeBookingStatus
    createdAt: string
}

export type IcafeCreateBookingRequest = {
    memberId: number
    pcId: number
    startTime: string
    endTime: string
}

// ─── Food Orders ─────────────────────────────────────────────────────────────

export type IcafeFoodOrderStatus = 'pending' | 'preparing' | 'delivered' | 'cancelled'

export type IcafeFoodOrderItem = {
    itemId: number
    itemName: string
    quantity: number
    unitPrice: number
}

export type IcafeFoodOrder = {
    id: number
    memberId: number
    memberName: string
    pcId: number
    pcName: string
    items: IcafeFoodOrderItem[]
    totalAmount: number
    status: IcafeFoodOrderStatus
    createdAt: string
}

export type IcafeCreateFoodOrderRequest = {
    memberId: number
    pcId: number
    items: {
        itemId: number
        quantity: number
    }[]
}

// ─── Announcements ────────────────────────────────────────────────────────────

export type IcafeAnnouncementTarget = 'all' | 'members' | 'guests' | 'active'

export type IcafeAnnouncement = {
    id: number
    title: string
    message: string
    target: IcafeAnnouncementTarget
    createdAt: string
    expiresAt: string | null
}

export type IcafeCreateAnnouncementRequest = {
    title: string
    message: string
    target?: IcafeAnnouncementTarget
    expiresAt?: string
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export type IcafeReportParams = {
    startDate: string
    endDate: string
    type?: 'revenue' | 'sessions' | 'members' | 'topups'
}

export type IcafeReport = {
    type: string
    startDate: string
    endDate: string
    summary: Record<string, number>
    rows: Record<string, unknown>[]
}

// ─── Push client status ───────────────────────────────────────────────────────

export type IcafePushClientStatusRequest = {
    memberId: number
}
