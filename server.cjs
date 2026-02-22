require('dotenv').config()
const express = require('express')
const path = require('path')
const zlib = require('zlib')
const https = require('https')
const http = require('http')
const { URL } = require('url')
const mysql = require('mysql2/promise')
const { randomUUID } = require('crypto')

const app = express()
const PORT = process.env.PORT || 3000

// ── MySQL connection pool ────────────────────────────────────────────────────
const pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306', 10),
    user:     process.env.DB_USER     || 'icafe',
    password: process.env.DB_PASSWORD || 'icafe_pass_2025',
    database: process.env.DB_NAME     || 'icafe_dashboard',
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    charset:            'utf8mb4',
})

async function initDb() {
    const conn = await pool.getConnection()
    try {
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS cafes (
                id         VARCHAR(36)  NOT NULL PRIMARY KEY,
                name       VARCHAR(255) NOT NULL,
                cafe_id    VARCHAR(100) NOT NULL,
                api_key    TEXT         NOT NULL,
                sort_order INT          NOT NULL DEFAULT 0,
                created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)
        console.log('[DB] MySQL ready — icafe_dashboard.cafes table ensured')
    } finally {
        conn.release()
    }
}

initDb().catch((err) => {
    console.error('[DB] Failed to connect to MySQL:', err.message)
    console.error('[DB] Check DB_HOST / DB_USER / DB_PASSWORD / DB_NAME env vars')
    process.exit(1)
})

// ── Smart caching proxy for iCafeCloud ──────────────────────────────────────
//
// Strategy:
//  • shiftDetail  → cache for 25 seconds (active shift data, refreshes every 30s)
//  • shiftList    → cache for 20 seconds
//  • reportChart  → cache for 5 minutes (historical, rarely changes)
//  • everything else → cache for 15 seconds
//
// In-flight deduplication: if the same URL is already being fetched, queue
// subsequent callers and serve them the same result when it arrives.
// This prevents the "thundering herd" that triggers 507 rate limiting.

const CACHE_TTL = {
    shiftDetail:  25 * 1000,
    shiftList:    20 * 1000,
    reportChart:  5  * 60 * 1000,
    default:      15 * 1000,
}

// cache: Map<cacheKey, { body: Buffer, statusCode: number, headers: object, expiresAt: number }>
const cache = new Map()
// inFlight: Map<cacheKey, Promise<{body, statusCode, headers}>>
const inFlight = new Map()

function getTtl(urlPath) {
    if (urlPath.includes('shiftDetail'))  return CACHE_TTL.shiftDetail
    if (urlPath.includes('shiftList'))    return CACHE_TTL.shiftList
    if (urlPath.includes('reportChart'))  return CACHE_TTL.reportChart
    return CACHE_TTL.default
}

function decompressBuffer(buf, encoding) {
    return new Promise((resolve) => {
        if (encoding === 'gzip')      zlib.gunzip(buf, (e, d) => resolve(d || buf))
        else if (encoding === 'br')   zlib.brotliDecompress(buf, (e, d) => resolve(d || buf))
        else                          resolve(buf)
    })
}

function fetchUpstream(targetUrl, headers) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(targetUrl)
        const mod = parsed.protocol === 'https:' ? https : http
        const options = {
            hostname: parsed.hostname,
            port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path:     parsed.pathname + parsed.search,
            method:   'GET',
            headers:  {
                'Authorization': headers['authorization'] || '',
                'Accept':        'application/json',
                'User-Agent':    'iCafeDashboard/1.0',
            },
        }
        const req = mod.request(options, (res) => {
            const chunks = []
            res.on('data', (c) => chunks.push(c))
            res.on('end', () => {
                const raw = Buffer.concat(chunks)
                decompressBuffer(raw, res.headers['content-encoding']).then((body) => {
                    resolve({ body, statusCode: res.statusCode, headers: res.headers })
                })
            })
        })
        req.on('error', reject)
        req.end()
    })
}

// Replace the http-proxy-middleware with our own smart handler
app.use('/icafe-api', async (req, res) => {
    // Rebuild the upstream URL
    const upstreamPath = req.url  // already stripped of /icafe-api by express
    const targetUrl = 'https://api.icafecloud.com/api/v2' + upstreamPath
    const cacheKey = upstreamPath  // path + query string is unique per request

    const now = Date.now()

    // 1. Cache hit?
    const cached = cache.get(cacheKey)
    if (cached && cached.expiresAt > now) {
        console.log('[PROXY] CACHE HIT', upstreamPath.split('?')[0])
        res.status(cached.statusCode)
        res.set('Content-Type', 'application/json')
        res.set('X-Cache', 'HIT')
        return res.send(cached.body)
    }

    // 2. In-flight deduplication — someone else is already fetching this URL
    if (inFlight.has(cacheKey)) {
        console.log('[PROXY] DEDUP WAIT', upstreamPath.split('?')[0])
        try {
            const result = await inFlight.get(cacheKey)
            res.status(result.statusCode)
            res.set('Content-Type', 'application/json')
            res.set('X-Cache', 'DEDUP')
            return res.send(result.body)
        } catch (err) {
            return res.status(502).json({ code: 502, message: 'Upstream error: ' + err.message })
        }
    }

    // 3. Cache miss — fetch from upstream
    console.log('[PROXY] -->', req.method, targetUrl)

    const fetchPromise = fetchUpstream(targetUrl, req.headers)
    inFlight.set(cacheKey, fetchPromise)

    try {
        const result = await fetchPromise
        inFlight.delete(cacheKey)

        console.log('[PROXY] <--', result.statusCode, upstreamPath.split('?')[0])

        // Log body for shift endpoints (debug)
        if (upstreamPath.includes('shiftDetail') || upstreamPath.includes('shiftList')) {
            try {
                const parsed = JSON.parse(result.body.toString())
                console.log('[PROXY BODY]', upstreamPath.split('?')[0], JSON.stringify(parsed).substring(0, 800))
            } catch { /* ignore */ }
        }

        // Only cache successful responses (not 507 rate-limit errors)
        if (result.statusCode === 200) {
            const ttl = getTtl(upstreamPath)
            cache.set(cacheKey, {
                body:       result.body,
                statusCode: result.statusCode,
                expiresAt:  now + ttl,
            })
            console.log(`[PROXY] CACHED for ${ttl / 1000}s → ${upstreamPath.split('?')[0]}`)
        } else {
            console.warn('[PROXY] NOT CACHED (status', result.statusCode, ') →', upstreamPath.split('?')[0])
        }

        res.status(result.statusCode)
        res.set('Content-Type', 'application/json')
        res.set('X-Cache', 'MISS')
        return res.send(result.body)

    } catch (err) {
        inFlight.delete(cacheKey)
        console.error('[PROXY] Error:', err.message)
        return res.status(502).json({ code: 502, message: 'Proxy error: ' + err.message })
    }
})

// Periodically evict expired cache entries
setInterval(() => {
    const now = Date.now()
    let evicted = 0
    for (const [key, entry] of cache.entries()) {
        if (entry.expiresAt <= now) { cache.delete(key); evicted++ }
    }
    if (evicted > 0) console.log(`[CACHE] Evicted ${evicted} expired entries (${cache.size} remaining)`)
}, 60 * 1000)

// ── Body parser ──────────────────────────────────────────────────────────────
app.use(express.json())

// ── REST API: Cafes ──────────────────────────────────────────────────────────

app.get('/api/cafes', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM cafes ORDER BY sort_order ASC, created_at ASC'
        )
        res.json({
            ok: true,
            cafes: rows.map((r) => ({
                id:     r.id,
                name:   r.name,
                cafeId: r.cafe_id,
                apiKey: r.api_key,
            })),
        })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

app.post('/api/cafes', async (req, res) => {
    try {
        const { name, cafeId, apiKey } = req.body
        if (!name || !cafeId || !apiKey)
            return res.status(400).json({ ok: false, error: 'name, cafeId, apiKey required' })
        const id = randomUUID()
        const [[{ m }]] = await pool.execute('SELECT MAX(sort_order) AS m FROM cafes')
        const sortOrder = (m ?? -1) + 1
        await pool.execute(
            'INSERT INTO cafes (id, name, cafe_id, api_key, sort_order) VALUES (?, ?, ?, ?, ?)',
            [id, name.trim(), cafeId.trim(), apiKey.trim(), sortOrder]
        )
        res.status(201).json({
            ok: true,
            cafe: { id, name: name.trim(), cafeId: cafeId.trim(), apiKey: apiKey.trim() },
        })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

app.put('/api/cafes/:id', async (req, res) => {
    try {
        const { id } = req.params
        const { name, cafeId, apiKey } = req.body
        if (!name || !cafeId || !apiKey)
            return res.status(400).json({ ok: false, error: 'name, cafeId, apiKey required' })
        const [result] = await pool.execute(
            'UPDATE cafes SET name=?, cafe_id=?, api_key=? WHERE id=?',
            [name.trim(), cafeId.trim(), apiKey.trim(), id]
        )
        if (result.affectedRows === 0)
            return res.status(404).json({ ok: false, error: 'Cafe not found' })
        res.json({ ok: true, cafe: { id, name: name.trim(), cafeId: cafeId.trim(), apiKey: apiKey.trim() } })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

app.delete('/api/cafes/:id', async (req, res) => {
    try {
        const { id } = req.params
        const [result] = await pool.execute('DELETE FROM cafes WHERE id=?', [id])
        if (result.affectedRows === 0)
            return res.status(404).json({ ok: false, error: 'Cafe not found' })
        res.json({ ok: true })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

app.put('/api/cafes-reorder', async (req, res) => {
    try {
        const { order } = req.body
        if (!Array.isArray(order))
            return res.status(400).json({ ok: false, error: 'order must be array of ids' })
        const conn = await pool.getConnection()
        try {
            await conn.beginTransaction()
            for (let i = 0; i < order.length; i++) {
                await conn.execute('UPDATE cafes SET sort_order=? WHERE id=?', [i, order[i]])
            }
            await conn.commit()
        } catch (e) {
            await conn.rollback()
            throw e
        } finally {
            conn.release()
        }
        res.json({ ok: true })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

// ── Serve the Vite production build ──────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'build')))
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'))
})

app.listen(PORT, () => {
    console.log(`iCafe Dashboard server running on port ${PORT}`)
})
