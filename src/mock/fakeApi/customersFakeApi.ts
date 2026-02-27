/* eslint-disable @typescript-eslint/no-explicit-any */
import wildCardSearch from '@/utils/wildCardSearch'
import sortBy, { Primer } from '@/utils/sortBy'
import paginate from '@/utils/paginate'
import { mock } from '../MockAdapter'
import { userDetailData } from '../data/usersData'
import { customerActivityLog } from '../data/logData'

mock.onPost(`/api/customers`).reply((config) => {
    const data = JSON.parse(config.data as string)
    const ids = (userDetailData as any[]).map((u: any) => Number(u.id))
    const newId = String(Math.max(0, ...ids) + 1)
    const newCustomer = {
        id: newId,
        name: `${data.firstName} ${data.lastName}`,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        img: data.img || '',
        role: 'user',
        lastOnline: Math.floor(Date.now() / 1000),
        status: 'active',
        personalInfo: {
            location: `${data.city}, ${data.country}`,
            address: data.address || '',
            postcode: data.postcode || '',
            city: data.city || '',
            country: data.country || '',
            dialCode: data.dialCode || '',
            birthday: '',
            phoneNumber: data.phoneNumber || '',
            facebook: '',
            twitter: '',
            pinterest: '',
            linkedIn: '',
        },
        orderHistory: [],
        paymentMethod: [],
        subscription: [],
        totalSpending: 0,
    }
    ;(userDetailData as any[]).push(newCustomer)
    return [201, newCustomer]
})

mock.onPut(new RegExp(`/api/customers/*`)).reply((config) => {
    const id = config.url?.split('/').pop()
    const data = JSON.parse(config.data as string)
    const index = (userDetailData as any[]).findIndex((u: any) => u.id === id)
    if (index === -1) return [404, {}]
    const existing = (userDetailData as any[])[index]
    const updated = {
        ...existing,
        firstName: data.firstName,
        lastName: data.lastName,
        name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        img: data.img,
        personalInfo: {
            ...existing.personalInfo,
            phoneNumber: data.phoneNumber,
            dialCode: data.dialCode,
            country: data.country,
            address: data.address,
            postcode: data.postcode,
            city: data.city,
            location: `${data.city}, ${data.country}`,
        },
    }
    ;(userDetailData as any[])[index] = updated
    return [200, updated]
})

mock.onDelete(new RegExp(`/api/customers/*`)).reply((config) => {
    const id = config.url?.split('/').pop()
    const index = (userDetailData as any[]).findIndex((u: any) => u.id === id)
    if (index === -1) return [404, {}]
    ;(userDetailData as any[]).splice(index, 1)
    return [200, { id }]
})

mock.onGet(`/api/customers`).reply((config) => {
    const { pageIndex, pageSize, sort, query } = config.params

    const { order, key } = sort

    const users = userDetailData as any[]

    const sanitizeUsers = users.filter((elm) => typeof elm !== 'function')
    let data = sanitizeUsers
    let total = users.length

    if (key && order) {
        if (key !== 'totalSpending') {
            data.sort(
                sortBy(key, order === 'desc', (a) =>
                    (a as string).toUpperCase(),
                ),
            )
        } else {
            data.sort(sortBy(key, order === 'desc', parseInt as Primer))
        }
    }

    if (query) {
        data = wildCardSearch(data, query)
        total = data.length
    }

    data = paginate(data, pageSize, pageIndex)

    const responseData = {
        list: data,
        total: total,
    }

    return new Promise(function (resolve) {
        setTimeout(function () {
            resolve([200, responseData])
        }, 500)
    })
})

mock.onGet(new RegExp(`/api/customers/*`)).reply(function (config) {
    const id = config.url?.split('/')[2]

    const user = userDetailData.find((user) => user.id === id)

    if (!user) {
        return [404, {}]
    }

    return [200, user]
})

mock.onGet(new RegExp(`/api/customer/log`)).reply(() => {
    return [200, customerActivityLog]
})
