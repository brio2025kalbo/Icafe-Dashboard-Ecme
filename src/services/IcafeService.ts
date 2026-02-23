import axios from 'axios'

const ICAFE_API_BASE = 'https://api.icafecloud.com'

export type IcafeReportDetail = {
    date: string
    income: number
    topup: number
    fbSales: number
}

export type IcafeReportSummary = {
    totalIncome: number
    totalTopup: number
    totalFbSales: number
}

export type IcafeReportResponse = {
    code: number
    message: string
    data: {
        summary: IcafeReportSummary
        details: IcafeReportDetail[]
    }
}

export type IcafeReportParams = {
    startDate?: string
    endDate?: string
}

const ICAFE_API_TIMEOUT_MS = 30_000

function createIcafeAxios(apiKey: string) {
    return axios.create({
        baseURL: ICAFE_API_BASE,
        timeout: ICAFE_API_TIMEOUT_MS,
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
    })
}

export async function apiGetCafeReports(
    cafeId: string,
    apiKey: string,
    params?: IcafeReportParams,
): Promise<IcafeReportResponse> {
    const instance = createIcafeAxios(apiKey)
    const response = await instance.get<IcafeReportResponse>(
        `/api/v2/cafe/${cafeId}/reports/income`,
        { params },
    )
    return response.data
}
