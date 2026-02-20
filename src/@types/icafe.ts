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

// ─── Push client status ───────────────────────────────────────────────────────

export type IcafePushClientStatusRequest = {
    memberId: number
}
