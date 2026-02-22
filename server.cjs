require('dotenv').config()
const express = require('express')
const path = require('path')
const zlib = require('zlib')
const { createProxyMiddleware } = require('http-proxy-middleware')
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

// Initialise schema on startup
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

// ── Body parser ──────────────────────────────────────────────────────────────
app.use(express.json())

// ── REST API: Cafes ──────────────────────────────────────────────────────────

// GET /api/cafes
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

// POST /api/cafes
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

// PUT /api/cafes/:id
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

// DELETE /api/cafes/:id
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

// PUT /api/cafes-reorder
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

// ── Proxy /icafe-api/* → https://api.icafecloud.com/api/v2/* ─────────────────
app.use(
    '/icafe-api',
    createProxyMiddleware({
        target: 'https://api.icafecloud.com/api/v2',
        changeOrigin: true,
        pathRewrite: { '^/icafe-api': '' },
        on: {
            proxyReq: (proxyReq, req) => {
                console.log('[PROXY] -->', req.method, 'https://api.icafecloud.com' + proxyReq.path)
                const auth = req.headers['authorization']
                if (auth) {
                    proxyReq.setHeader('Authorization', auth)
                } else {
                    console.log('[PROXY] WARNING: No Authorization header in incoming request!')
                }
            },
            proxyRes: (proxyRes, req) => {
                console.log('[PROXY] <--', proxyRes.statusCode, req.url)
                if (req.url.includes('shiftDetail') || req.url.includes('shiftList')) {
                    const encoding = proxyRes.headers['content-encoding']
                    const chunks = []
                    proxyRes.on('data', (chunk) => chunks.push(chunk))
                    proxyRes.on('end', () => {
                        const buf = Buffer.concat(chunks)
                        const decode = (b) => {
                            try {
                                const parsed = JSON.parse(b.toString())
                                console.log('[PROXY BODY]', req.url.split('?')[0], JSON.stringify(parsed).substring(0, 1200))
                            } catch { console.log('[PROXY BODY RAW]', b.toString().substring(0, 400)) }
                        }
                        if (encoding === 'gzip') zlib.gunzip(buf, (e, d) => decode(d || buf))
                        else if (encoding === 'br') zlib.brotliDecompress(buf, (e, d) => decode(d || buf))
                        else decode(buf)
                    })
                }
            },
            error: (err, req, res) => {
                console.error('[PROXY] Error:', err.message)
                res.status(502).json({ code: 502, message: 'Proxy error: ' + err.message })
            },
        },
    }),
)

// ── Serve the Vite production build ──────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'build')))
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'))
})

app.listen(PORT, () => {
    console.log(`iCafe Dashboard server running on port ${PORT}`)
})
