const express = require('express')
const path = require('path')
const zlib = require('zlib')
const { createProxyMiddleware } = require('http-proxy-middleware')

const app = express()
const PORT = process.env.PORT || 3000

// Proxy /icafe-api/* → https://api.icafecloud.com/api/v2/*
// This ensures iCafeCloud sees the server's static IP, not the browser's IP.
app.use(
    '/icafe-api',
    createProxyMiddleware({
        target: 'https://api.icafecloud.com/api/v2',
        changeOrigin: true,
        pathRewrite: { '^/icafe-api': '' },
        on: {
            proxyReq: (proxyReq, req) => {
                // Log outgoing request for debugging
                console.log('[PROXY] -->', req.method, 'https://api.icafecloud.com' + proxyReq.path)
                console.log('[PROXY] Authorization header:', proxyReq.getHeader('Authorization') || '(none)')
                // Forward the Authorization header from the browser request
                const auth = req.headers['authorization']
                if (auth) {
                    proxyReq.setHeader('Authorization', auth)
                    console.log('[PROXY] Set Authorization:', auth.substring(0, 20) + '...')
                } else {
                    console.log('[PROXY] WARNING: No Authorization header in incoming request!')
                }
            },
            proxyRes: (proxyRes, req, res) => {
                console.log('[PROXY] <--', proxyRes.statusCode, req.url)
                // Log response body for shift endpoints to debug field names
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

// Serve the Vite production build
app.use(express.static(path.join(__dirname, 'build')))

// SPA fallback — Express 5 compatible wildcard
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'))
})

app.listen(PORT, () => {
    console.log(`iCafe Dashboard server running on port ${PORT}`)
})
