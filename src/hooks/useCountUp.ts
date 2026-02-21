import { useEffect, useRef, useState } from 'react'

/**
 * Animates a number from its previous value to `target` over `duration` ms.
 * Re-triggers whenever `target` changes.
 */
const useCountUp = (target: number, duration = 800): number => {
    const [displayed, setDisplayed] = useState(target)
    const prevRef = useRef(target)
    const rafRef = useRef<number | null>(null)

    useEffect(() => {
        const from = prevRef.current
        const to = target
        prevRef.current = target

        if (from === to) return

        const startTime = performance.now()

        const tick = (now: number) => {
            const elapsed = now - startTime
            const progress = Math.min(elapsed / duration, 1)
            // ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3)
            setDisplayed(from + (to - from) * eased)
            if (progress < 1) {
                rafRef.current = requestAnimationFrame(tick)
            } else {
                setDisplayed(to)
            }
        }

        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(tick)

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
        }
    }, [target, duration])

    return displayed
}

export default useCountUp
