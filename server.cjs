const express = require('express')
const path = require('path')
const zlib = require('zlib')
const fs = require('fs')
const { createProxyMiddleware } = require('http-proxy-middleware')
const Database = require('better-sqlite3')
const { randomUUID } = require('crypto')

const app = express()
const PORT = process.env.PORT || 3000

// ── SQLite setup ────────────────────────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'icafe.db')
const dataDir = path.dirname(DB_PATH)
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS cafes (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    cafe_id    TEXT NOT NULL,
    api_key    TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)
console.log('[DB] SQLite ready at', DB_PATH)

// ── Body parser ─────────────────────────────────────────────────────────────
app.use(express.json())

// ── REST API: Cafes ─────────────────────────────────────────────────────────

// GET /api/cafes
app.get('/api/cafes', (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM cafes ORDER BY sort_order ASC, created_at ASC').all()
        res.json({ ok: true, cafes: rows.map(r => ({ id: r.id, name: r.name, cafeId: r.cafe_id, apiKey: r.api_key })) })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

// POST /api/cafes
app.post('/api/cafes', (req, res) => {
    try {
        const { name, cafeId, apiKey } = req.body
        if (!name || !cafeId || !apiKey) return res.status(400).json({ ok: false, error: 'name, cafeId, apiKey required' })
        const id = randomUUID()
        const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM cafes').get()
        const sortOrder = (maxOrder?.m ?? -1) + 1
        db.prepare('INSERT INTO cafes (id, name, cafe_id, api_key, sort_order) VALUES (?, ?, ?, ?, ?)').run(id, name.trim(), cafeId.trim(), apiKey.trim(), sortOrder)
        res.status(201).json({ ok: true, cafe: { id, name: name.trim(), cafeId: cafeId.trim(), apiKey: apiKey.trim() } })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

// PUT /api/cafes/:id
app.put('/api/cafes/:id', (req, res) => {
    try {
        const { id } = req.params
        const { name, cafeId, apiKey } = req.body
        if (!name || !cafeId || !apiKey) return res.status(400).json({ ok: false, error: 'name, cafeId, apiKey required' })
        const result = db.prepare('UPDATE cafes SET name=?, cafe_id=?, api_key=? WHERE id=?').run(name.trim(), cafeId.trim(), apiKey.trim(), id)
        if (result.changes === 0) return res.status(404).json({ ok: false, error: 'Cafe not found' })
        res.json({ ok: true, cafe: { id, name: name.trim(), cafeId: cafeId.trim(), apiKey: apiKey.trim() } })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

// DELETE /api/cafes/:id
app.delete('/api/cafes/:id', (req, res) => {
    try {
        const { id } = req.params
        const result = db.prepare('DELETE FROM cafes WHERE id=?').run(id)
        if (result.changes === 0) return res.status(404).json({ ok: false, error: 'Cafe not found' })
        res.json({ ok: true })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

// PUT /api/cafes-reorder
app.put('/api/cafes-reorder', (req, res) => {
    try {
        const { order } = req.body
        if (!Array.isArray(order)) return res.status(400).json({ ok: false, error: 'order must be array of ids' })
        const update = db.prepare('UPDATE cafes SET sort_order=? WHERE id=?')
        db.transaction((ids) => ids.forEach((id, i) => update.run(i, id)))(order)
        res.json({ ok: true })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

// ── Proxy /icafe-api/* → https://api.icafecloud.com/api/v2/* ────────────────
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

// ── Serve the Vite production build ─────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'build')))
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'))
})

app.listen(PORT, () => {
    console.log(`iCafe Dashboard server running on port ${PORT}`)
})
