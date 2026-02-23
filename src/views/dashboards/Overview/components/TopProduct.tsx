import { useState, useEffect, useCallback, useRef } from 'react'
import Card from '@/components/ui/Card'
import classNames from '@/utils/classNames'
import isLastChild from '@/utils/isLastChild'
import { TbShoppingCart } from 'react-icons/tb'
import { useCafeStore, ALL_CAFES_VALUE } from '@/store/cafeStore'
import { apiGetTopProducts } from '@/services/ReportsService'
import {
    getBusinessDayRange,
    getTodayBusinessDateStr,
} from '../utils/periodUtils'
import type { TopProductItem } from '../icafeTypes'

const MAX_PRODUCTS = 10

const ProductAvatar = ({ image, name }: { image?: string; name: string }) => {
    const [failed, setFailed] = useState(false)

    if (image && !failed) {
        return (
            <img
                src={image}
                alt={name}
                className="w-[40px] h-[40px] rounded-full object-cover"
                onError={() => setFailed(true)}
            />
        )
    }

    return (
        <div className="flex items-center justify-center w-[40px] h-[40px] rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
            <TbShoppingCart className="text-lg" />
        </div>
    )
}

const TopProduct = ({ refreshSignal = 0 }: { refreshSignal?: number }) => {
    const cafes = useCafeStore((s) => s.cafes)
    const filterCafeId = useCafeStore((s) => s.filterCafeId)
    const [products, setProducts] = useState<TopProductItem[]>([])
    const [loading, setLoading] = useState(false)
    const prevSignal = useRef(refreshSignal)
    const hasLoadedOnce = useRef(false)

    const fetchTopProducts = useCallback(async () => {
        const allValid = cafes.filter((c) => c.cafeId && c.apiKey)
        const validCafes = filterCafeId === ALL_CAFES_VALUE
            ? allValid
            : allValid.filter((c) => c.id === filterCafeId)
        if (validCafes.length === 0) {
            setProducts([])
            return
        }

        // Only show loading spinner on the very first load
        if (!hasLoadedOnce.current) {
            setLoading(true)
        }
        try {
            const todayStr = getTodayBusinessDateStr()
            const range = getBusinessDayRange(todayStr)

            const results = await Promise.allSettled(
                validCafes.map((c) =>
                    apiGetTopProducts(c.id, {
                        date_start: range.date_start,
                        date_end: range.date_end,
                        time_start: range.time_start,
                        time_end: range.time_end,
                    }),
                ),
            )

            // Merge products across all cafes
            const productMap = new Map<
                string,
                { total_sold: number; total_cash: number; image?: string }
            >()
            for (const result of results) {
                if (result.status !== 'fulfilled') continue
                for (const item of result.value) {
                    const existing = productMap.get(item.product_name)
                    if (existing) {
                        existing.total_sold += item.total_sold
                        existing.total_cash += item.total_cash
                        if (!existing.image && item.image) {
                            existing.image = item.image
                        }
                    } else {
                        productMap.set(item.product_name, {
                            total_sold: item.total_sold,
                            total_cash: item.total_cash,
                            image: item.image,
                        })
                    }
                }
            }

            const merged = Array.from(productMap.entries())
                .map(([product_name, data]) => ({ product_name, ...data }))
                .sort((a, b) => b.total_sold - a.total_sold)
                .slice(0, MAX_PRODUCTS)

            setProducts(merged)
            hasLoadedOnce.current = true
        } catch {
            // On error, keep existing products rather than clearing
            if (!hasLoadedOnce.current) {
                setProducts([])
            }
        } finally {
            setLoading(false)
        }
    }, [cafes, filterCafeId])

    useEffect(() => {
        fetchTopProducts()
    }, [fetchTopProducts])

    // Silent background refresh triggered by parent auto-refresh
    useEffect(() => {
        if (refreshSignal !== prevSignal.current) {
            prevSignal.current = refreshSignal
            fetchTopProducts()
        }
    }, [refreshSignal, fetchTopProducts])

    return (
        <Card>
            <div className="flex items-center justify-between">
                <h4>Top Products Today</h4>
            </div>
            <div className="mt-5">
                {loading && products.length === 0 && (
                    <div className="text-center text-gray-400 py-4 text-sm">
                        Loading…
                    </div>
                )}
                {!loading && products.length === 0 && (
                    <div className="text-center text-gray-400 py-4 text-sm">
                        No product sales today.
                    </div>
                )}
                {products.map((product, index) => (
                    <div
                        key={product.product_name}
                        className={classNames(
                            'flex items-center justify-between py-2 dark:border-gray-600 transition-all duration-300 ease-in-out',
                            !isLastChild(products, index) && 'mb-2',
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <ProductAvatar
                                image={product.image}
                                name={product.product_name}
                            />
                            <div>
                                <div className="heading-text font-bold">
                                    {product.product_name}
                                </div>
                                <div className="text-xs text-gray-500 transition-all duration-300">
                                    Sold: {product.total_sold}
                                </div>
                            </div>
                        </div>
                        <div className="font-semibold text-sm transition-all duration-300">
                            ₱{product.total_cash.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    )
}

export default TopProduct
