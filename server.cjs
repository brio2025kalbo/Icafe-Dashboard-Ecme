require('dotenv').config()
const express = require('express')
const path = require('path')
const zlib = require('zlib')
const https = require('https')
const http = require('http')
const { URL } = require('url')
const mysql = require('mysql2/promise')
const { randomUUID } = require('crypto')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const app = express()
const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET || 'icafe-dev-secret'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

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
        // Cafes
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
        // Users
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id            VARCHAR(36)  NOT NULL PRIMARY KEY,
                email         VARCHAR(255) NOT NULL UNIQUE,
                username      VARCHAR(100) NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role          ENUM('admin','staff') NOT NULL DEFAULT 'staff',
                avatar        VARCHAR(500) NULL,
                is_active     TINYINT(1)   NOT NULL DEFAULT 1,
                created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)
        // Sessions
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS sessions (
                id         VARCHAR(36)  NOT NULL PRIMARY KEY,
                user_id    VARCHAR(36)  NOT NULL,
                token      VARCHAR(512) NOT NULL UNIQUE,
                ip_address VARCHAR(45)  NULL,
                user_agent VARCHAR(500) NULL,
                created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME     NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)
        // Activity Log
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS activity_log (
                id         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
                user_id    VARCHAR(36)  NULL,
                action     VARCHAR(100) NOT NULL,
                detail     TEXT         NULL,
                ip_address VARCHAR(45)  NULL,
                created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)
        // Seed default admin if no users exist
        const [[{ cnt }]] = await conn.execute('SELECT COUNT(*) AS cnt FROM users')
        if (cnt === 0) {
            const hash = await bcrypt.hash('Admin@1234', 10)
            await conn.execute(
                'INSERT INTO users (id, email, username, password_hash, role) VALUES (?,?,?,?,?)',
                [randomUUID(), 'admin@icafe.local', 'Admin', hash, 'admin']
            )
            console.log('[DB] Seeded default admin: admin@icafe.local / Admin@1234')
        }
        console.log('[DB] MySQL ready')
    } finally {
        conn.release()
    }
}

initDb().catch((err) => {
    console.error('[DB] Failed to connect to MySQL:', err.message)
    process.exit(1)
})

// ── Helpers ──────────────────────────────────────────────────────────────────
function getIp(req) {
    return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim()
}

async function logActivity(userId, action, detail, ip) {
    try {
        await pool.execute(
            'INSERT INTO activity_log (user_id, action, detail, ip_address) VALUES (?,?,?,?)',
            [userId || null, action, detail || null, ip || null]
        )
    } catch { /* non-critical */ }
}

// ── Auth middleware ───────────────────────────────────────────────────────────
async function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'] || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return res.status(401).json({ ok: false, message: 'Unauthorized' })
    try {
        const payload = jwt.verify(token, JWT_SECRET)
        // Validate session still exists in DB (handles forced sign-out)
        const [[session]] = await pool.execute(
            'SELECT s.id FROM sessions s WHERE s.token=? AND s.expires_at > NOW()',
            [token]
        )
        if (!session) return res.status(401).json({ ok: false, message: 'Session expired or revoked' })
        const [[user]] = await pool.execute(
            'SELECT id, email, username, role, avatar, is_active FROM users WHERE id=?',
            [payload.sub]
        )
        if (!user || !user.is_active) return res.status(401).json({ ok: false, message: 'Account disabled' })
        req.user = user
        next()
    } catch {
        return res.status(401).json({ ok: false, message: 'Invalid token' })
    }
}

function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') return res.status(403).json({ ok: false, message: 'Admin access required' })
    next()
}

// ── Body parser ──────────────────────────────────────────────────────────────
app.use(express.json())

// ── Auth API ─────────────────────────────────────────────────────────────────

// POST /sign-in  (also aliased as /api/sign-in for Axios baseURL compatibility)
const handleSignIn = async (req, res) => {
    const { email, password } = req.body || {}
    if (!email || !password)
        return res.status(400).json({ message: 'Email and password required' })
    try {
        const [[user]] = await pool.execute(
            'SELECT * FROM users WHERE email=? AND is_active=1',
            [email.toLowerCase().trim()]
        )
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            await logActivity(null, 'sign_in_failed', `email=${email}`, getIp(req))
            return res.status(401).json({ message: 'Invalid email or password!' })
        }

        // Concurrent login prevention: revoke ALL existing sessions for this user
        await pool.execute('DELETE FROM sessions WHERE user_id=?', [user.id])

        // Issue new JWT
        const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

        await pool.execute(
            'INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at) VALUES (?,?,?,?,?,?)',
            [randomUUID(), user.id, token, getIp(req), req.headers['user-agent'] || '', expiresAt]
        )

        await logActivity(user.id, 'sign_in', `role=${user.role}`, getIp(req))

        res.json({
            token,
            user: {
                userId:    user.id,
                userName:  user.username,
                email:     user.email,
                avatar:    user.avatar || '',
                authority: [user.role, 'user'],
            },
        })
    } catch (e) {
        console.error('[AUTH] sign-in error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
}
app.post('/sign-in', handleSignIn)
app.post('/api/sign-in', handleSignIn)

// POST /sign-up  (also aliased as /api/sign-up)
const handleSignUp = async (req, res) => {
    const { email, password, userName } = req.body || {}
    if (!email || !password || !userName)
        return res.status(400).json({ message: 'email, password, userName required' })
    try {
        const [[existing]] = await pool.execute('SELECT id FROM users WHERE email=?', [email.toLowerCase().trim()])
        if (existing) return res.status(400).json({ message: 'User already exist!' })

        const hash = await bcrypt.hash(password, 10)
        const id = randomUUID()
        await pool.execute(
            'INSERT INTO users (id, email, username, password_hash, role) VALUES (?,?,?,?,?)',
            [id, email.toLowerCase().trim(), userName.trim(), hash, 'staff']
        )

        const token = jwt.sign({ sub: id, role: 'staff' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        await pool.execute(
            'INSERT INTO sessions (id, user_id, token, ip_address, user_agent, expires_at) VALUES (?,?,?,?,?,?)',
            [randomUUID(), id, token, getIp(req), req.headers['user-agent'] || '', expiresAt]
        )

        await logActivity(id, 'sign_up', `email=${email}`, getIp(req))

        res.status(201).json({
            token,
            user: {
                userId:   id,
                userName: userName.trim(),
                email:    email.toLowerCase().trim(),
                avatar:   '',
                authority: ['staff', 'user'],
            },
        })
    } catch (e) {
        console.error('[AUTH] sign-up error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
}
app.post('/sign-up', handleSignUp)
app.post('/api/sign-up', handleSignUp)

// POST /sign-out  (also aliased as /api/sign-out)
const handleSignOut = async (req, res) => {
    const authHeader = req.headers['authorization'] || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (token) {
        try {
            const [[session]] = await pool.execute('SELECT user_id FROM sessions WHERE token=?', [token])
            if (session) {
                await logActivity(session.user_id, 'sign_out', null, getIp(req))
                await pool.execute('DELETE FROM sessions WHERE token=?', [token])
            }
        } catch { /* ignore */ }
    }
    res.json({ ok: true })
}
app.post('/sign-out', handleSignOut)
app.post('/api/sign-out', handleSignOut)

// GET /api/auth/me — validate token and return current user
app.get('/api/auth/me', requireAuth, (req, res) => {
    const u = req.user
    res.json({
        userId:    u.id,
        userName:  u.username,
        email:     u.email,
        avatar:    u.avatar || '',
        authority: [u.role, 'user'],
    })
})

// ── User Management API (admin only) ─────────────────────────────────────────

// GET /api/users
app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT id, email, username, role, avatar, is_active, created_at FROM users ORDER BY created_at ASC'
        )
        res.json({ ok: true, users: rows })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

// POST /api/users
app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
    const { email, password, username, role } = req.body || {}
    if (!email || !password || !username)
        return res.status(400).json({ ok: false, error: 'email, password, username required' })
    try {
        const [[existing]] = await pool.execute('SELECT id FROM users WHERE email=?', [email.toLowerCase().trim()])
        if (existing) return res.status(400).json({ ok: false, error: 'Email already in use' })
        const hash = await bcrypt.hash(password, 10)
        const id = randomUUID()
        await pool.execute(
            'INSERT INTO users (id, email, username, password_hash, role) VALUES (?,?,?,?,?)',
            [id, email.toLowerCase().trim(), username.trim(), hash, role === 'admin' ? 'admin' : 'staff']
        )
        await logActivity(req.user.id, 'create_user', `email=${email} role=${role}`, getIp(req))
        res.status(201).json({ ok: true, user: { id, email: email.toLowerCase().trim(), username: username.trim(), role: role || 'staff' } })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

// PUT /api/users/:id
app.put('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params
    const { username, role, is_active } = req.body || {}
    try {
        const fields = []
        const vals = []
        if (username !== undefined) { fields.push('username=?'); vals.push(username.trim()) }
        if (role !== undefined)     { fields.push('role=?');     vals.push(role === 'admin' ? 'admin' : 'staff') }
        if (is_active !== undefined){ fields.push('is_active=?'); vals.push(is_active ? 1 : 0) }
        if (!fields.length) return res.status(400).json({ ok: false, error: 'Nothing to update' })
        vals.push(id)
        await pool.execute(`UPDATE users SET ${fields.join(',')} WHERE id=?`, vals)
        await logActivity(req.user.id, 'update_user', `id=${id}`, getIp(req))
        res.json({ ok: true })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

// DELETE /api/users/:id
app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params
    if (id === req.user.id) return res.status(400).json({ ok: false, error: 'Cannot delete your own account' })
    try {
        await pool.execute('DELETE FROM users WHERE id=?', [id])
        await logActivity(req.user.id, 'delete_user', `id=${id}`, getIp(req))
        res.json({ ok: true })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

// PUT /api/users/:id/password (change own password or admin reset)
app.put('/api/users/:id/password', requireAuth, async (req, res) => {
    const { id } = req.params
    const { currentPassword, newPassword } = req.body || {}
    // Only admin can reset others' passwords; users can only change their own
    if (id !== req.user.id && req.user.role !== 'admin')
        return res.status(403).json({ ok: false, error: 'Forbidden' })
    if (!newPassword || newPassword.length < 6)
        return res.status(400).json({ ok: false, error: 'New password must be at least 6 characters' })
    try {
        const [[user]] = await pool.execute('SELECT password_hash FROM users WHERE id=?', [id])
        if (!user) return res.status(404).json({ ok: false, error: 'User not found' })
        // If changing own password, verify current password
        if (id === req.user.id && req.user.role !== 'admin') {
            if (!currentPassword || !(await bcrypt.compare(currentPassword, user.password_hash)))
                return res.status(400).json({ ok: false, error: 'Current password is incorrect' })
        }
        const hash = await bcrypt.hash(newPassword, 10)
        await pool.execute('UPDATE users SET password_hash=? WHERE id=?', [hash, id])
        // Revoke all sessions to force re-login
        await pool.execute('DELETE FROM sessions WHERE user_id=?', [id])
        await logActivity(req.user.id, 'change_password', `target=${id}`, getIp(req))
        res.json({ ok: true })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

// PUT /api/users/:id/profile (update own profile)
app.put('/api/users/:id/profile', requireAuth, async (req, res) => {
    const { id } = req.params
    if (id !== req.user.id && req.user.role !== 'admin')
        return res.status(403).json({ ok: false, error: 'Forbidden' })
    const { username, avatar } = req.body || {}
    try {
        const fields = []
        const vals = []
        if (username !== undefined) { fields.push('username=?'); vals.push(username.trim()) }
        if (avatar !== undefined)   { fields.push('avatar=?');   vals.push(avatar) }
        if (!fields.length) return res.status(400).json({ ok: false, error: 'Nothing to update' })
        vals.push(id)
        await pool.execute(`UPDATE users SET ${fields.join(',')} WHERE id=?`, vals)
        await logActivity(req.user.id, 'update_profile', null, getIp(req))
        res.json({ ok: true })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

// ── Settings Profile API ─────────────────────────────────────────────

// GET /api/setting/profile — return current user's profile for the Settings page
app.get('/api/setting/profile', requireAuth, async (req, res) => {
    try {
        const [[u]] = await pool.execute(
            'SELECT id, username, email, avatar, role, created_at FROM users WHERE id=?',
            [req.user.id]
        )
        if (!u) return res.status(404).json({ ok: false, error: 'User not found' })
        // Return shape compatible with SettingsProfile form
        res.json({
            firstName: u.username,
            lastName:  '',
            email:     u.email,
            img:       u.avatar || '',
            dialCode:  '',
            phoneNumber: '',
            country:   '',
            address:   '',
            postcode:  '',
            city:      '',
        })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

// ── Activity Log API ──────────────────────────────────────────────────────────

// GET /api/activity-log
app.get('/api/activity-log', requireAuth, async (req, res) => {
    const limit  = Math.min(parseInt(req.query.limit  || '50', 10), 200)
    const offset = parseInt(req.query.offset || '0', 10)
    // Staff can only see their own logs; admin sees all
    const whereClause = req.user.role === 'admin' ? '' : 'WHERE a.user_id=?'
    const params = req.user.role === 'admin' ? [limit, offset] : [req.user.id, limit, offset]
    try {
        const [rows] = await pool.execute(
            `SELECT a.id, a.action, a.detail, a.ip_address, a.created_at,
                    u.username, u.email, u.role
             FROM activity_log a
             LEFT JOIN users u ON a.user_id = u.id
             ${whereClause}
             ORDER BY a.created_at DESC
             LIMIT ? OFFSET ?`,
            params
        )
        res.json({ ok: true, logs: rows })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

// ── RBAC API (compatible with existing RolesPermissions UI) ─────────────────

// GET /api/rbac/users — paginated user list for Roles & Permissions page
app.get('/api/rbac/users', requireAuth, requireAdmin, async (req, res) => {
    const pageIndex = parseInt(req.query.pageIndex || '1', 10)
    const pageSize  = parseInt(req.query.pageSize  || '10', 10)
    const offset    = (pageIndex - 1) * pageSize
    const role      = req.query.role || ''
    const status    = req.query.status || ''

    let where = 'WHERE 1=1'
    const params = []
    if (role)   { where += ' AND role=?';      params.push(role) }
    if (status) { where += ' AND is_active=?'; params.push(status === 'active' ? 1 : 0) }

    try {
        const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM users ${where}`, params)
        const [rows] = await pool.execute(
            `SELECT u.id, u.username AS name, u.email, u.role, u.avatar AS img,
                    u.is_active,
                    COALESCE(MAX(UNIX_TIMESTAMP(s.created_at)), UNIX_TIMESTAMP(u.created_at)) AS lastOnline
             FROM users u
             LEFT JOIN sessions s ON s.user_id = u.id
             ${where}
             GROUP BY u.id
             ORDER BY u.created_at ASC
             LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
        )
        res.json({
            list: rows.map((r) => ({
                id:         r.id,
                name:       r.name,
                email:      r.email,
                img:        r.img || '',
                role:       r.role,
                lastOnline: r.lastOnline,
                status:     r.is_active ? 'active' : 'blocked',
            })),
            total,
        })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

// GET /api/rbac/roles — static role definitions for the UI
app.get('/api/rbac/roles', requireAuth, requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT role, COUNT(*) AS cnt FROM users GROUP BY role`
        )
        const counts = Object.fromEntries(rows.map((r) => [r.role, r.cnt]))
        res.json([
            {
                id:          'admin',
                name:        'Admin',
                description: 'Full access — can manage cafes, users, and view all reports.',
                users:       [],
                accessRight: { dashboard: ['read'], cafes: ['read','write','delete'], users: ['read','write','delete'] },
            },
            {
                id:          'staff',
                name:        'Staff',
                description: 'View-only access to the dashboard and reports.',
                users:       [],
                accessRight: { dashboard: ['read'] },
            },
        ])
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

// PUT /api/rbac/users/:id/role — change a user's role
app.put('/api/rbac/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params
    const { role } = req.body || {}
    if (!['admin','staff'].includes(role))
        return res.status(400).json({ ok: false, error: 'role must be admin or staff' })
    try {
        // Guard: if downgrading an admin to staff, ensure at least one other admin remains
        if (role === 'staff') {
            const [[{ adminCount }]] = await pool.execute(
                "SELECT COUNT(*) AS adminCount FROM users WHERE role='admin' AND is_active=1 AND id != ?",
                [id]
            )
            if (adminCount === 0) {
                return res.status(400).json({
                    ok: false,
                    error: 'Cannot remove the last admin. Promote another user to admin first.',
                })
            }
        }
        await pool.execute('UPDATE users SET role=? WHERE id=?', [role, id])
        await logActivity(req.user.id, 'update_user', `id=${id} role=${role}`, getIp(req))
        res.json({ ok: true })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

// PUT /api/rbac/users/:id/status — toggle active/blocked
app.put('/api/rbac/users/:id/status', requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params
    if (id === req.user.id) return res.status(400).json({ ok: false, error: 'Cannot change your own status' })
    const { status } = req.body || {}
    const isActive = status === 'active' ? 1 : 0
    try {
        await pool.execute('UPDATE users SET is_active=? WHERE id=?', [isActive, id])
        if (!isActive) await pool.execute('DELETE FROM sessions WHERE user_id=?', [id])
        await logActivity(req.user.id, 'update_user', `id=${id} status=${status}`, getIp(req))
        res.json({ ok: true })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

// ── REST API: Cafes (admin only for write operations) ────────────────────────

// Helper: grant all admin users access to a newly created cafe
async function grantAdminsAccessToCafe(cafeId) {
    const [admins] = await pool.execute("SELECT id FROM users WHERE role='admin'")
    for (const admin of admins) {
        await pool.execute(
            'INSERT IGNORE INTO user_cafe_access (user_id, cafe_id) VALUES (?, ?)',
            [admin.id, cafeId]
        )
    }
}

app.get('/api/cafes', requireAuth, async (req, res) => {
    try {
        let rows
        if (req.user.role === 'admin') {
            // Admin sees all cafes
            ;[rows] = await pool.execute(
                'SELECT * FROM cafes ORDER BY sort_order ASC, created_at ASC'
            )
        } else {
            // Staff only see cafes they have been granted access to
            ;[rows] = await pool.execute(
                `SELECT c.* FROM cafes c
                 INNER JOIN user_cafe_access uca ON uca.cafe_id = c.id
                 WHERE uca.user_id = ?
                 ORDER BY c.sort_order ASC, c.created_at ASC`,
                [req.user.id]
            )
        }
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

app.post('/api/cafes', requireAuth, requireAdmin, async (req, res) => {
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
        // Auto-grant all admins access to the new cafe
        await grantAdminsAccessToCafe(id)
        await logActivity(req.user.id, 'create_cafe', `name=${name}`, getIp(req))
        res.status(201).json({
            ok: true,
            cafe: { id, name: name.trim(), cafeId: cafeId.trim(), apiKey: apiKey.trim() },
        })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

app.put('/api/cafes/:id', requireAuth, requireAdmin, async (req, res) => {
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
        await logActivity(req.user.id, 'update_cafe', `id=${id}`, getIp(req))
        res.json({ ok: true, cafe: { id, name: name.trim(), cafeId: cafeId.trim(), apiKey: apiKey.trim() } })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

app.delete('/api/cafes/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params
        const [result] = await pool.execute('DELETE FROM cafes WHERE id=?', [id])
        if (result.affectedRows === 0)
            return res.status(404).json({ ok: false, error: 'Cafe not found' })
        await logActivity(req.user.id, 'delete_cafe', `id=${id}`, getIp(req))
        res.json({ ok: true })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

app.put('/api/cafes-reorder', requireAuth, requireAdmin, async (req, res) => {
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

// ── Cafe Access Management (admin only) ─────────────────────────────────────
// GET /api/rbac/users/:id/cafes — list all cafes with hasAccess flag for a user
app.get('/api/rbac/users/:id/cafes', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params
        const [allCafes] = await pool.execute(
            'SELECT * FROM cafes ORDER BY sort_order ASC, created_at ASC'
        )
        const [granted] = await pool.execute(
            'SELECT cafe_id FROM user_cafe_access WHERE user_id = ?',
            [id]
        )
        const grantedSet = new Set(granted.map((r) => r.cafe_id))
        res.json({
            ok: true,
            cafes: allCafes.map((c) => ({
                id:        c.id,
                name:      c.name,
                cafeId:    c.cafe_id,
                hasAccess: grantedSet.has(c.id),
            })),
        })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

// PUT /api/rbac/users/:id/cafes — replace the full access list for a user
app.put('/api/rbac/users/:id/cafes', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params
        const { cafeIds } = req.body  // array of cafe UUIDs to grant
        if (!Array.isArray(cafeIds))
            return res.status(400).json({ ok: false, error: 'cafeIds must be an array' })
        const conn = await pool.getConnection()
        try {
            await conn.beginTransaction()
            await conn.execute('DELETE FROM user_cafe_access WHERE user_id = ?', [id])
            for (const cafeId of cafeIds) {
                await conn.execute(
                    'INSERT INTO user_cafe_access (user_id, cafe_id) VALUES (?, ?)',
                    [id, cafeId]
                )
            }
            await conn.commit()
        } catch (e) {
            await conn.rollback()
            throw e
        } finally {
            conn.release()
        }
        await logActivity(req.user.id, 'update_cafe_access', `user=${id} cafes=${cafeIds.join(',')}`, getIp(req))
        res.json({ ok: true })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

// ── Smart caching proxy for iCafeCloud ──────────────────────────────────────
const CACHE_TTL = {
    shiftDetail:  25 * 1000,
    shiftList:    20 * 1000,
    reportChart:  5  * 60 * 1000,
    default:      15 * 1000,
}
const cache = new Map()
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

app.use('/icafe-api', async (req, res) => {
    const upstreamPath = req.url
    const targetUrl = 'https://api.icafecloud.com/api/v2' + upstreamPath
    const cacheKey = upstreamPath
    const now = Date.now()

    const cached = cache.get(cacheKey)
    if (cached && cached.expiresAt > now) {
        res.status(cached.statusCode)
        res.set('Content-Type', 'application/json')
        res.set('X-Cache', 'HIT')
        return res.send(cached.body)
    }

    if (inFlight.has(cacheKey)) {
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

    const fetchPromise = fetchUpstream(targetUrl, req.headers)
    inFlight.set(cacheKey, fetchPromise)

    try {
        const result = await fetchPromise
        inFlight.delete(cacheKey)

        if (result.statusCode === 200) {
            const ttl = getTtl(upstreamPath)
            cache.set(cacheKey, { body: result.body, statusCode: result.statusCode, expiresAt: now + ttl })
        }

        res.status(result.statusCode)
        res.set('Content-Type', 'application/json')
        res.set('X-Cache', 'MISS')
        return res.send(result.body)

    } catch (err) {
        inFlight.delete(cacheKey)
        return res.status(502).json({ code: 502, message: 'Proxy error: ' + err.message })
    }
})

setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of cache.entries()) {
        if (entry.expiresAt <= now) cache.delete(key)
    }
}, 60 * 1000)

// ── Dashboard data endpoints (template demo data) ───────────────────────────
// The ecommerce stats section uses this endpoint. Since it's template demo
// data unrelated to iCafeCloud, we serve the original mock data from the server.
const ecommerceDashboardData = require('./data/ecommerce_dashboard.json')
app.get('/api/dashboard/ecommerce', (req, res) => {
    res.json(ecommerceDashboardData)
})

// ── Serve the Vite production build (only when build/ exists) ───────────────
const buildDir = path.join(__dirname, 'build')
const fs = require('fs')
if (fs.existsSync(buildDir)) {
    app.use(express.static(buildDir))
    app.use((req, res) => {
        res.sendFile(path.join(buildDir, 'index.html'))
    })
} else {
    // Dev mode: Vite serves the frontend on port 5173
    app.use((req, res) => {
        res.status(404).json({ ok: false, message: 'API route not found (dev mode: frontend served by Vite on port 5173)' })
    })
}

app.listen(PORT, () => {
    console.log(`iCafe Dashboard server running on port ${PORT}`)
})
