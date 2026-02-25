require('dotenv').config()
const express = require('express')
const path = require('path')
const zlib = require('zlib')
const https = require('https')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const mysql = require('mysql2/promise')
const { randomUUID } = require('crypto')
const fs = require('fs')
const multer = require('multer')

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
                first_name    VARCHAR(100) NULL,
                last_name     VARCHAR(100) NULL,
                dial_code     VARCHAR(10)  NULL,
                phone_number  VARCHAR(20)  NULL,
                country       VARCHAR(100) NULL,
                address       VARCHAR(255) NULL,
                postcode      VARCHAR(20)  NULL,
                city          VARCHAR(100) NULL,
                theme_mode    ENUM('light', 'dark') NOT NULL DEFAULT 'light',
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
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS user_cafe_access (
                user_id    VARCHAR(36) NOT NULL,
                cafe_id    VARCHAR(36) NOT NULL,
                granted_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, cafe_id),
                FOREIGN KEY (user_id) REFERENCES users(id)  ON DELETE CASCADE,
                FOREIGN KEY (cafe_id) REFERENCES cafes(id)  ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)

        // QuickBooks connection settings
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS qb_settings (
                id         INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
                sandbox_client_id       VARCHAR(500) NOT NULL DEFAULT '',
                sandbox_client_secret   VARCHAR(500) NOT NULL DEFAULT '',
                production_client_id    VARCHAR(500) NOT NULL DEFAULT '',
                production_client_secret VARCHAR(500) NOT NULL DEFAULT '',
                qb_redirect_uri  VARCHAR(500) NOT NULL DEFAULT '',
                qb_environment   VARCHAR(20)  NOT NULL DEFAULT 'sandbox',
                is_connected     TINYINT(1)   NOT NULL DEFAULT 0,
                access_token     TEXT         NULL,
                refresh_token    TEXT         NULL,
                realm_id         VARCHAR(100) NULL,
                token_expires_at DATETIME     NULL,
                updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)

        // Migrate: add columns if they don't exist yet
        for (const col of [
            { name: 'sandbox_client_id',       def: "VARCHAR(500) NOT NULL DEFAULT '' AFTER id" },
            { name: 'sandbox_client_secret',   def: "VARCHAR(500) NOT NULL DEFAULT '' AFTER sandbox_client_id" },
            { name: 'production_client_id',    def: "VARCHAR(500) NOT NULL DEFAULT '' AFTER sandbox_client_secret" },
            { name: 'production_client_secret', def: "VARCHAR(500) NOT NULL DEFAULT '' AFTER production_client_id" },
            { name: 'qb_environment',   def: "VARCHAR(20) NOT NULL DEFAULT 'sandbox' AFTER qb_redirect_uri" },
            { name: 'access_token',     def: 'TEXT NULL AFTER is_connected' },
            { name: 'refresh_token',    def: 'TEXT NULL AFTER access_token' },
            { name: 'realm_id',         def: "VARCHAR(100) NULL AFTER refresh_token" },
            { name: 'token_expires_at', def: 'DATETIME NULL AFTER realm_id' },
        ]) {
            try {
                await conn.execute(`ALTER TABLE qb_settings ADD COLUMN ${col.name} ${col.def}`)
                console.log(`[DB] Added ${col.name} column to qb_settings`)
            } catch (err) {
                if (err.code !== 'ER_DUP_FIELDNAME') {
                    console.error(`[DB] Error adding ${col.name}:`, err.message)
                }
            }
        }

        // Migrate: copy old qb_client_id/qb_client_secret into sandbox fields if they exist
        try {
            const [[hasOld]] = await conn.execute("SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='qb_settings' AND column_name='qb_client_id'")
            if (hasOld && hasOld.cnt > 0) {
                await conn.execute("UPDATE qb_settings SET sandbox_client_id = qb_client_id, sandbox_client_secret = qb_client_secret WHERE sandbox_client_id = '' AND qb_client_id != ''")
                await conn.execute("ALTER TABLE qb_settings DROP COLUMN qb_client_id")
                await conn.execute("ALTER TABLE qb_settings DROP COLUMN qb_client_secret")
                console.log('[DB] Migrated old qb_client_id/qb_client_secret to sandbox fields')
            }
        } catch (err) {
            // Columns may already have been dropped
            if (err.code !== 'ER_CANT_DROP_FIELD_OR_KEY' && err.code !== 'ER_BAD_FIELD_ERROR') {
                console.error('[DB] Migration error:', err.message)
            }
        }

        // QuickBooks account mappings
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS qb_account_mappings (
                id                    INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
                topups_account        VARCHAR(255) NOT NULL DEFAULT '',
                shop_sales_account    VARCHAR(255) NOT NULL DEFAULT '',
                refunds_account       VARCHAR(255) NOT NULL DEFAULT '',
                center_expenses_account VARCHAR(255) NOT NULL DEFAULT '',
                updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)

        // QuickBooks automated report schedule
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS qb_schedule (
                id            INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
                schedule_type VARCHAR(50)  NOT NULL DEFAULT '',
                schedule_time VARCHAR(10)  NOT NULL DEFAULT '06:00',
                updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)

        // QuickBooks send history (unique per cafe + date to prevent duplicates)
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS qb_send_history (
                id          VARCHAR(36)  NOT NULL PRIMARY KEY,
                cafe_id     VARCHAR(36)  NOT NULL,
                cafe_name   VARCHAR(255) NOT NULL,
                report_date DATE         NOT NULL,
                sent_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                status      VARCHAR(20)  NOT NULL DEFAULT 'success',
                sent_by     VARCHAR(36)  NULL,
                UNIQUE KEY uq_cafe_date (cafe_id, report_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)

        // Ensure theme_mode column exists for existing users table
        try {
            await conn.execute("ALTER TABLE users ADD COLUMN theme_mode ENUM('light', 'dark') NOT NULL DEFAULT 'light' AFTER avatar")
            console.log('[DB] Added theme_mode column to users table')
        } catch (err) {
            // Ignore error if column already exists (Error 1060)
            if (err.code !== 'ER_DUP_FIELDNAME') {
                console.error('[DB] Error adding theme_mode column:', err.message)
            }
        }

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

// ── Body parser ──────────────────────────────────────────────
app.use(express.json())

// ── Static Files ──────────────────────────────────────────────
const uploadDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir)
}
app.use('/uploads', express.static(uploadDir))

// ── Multer Setup ──────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir)
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, uniqueSuffix + path.extname(file.originalname))
    }
})
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true)
        } else {
            cb(new Error('Only images are allowed'))
        }
    }
})

// ── Request logger ───────────────────────────────────────────────────────────
// Logs every incoming request: timestamp, method, path, IP
// Skips noisy static-asset requests (js/css/png/ico etc.)
app.use((req, _res, next) => {
    const skip = /\.(js|css|png|jpg|ico|svg|woff2?|ttf|map)$/i.test(req.path)
    if (!skip) {
        const ts = new Date().toISOString().replace('T',' ').slice(0,19)
        const ip = getIp(req)
        console.log(`[REQ] ${ts} ${req.method} ${req.path} — ${ip}`)
    }
    next()
})

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
                theme_mode: user.theme_mode,
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
                theme_mode: 'light',
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
        theme_mode: u.theme_mode,
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
    
    const { 
        username, avatar, theme_mode, 
        firstName, lastName, dialCode, phoneNumber, 
        country, address, postcode, city 
    } = req.body || {}

    try {
        const fields = []
        const vals = []
        if (username !== undefined) { fields.push('username=?'); vals.push(username.trim()) }
        if (avatar !== undefined)   { fields.push('avatar=?');   vals.push(avatar) }
        if (theme_mode !== undefined) { fields.push('theme_mode=?'); vals.push(theme_mode) }
        
        if (firstName !== undefined) { fields.push('first_name=?'); vals.push(firstName) }
        if (lastName !== undefined)  { fields.push('last_name=?');  vals.push(lastName) }
        if (dialCode !== undefined)  { fields.push('dial_code=?');  vals.push(dialCode) }
        if (phoneNumber !== undefined) { fields.push('phone_number=?'); vals.push(phoneNumber) }
        if (country !== undefined)   { fields.push('country=?');   vals.push(country) }
        if (address !== undefined)   { fields.push('address=?');   vals.push(address) }
        if (postcode !== undefined)  { fields.push('postcode=?');  vals.push(postcode) }
        if (city !== undefined)      { fields.push('city=?');      vals.push(city) }

        if (!fields.length) return res.status(400).json({ ok: false, error: 'Nothing to update' })
        vals.push(id)
        await pool.execute(`UPDATE users SET ${fields.join(',')} WHERE id=?`, vals)
        await logActivity(req.user.id, 'update_profile', null, getIp(req))
        res.json({ ok: true })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

// POST /api/profile/upload-avatar
app.post('/api/profile/upload-avatar', requireAuth, upload.single('avatar'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ ok: false, message: 'No file uploaded' })
    }
    const avatarUrl = `/uploads/${req.file.filename}`
    try {
        await pool.execute('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, req.user.id])
        res.json({ ok: true, avatarUrl })
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message })
    }
})

// ── Settings Profile API ─────────────────────────────────────────────

// GET /api/setting/profile — return current user's profile for the Settings page
app.get('/api/setting/profile', requireAuth, async (req, res) => {
    try {
        const [[u]] = await pool.execute(
            'SELECT * FROM users WHERE id=?',
            [req.user.id]
        )
        if (!u) return res.status(404).json({ ok: false, error: 'User not found' })
        // Return shape compatible with SettingsProfile form
        res.json({
            firstName: u.first_name || u.username,
            lastName:  u.last_name || '',
            email:     u.email,
            img:       u.avatar || '',
            dialCode:  u.dial_code || '',
            phoneNumber: u.phone_number || '',
            country:   u.country || '',
            address:   u.address || '',
            postcode:  u.postcode || '',
            city:      u.city || '',
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
    products:     10 * 60 * 1000,
    billingLogs:  2  * 60 * 1000,
    pcs:          15 * 1000,
    default:      15 * 1000,
}
const cache = new Map()
const inFlight = new Map()

// ── Upstream concurrency limiter ────────────────────────────────────────────
// Limits concurrent upstream API requests to avoid "Too Many Attempts" (507)
// from iCafeCloud rate limiting. Requests beyond the limit wait in a queue.
const MAX_CONCURRENT_UPSTREAM = 3
let activeUpstream = 0
const upstreamQueue = []

function enqueueUpstream(fn) {
    return new Promise((resolve, reject) => {
        const run = () => {
            activeUpstream++
            fn().then(resolve, reject).finally(() => {
                activeUpstream--
                if (upstreamQueue.length > 0) {
                    const next = upstreamQueue.shift()
                    next()
                }
            })
        }
        if (activeUpstream < MAX_CONCURRENT_UPSTREAM) {
            run()
        } else {
            upstreamQueue.push(run)
        }
    })
}

function getTtl(urlPath) {
    if (urlPath.includes('shiftDetail'))  return CACHE_TTL.shiftDetail
    if (urlPath.includes('shiftList'))    return CACHE_TTL.shiftList
    if (urlPath.includes('reportChart'))  return CACHE_TTL.reportChart
    if (urlPath.includes('/products'))    return CACHE_TTL.products
    if (urlPath.includes('billingLogs'))  return CACHE_TTL.billingLogs
    if (urlPath.includes('/pcs'))         return CACHE_TTL.pcs
    if (urlPath.includes('/pcList'))      return CACHE_TTL.pcs
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
        const ttlLeft = Math.round((cached.expiresAt - now) / 1000)
        console.log(`[PROXY] CACHE HIT  ${upstreamPath} (expires in ${ttlLeft}s)`)
        res.status(cached.statusCode)
        res.set('Content-Type', 'application/json')
        res.set('X-Cache', 'HIT')
        return res.send(cached.body)
    }

    if (inFlight.has(cacheKey)) {
        console.log(`[PROXY] DEDUP      ${upstreamPath} (waiting for in-flight request)`)
        try {
            const result = await inFlight.get(cacheKey)
            res.status(result.statusCode)
            res.set('Content-Type', 'application/json')
            res.set('X-Cache', 'DEDUP')
            return res.send(result.body)
        } catch (err) {
            console.error(`[PROXY] DEDUP ERR  ${upstreamPath} — ${err.message}`)
            return res.status(502).json({ code: 502, message: 'Upstream error: ' + err.message })
        }
    }

    console.log(`[PROXY] MISS       ${upstreamPath} → fetching upstream (queue: ${upstreamQueue.length}, active: ${activeUpstream}/${MAX_CONCURRENT_UPSTREAM})`)
    const fetchPromise = enqueueUpstream(() => fetchUpstream(targetUrl, req.headers))
    inFlight.set(cacheKey, fetchPromise)

    try {
        const result = await fetchPromise
        inFlight.delete(cacheKey)

        if (result.statusCode === 200) {
            const ttl = getTtl(upstreamPath)
            cache.set(cacheKey, { body: result.body, statusCode: result.statusCode, expiresAt: now + ttl })
            console.log(`[PROXY] CACHED     ${upstreamPath} (TTL ${ttl/1000}s, status ${result.statusCode})`)
        } else {
            console.warn(`[PROXY] UPSTREAM   ${upstreamPath} — status ${result.statusCode} (not cached)`)
        }

        res.status(result.statusCode)
        res.set('Content-Type', 'application/json')
        res.set('X-Cache', 'MISS')
        return res.send(result.body)

    } catch (err) {
        inFlight.delete(cacheKey)
        console.error(`[PROXY] ERROR      ${upstreamPath} — ${err.message}`)
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

// ── QuickBooks API ──────────────────────────────────────────────────────────

// QuickBooks OAuth2 endpoints
const QB_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2'
const QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const QB_REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke'
const QB_API_BASE_SANDBOX = 'https://sandbox-quickbooks.api.intuit.com/v3/company'
const QB_API_BASE_PRODUCTION = 'https://quickbooks.api.intuit.com/v3/company'
const QB_SCOPE = 'com.intuit.quickbooks.accounting'

function getQBApiBase(environment) {
    return environment === 'production' ? QB_API_BASE_PRODUCTION : QB_API_BASE_SANDBOX
}

// Helper: get active client credentials based on the stored environment
function getQBCredentials(settings) {
    const env = settings.qb_environment || 'sandbox'
    if (env === 'production') {
        return { clientId: settings.production_client_id, clientSecret: settings.production_client_secret }
    }
    return { clientId: settings.sandbox_client_id, clientSecret: settings.sandbox_client_secret }
}

// Helper: ensure single-row config tables have a row
async function ensureQBRow(table) {
    const [[row]] = await pool.execute(`SELECT id FROM ${table} LIMIT 1`)
    if (!row) {
        await pool.execute(`INSERT INTO ${table} () VALUES ()`)
    }
}

// Helper: make an HTTPS request and return { statusCode, body }
function qbHttpsRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url)
        const reqOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: options.headers || {},
        }
        const req = https.request(reqOptions, (res) => {
            let body = ''
            res.on('data', (chunk) => { body += chunk })
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, body })
            })
        })
        req.on('error', reject)
        if (options.body) req.write(options.body)
        req.end()
    })
}

// Helper: refresh the access token using the refresh token
async function refreshQBToken(settings) {
    const { clientId, clientSecret } = getQBCredentials(settings)
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const postData = `grant_type=refresh_token&refresh_token=${encodeURIComponent(settings.refresh_token)}`
    const result = await qbHttpsRequest(QB_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${basicAuth}`,
            'Accept': 'application/json',
        },
        body: postData,
    })
    if (result.statusCode !== 200) {
        console.error('[QB] Token refresh failed:', result.body)
        return null
    }
    const tokenData = JSON.parse(result.body)
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)
    await pool.execute(
        'UPDATE qb_settings SET access_token=?, refresh_token=?, token_expires_at=? ORDER BY id LIMIT 1',
        [tokenData.access_token, tokenData.refresh_token, expiresAt]
    )
    return tokenData.access_token
}

// Helper: get a valid access token (refreshes if expired)
async function getValidQBToken() {
    await ensureQBRow('qb_settings')
    const [[settings]] = await pool.execute('SELECT * FROM qb_settings LIMIT 1')
    if (!settings || !settings.is_connected || !settings.access_token) return null

    // Check if token is expired (refresh 5 minutes before expiry)
    const now = new Date()
    const expiresAt = settings.token_expires_at ? new Date(settings.token_expires_at) : null
    if (!expiresAt || now >= new Date(expiresAt.getTime() - 5 * 60 * 1000)) {
        if (!settings.refresh_token) return null
        const newToken = await refreshQBToken(settings)
        return newToken
    }
    return settings.access_token
}

// GET /api/quickbooks/settings
app.get('/api/quickbooks/settings', requireAuth, requireAdmin, async (req, res) => {
    try {
        await ensureQBRow('qb_settings')
        const [[row]] = await pool.execute('SELECT * FROM qb_settings LIMIT 1')
        res.json({
            sandbox_client_id: row.sandbox_client_id,
            sandbox_client_secret: row.sandbox_client_secret,
            production_client_id: row.production_client_id,
            production_client_secret: row.production_client_secret,
            qb_redirect_uri: row.qb_redirect_uri,
            qb_environment: row.qb_environment || 'sandbox',
            is_connected: !!row.is_connected,
            realm_id: row.realm_id || '',
        })
    } catch (e) {
        console.error('[QB] settings get error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// POST /api/quickbooks/settings
app.post('/api/quickbooks/settings', requireAuth, requireAdmin, async (req, res) => {
    const { sandbox_client_id, sandbox_client_secret, production_client_id, production_client_secret, qb_redirect_uri, qb_environment } = req.body || {}
    try {
        await ensureQBRow('qb_settings')
        await pool.execute(
            'UPDATE qb_settings SET sandbox_client_id=?, sandbox_client_secret=?, production_client_id=?, production_client_secret=?, qb_redirect_uri=?, qb_environment=? ORDER BY id LIMIT 1',
            [sandbox_client_id || '', sandbox_client_secret || '', production_client_id || '', production_client_secret || '', qb_redirect_uri || '', qb_environment === 'production' ? 'production' : 'sandbox']
        )
        await logActivity(req.user.id, 'qb_settings_update', 'QuickBooks settings updated', getIp(req))
        res.json({ ok: true })
    } catch (e) {
        console.error('[QB] settings save error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// GET /api/quickbooks/auth-url — generate the real QuickBooks OAuth2 authorization URL
app.get('/api/quickbooks/auth-url', requireAuth, requireAdmin, async (req, res) => {
    try {
        await ensureQBRow('qb_settings')
        const [[settings]] = await pool.execute('SELECT * FROM qb_settings LIMIT 1')
        if (!settings.qb_redirect_uri) {
            return res.status(400).json({ message: 'Please save your Redirect URI first.' })
        }
        const { clientId, clientSecret } = getQBCredentials(settings)
        if (!clientId || !clientSecret) {
            return res.status(400).json({ message: `Please save your ${settings.qb_environment || 'sandbox'} Client ID and Client Secret first.` })
        }
        const state = randomUUID()
        const authUrl = `${QB_AUTH_URL}?client_id=${encodeURIComponent(clientId)}&response_type=code&scope=${encodeURIComponent(QB_SCOPE)}&redirect_uri=${encodeURIComponent(settings.qb_redirect_uri)}&state=${state}`
        res.json({ auth_url: authUrl, state })
    } catch (e) {
        console.error('[QB] auth-url error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// GET /api/quickbooks/callback — handle the OAuth2 callback from QuickBooks
app.get('/api/quickbooks/callback', async (req, res) => {
    const { code, realmId, state, error } = req.query
    if (error) {
        console.error('[QB] OAuth error:', error)
        // Redirect to the QuickBooks settings page with error
        return res.redirect('/quickbooks?qb_error=' + encodeURIComponent(error))
    }
    if (!code || !realmId) {
        return res.redirect('/quickbooks?qb_error=missing_code_or_realm')
    }
    try {
        await ensureQBRow('qb_settings')
        const [[settings]] = await pool.execute('SELECT * FROM qb_settings LIMIT 1')
        if (!settings.qb_redirect_uri) {
            return res.redirect('/quickbooks?qb_error=missing_credentials')
        }
        const { clientId, clientSecret } = getQBCredentials(settings)
        if (!clientId || !clientSecret) {
            return res.redirect('/quickbooks?qb_error=missing_credentials')
        }

        // Exchange authorization code for tokens
        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
        const postData = `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(settings.qb_redirect_uri)}`

        const result = await qbHttpsRequest(QB_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${basicAuth}`,
                'Accept': 'application/json',
            },
            body: postData,
        })

        if (result.statusCode !== 200) {
            console.error('[QB] Token exchange failed:', result.body)
            return res.redirect('/quickbooks?qb_error=token_exchange_failed')
        }

        const tokenData = JSON.parse(result.body)
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

        // Store tokens and mark as connected
        await pool.execute(
            'UPDATE qb_settings SET access_token=?, refresh_token=?, realm_id=?, token_expires_at=?, is_connected=1 ORDER BY id LIMIT 1',
            [tokenData.access_token, tokenData.refresh_token, realmId, expiresAt]
        )

        await logActivity(null, 'qb_connect', `Connected to QuickBooks (realmId=${realmId})`, '')
        console.log('[QB] Successfully connected to QuickBooks, realmId:', realmId)

        // Redirect to the QuickBooks settings page with success
        return res.redirect('/quickbooks?qb_connected=true')
    } catch (e) {
        console.error('[QB] callback error:', e.message)
        return res.redirect('/quickbooks?qb_error=server_error')
    }
})

// POST /api/quickbooks/disconnect — revoke tokens and clear connection
app.post('/api/quickbooks/disconnect', requireAuth, requireAdmin, async (req, res) => {
    try {
        await ensureQBRow('qb_settings')
        const [[settings]] = await pool.execute('SELECT * FROM qb_settings LIMIT 1')

        // Revoke the token at QuickBooks if we have one
        if (settings.refresh_token) {
            const { clientId, clientSecret } = getQBCredentials(settings)
            if (clientId && clientSecret) {
                try {
                    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
                    const postData = JSON.stringify({ token: settings.refresh_token })
                    await qbHttpsRequest(QB_REVOKE_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Basic ${basicAuth}`,
                            'Accept': 'application/json',
                        },
                        body: postData,
                    })
                    console.log('[QB] Token revoked at QuickBooks')
                } catch (revokeErr) {
                    console.error('[QB] Token revoke error (non-critical):', revokeErr.message)
                }
            }
        }

        // Clear tokens and mark as disconnected
        await pool.execute(
            'UPDATE qb_settings SET is_connected=0, access_token=NULL, refresh_token=NULL, realm_id=NULL, token_expires_at=NULL ORDER BY id LIMIT 1'
        )
        await logActivity(req.user.id, 'qb_disconnect', 'Disconnected from QuickBooks', getIp(req))
        res.json({ ok: true })
    } catch (e) {
        console.error('[QB] disconnect error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// GET /api/quickbooks/accounts — fetch real Chart of Accounts from QuickBooks API
app.get('/api/quickbooks/accounts', requireAuth, requireAdmin, async (req, res) => {
    try {
        await ensureQBRow('qb_settings')
        const [[settings]] = await pool.execute('SELECT * FROM qb_settings LIMIT 1')

        if (!settings.is_connected || !settings.realm_id) {
            return res.json([])
        }

        const accessToken = await getValidQBToken()
        if (!accessToken) {
            // Token could not be refreshed — mark as disconnected
            await pool.execute(
                'UPDATE qb_settings SET is_connected=0, access_token=NULL, refresh_token=NULL, realm_id=NULL, token_expires_at=NULL ORDER BY id LIMIT 1'
            )
            return res.status(401).json({ message: 'QuickBooks session expired. Please reconnect.' })
        }

        // Query the Chart of Accounts from QuickBooks
        const query = encodeURIComponent("SELECT * FROM Account WHERE Active = true ORDERBY Name")
        const apiBase = getQBApiBase(settings.qb_environment)
        const url = `${apiBase}/${settings.realm_id}/query?query=${query}&minorversion=65`

        const result = await qbHttpsRequest(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
            },
        })

        if (result.statusCode !== 200) {
            console.error('[QB] Account query failed:', result.statusCode, result.body)
            return res.status(502).json({ message: 'Failed to fetch accounts from QuickBooks' })
        }

        const data = JSON.parse(result.body)
        const qbAccounts = (data.QueryResponse && data.QueryResponse.Account) || []
        const accounts = qbAccounts.map((acct) => ({
            id: acct.Id,
            name: `${acct.AccountType} - ${acct.Name}`,
        }))

        res.json(accounts)
    } catch (e) {
        console.error('[QB] accounts error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// GET /api/quickbooks/mappings
app.get('/api/quickbooks/mappings', requireAuth, requireAdmin, async (req, res) => {
    try {
        await ensureQBRow('qb_account_mappings')
        const [[row]] = await pool.execute('SELECT * FROM qb_account_mappings LIMIT 1')
        res.json({
            topups_account: row.topups_account,
            shop_sales_account: row.shop_sales_account,
            refunds_account: row.refunds_account,
            center_expenses_account: row.center_expenses_account,
        })
    } catch (e) {
        console.error('[QB] mappings get error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// POST /api/quickbooks/mappings
app.post('/api/quickbooks/mappings', requireAuth, requireAdmin, async (req, res) => {
    const { topups_account, shop_sales_account, refunds_account, center_expenses_account } = req.body || {}
    try {
        await ensureQBRow('qb_account_mappings')
        await pool.execute(
            'UPDATE qb_account_mappings SET topups_account=?, shop_sales_account=?, refunds_account=?, center_expenses_account=? ORDER BY id LIMIT 1',
            [topups_account || '', shop_sales_account || '', refunds_account || '', center_expenses_account || '']
        )
        await logActivity(req.user.id, 'qb_mappings_update', 'QuickBooks account mappings updated', getIp(req))
        res.json({ ok: true })
    } catch (e) {
        console.error('[QB] mappings save error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// POST /api/quickbooks/send-report
app.post('/api/quickbooks/send-report', requireAuth, requireAdmin, async (req, res) => {
    const { cafe_id, report_date } = req.body || {}
    if (!cafe_id || !report_date) {
        return res.status(400).json({ message: 'cafe_id and report_date required' })
    }
    try {
        // Check for duplicate
        const [[existing]] = await pool.execute(
            'SELECT id FROM qb_send_history WHERE cafe_id=? AND report_date=?',
            [cafe_id, report_date]
        )
        if (existing) {
            return res.status(409).json({ message: 'Report for this cafe and date has already been sent' })
        }

        // Look up cafe details (name, iCafe cafe_id, api_key)
        const [[cafe]] = await pool.execute('SELECT name, cafe_id AS icafe_cafe_id, api_key FROM cafes WHERE id=?', [cafe_id])
        if (!cafe) {
            return res.status(404).json({ message: 'Cafe not found' })
        }
        const cafeName = cafe.name

        // Verify QuickBooks is connected
        await ensureQBRow('qb_settings')
        const [[qbSettings]] = await pool.execute('SELECT * FROM qb_settings LIMIT 1')
        if (!qbSettings.is_connected || !qbSettings.realm_id) {
            return res.status(400).json({ message: 'QuickBooks is not connected. Please connect first.' })
        }

        // Get valid QB access token
        const accessToken = await getValidQBToken()
        if (!accessToken) {
            return res.status(401).json({ message: 'QuickBooks session expired. Please reconnect.' })
        }

        // Load account mappings
        await ensureQBRow('qb_account_mappings')
        const [[mappings]] = await pool.execute('SELECT * FROM qb_account_mappings LIMIT 1')
        if (!mappings.topups_account && !mappings.shop_sales_account && !mappings.refunds_account && !mappings.center_expenses_account) {
            return res.status(400).json({ message: 'No account mappings configured. Please set up account mappings first.' })
        }

        // ── Fetch daily totals from iCafe API ────────────────────────────────
        // Compute nextDate (report_date + 1 day) for the business-day shift query
        const dateParts = report_date.split('-').map(Number)
        const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2])
        dateObj.setDate(dateObj.getDate() + 1)
        const nextDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`

        const authHeader = `Bearer ${cafe.api_key}`

        // Helper: fetch from the iCafe API using the upstream proxy logic (handles gzip/brotli)
        async function fetchIcafeApi(urlPath) {
            const url = 'https://api.icafecloud.com/api/v2' + urlPath
            try {
                const result = await fetchUpstream(url, { authorization: authHeader })
                if (result.statusCode !== 200) {
                    console.error(`[QB] iCafe API error: ${result.statusCode}`, typeof result.body === 'string' ? result.body.substring(0, 200) : '')
                    return null
                }
                const bodyStr = typeof result.body === 'string' ? result.body : result.body.toString('utf8')
                return JSON.parse(bodyStr)
            } catch (err) {
                console.error(`[QB] iCafe API fetch error:`, err.message)
                return null
            }
        }

        // Use a single 2-day range query to bypass the iCafe API's 3-result cap,
        // then filter client-side (matching the dashboard's apiGetBusinessDayShiftList).
        const shiftListResp = await fetchIcafeApi(
            `/cafe/${cafe.icafe_cafe_id}/reports/shiftList?date_start=${report_date}&date_end=${nextDate}&time_start=00:00&time_end=23:59`
        )
        const rawShifts = (shiftListResp && shiftListResp.data) || []

        // Filter: keep shifts that started on report_date (any time) or on nextDate before 06:00
        const seen = new Set()
        const allShifts = []
        for (const item of rawShifts) {
            const startTime = String(item.shift_start_time || '')
            const [startDate, startTimePart = ''] = startTime.split(' ')
            const id = item.shift_id || item.id
            if (seen.has(id)) continue

            if (startDate === report_date) {
                seen.add(id); allShifts.push(item)
            } else if (startDate === nextDate && startTimePart < '06:00:00') {
                seen.add(id); allShifts.push(item)
            }
        }

        console.log(`[QB] Found ${allShifts.length} shifts for ${cafeName} on ${report_date} (raw: ${rawShifts.length})`)

        // Aggregate daily totals from shift details
        let totalTopUps = 0
        let totalShopSales = 0
        let totalRefunds = 0
        let totalExpenses = 0

        for (const shift of allShifts) {
            const shiftId = shift.shift_id || shift.id
            if (!shiftId) continue
            // Use path parameter (not query param) for shiftDetail — matches the iCafe API
            const detail = await fetchIcafeApi(
                `/cafe/${cafe.icafe_cafe_id}/reports/shiftDetail/${shiftId}`
            )
            if (!detail || !detail.data) {
                console.log(`[QB] No detail for shift ${shiftId}`)
                continue
            }
            const d = detail.data

            const cash = Number(d.cash) || 0
            const shopSalesArr = Array.isArray(d.shop_sales) ? d.shop_sales : []
            const shopSales = shopSalesArr.reduce((sum, item) => sum + (parseFloat(String(item.cash || 0)) || 0), 0)
            const digitalTopups = (Number(d.qr_topup) || 0) + (Number(d.credit_card) || 0)
            const topUps = (cash - shopSales) + digitalTopups
            const refunds = Number(d.cash_refund) || 0
            const expenses = Number(d.center_expenses) || 0

            totalTopUps += topUps
            totalShopSales += shopSales
            totalRefunds += refunds
            totalExpenses += expenses

            console.log(`[QB] Shift ${shiftId}: topUps=${topUps.toFixed(2)}, shopSales=${shopSales.toFixed(2)}, refunds=${refunds.toFixed(2)}, expenses=${expenses.toFixed(2)}`)
        }

        console.log(`[QB] Totals for ${cafeName} on ${report_date}: topUps=${totalTopUps.toFixed(2)}, shopSales=${totalShopSales.toFixed(2)}, refunds=${totalRefunds.toFixed(2)}, expenses=${totalExpenses.toFixed(2)}`)

        // ── Build QuickBooks JournalEntry ─────────────────────────────────────
        // Debit lines: income accounts (Top-ups, Shop Sales)
        // Credit lines: Bank/Cash (offset)
        // Refunds: debit (reduce income)
        // Center Expenses: debit expense account
        const lines = []
        const description = `${cafeName} Daily Report - ${report_date}`

        // Use a "Bank" account as the offsetting account.
        // We'll use the first mapped account as the credit offset, or create balanced entries.
        // QuickBooks JournalEntry requires balanced debits and credits.

        // Income lines (Credit = revenue earned)
        if (totalTopUps > 0 && mappings.topups_account) {
            lines.push({
                Description: `Top-ups - ${cafeName} - ${report_date}`,
                Amount: Math.round(totalTopUps * 100) / 100,
                DetailType: 'JournalEntryLineDetail',
                JournalEntryLineDetail: {
                    PostingType: 'Credit',
                    AccountRef: { value: mappings.topups_account },
                },
            })
        }

        if (totalShopSales > 0 && mappings.shop_sales_account) {
            lines.push({
                Description: `Shop Sales - ${cafeName} - ${report_date}`,
                Amount: Math.round(totalShopSales * 100) / 100,
                DetailType: 'JournalEntryLineDetail',
                JournalEntryLineDetail: {
                    PostingType: 'Credit',
                    AccountRef: { value: mappings.shop_sales_account },
                },
            })
        }

        if (totalRefunds > 0 && mappings.refunds_account) {
            lines.push({
                Description: `Refunds - ${cafeName} - ${report_date}`,
                Amount: Math.round(totalRefunds * 100) / 100,
                DetailType: 'JournalEntryLineDetail',
                JournalEntryLineDetail: {
                    PostingType: 'Debit',
                    AccountRef: { value: mappings.refunds_account },
                },
            })
        }

        if (totalExpenses > 0 && mappings.center_expenses_account) {
            lines.push({
                Description: `Center Expenses - ${cafeName} - ${report_date}`,
                Amount: Math.round(Math.abs(totalExpenses) * 100) / 100,
                DetailType: 'JournalEntryLineDetail',
                JournalEntryLineDetail: {
                    PostingType: 'Debit',
                    AccountRef: { value: mappings.center_expenses_account },
                },
            })
        }

        if (lines.length === 0) {
            return res.status(400).json({ message: `No reportable amounts found for ${cafeName} on ${report_date}. All totals are zero or no account mappings configured.` })
        }

        // Add an offsetting Debit/Credit line to balance the journal entry
        // Total credits - total debits = net amount for the offset line
        let totalCredits = 0
        let totalDebits = 0
        for (const line of lines) {
            if (line.JournalEntryLineDetail.PostingType === 'Credit') {
                totalCredits += line.Amount
            } else {
                totalDebits += line.Amount
            }
        }
        const netOffset = Math.round((totalCredits - totalDebits) * 100) / 100

        if (netOffset > 0) {
            // More credits than debits → add a Debit line (e.g., cash/bank received)
            // Use topups_account as the default offset if it's an income account,
            // or fall back to the first available mapping
            const offsetAccount = mappings.topups_account || mappings.shop_sales_account
            lines.push({
                Description: `Cash/Bank Deposit - ${cafeName} - ${report_date}`,
                Amount: netOffset,
                DetailType: 'JournalEntryLineDetail',
                JournalEntryLineDetail: {
                    PostingType: 'Debit',
                    AccountRef: { value: offsetAccount },
                },
            })
        } else if (netOffset < 0) {
            // More debits than credits → add a Credit line
            const offsetAccount = mappings.topups_account || mappings.shop_sales_account
            lines.push({
                Description: `Cash/Bank - ${cafeName} - ${report_date}`,
                Amount: Math.abs(netOffset),
                DetailType: 'JournalEntryLineDetail',
                JournalEntryLineDetail: {
                    PostingType: 'Credit',
                    AccountRef: { value: offsetAccount },
                },
            })
        }

        const journalEntry = {
            TxnDate: report_date,
            PrivateNote: description,
            Line: lines,
        }

        // ── POST JournalEntry to QuickBooks ──────────────────────────────────
        const apiBase = getQBApiBase(qbSettings.qb_environment)
        const qbUrl = `${apiBase}/${qbSettings.realm_id}/journalentry?minorversion=65`

        const qbResult = await qbHttpsRequest(qbUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(journalEntry),
        })

        const historyId = randomUUID()

        if (qbResult.statusCode === 200 || qbResult.statusCode === 201) {
            // Success — log to history
            await pool.execute(
                'INSERT INTO qb_send_history (id, cafe_id, cafe_name, report_date, status, sent_by) VALUES (?,?,?,?,?,?)',
                [historyId, cafe_id, cafeName, report_date, 'success', req.user.id]
            )
            await logActivity(req.user.id, 'qb_report_sent', `Report sent for ${cafeName} on ${report_date} (Top-ups: ${totalTopUps.toFixed(2)}, Shop Sales: ${totalShopSales.toFixed(2)}, Refunds: ${totalRefunds.toFixed(2)}, Expenses: ${totalExpenses.toFixed(2)})`, getIp(req))

            let qbResponse = {}
            try { qbResponse = JSON.parse(qbResult.body) } catch {}
            res.json({ ok: true, id: historyId, qb_journal_id: qbResponse.JournalEntry ? qbResponse.JournalEntry.Id : null, totals: { top_ups: totalTopUps, shop_sales: totalShopSales, refunds: totalRefunds, center_expenses: totalExpenses } })
        } else {
            // Failed — log to history with failed status
            console.error('[QB] JournalEntry creation failed:', qbResult.statusCode, qbResult.body)
            await pool.execute(
                'INSERT INTO qb_send_history (id, cafe_id, cafe_name, report_date, status, sent_by) VALUES (?,?,?,?,?,?)',
                [historyId, cafe_id, cafeName, report_date, 'failed', req.user.id]
            )
            await logActivity(req.user.id, 'qb_report_failed', `Report failed for ${cafeName} on ${report_date}: QB status ${qbResult.statusCode}`, getIp(req))

            let errorMsg = 'Failed to create journal entry in QuickBooks'
            try {
                const errBody = JSON.parse(qbResult.body)
                if (errBody.Fault && errBody.Fault.Error) {
                    errorMsg = errBody.Fault.Error.map(e => e.Message || e.Detail).join('; ')
                }
            } catch {}
            res.status(502).json({ message: errorMsg })
        }
    } catch (e) {
        console.error('[QB] send-report error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// GET /api/quickbooks/schedule
app.get('/api/quickbooks/schedule', requireAuth, requireAdmin, async (req, res) => {
    try {
        await ensureQBRow('qb_schedule')
        const [[row]] = await pool.execute('SELECT * FROM qb_schedule LIMIT 1')
        res.json({
            schedule_type: row.schedule_type,
            schedule_time: row.schedule_time,
        })
    } catch (e) {
        console.error('[QB] schedule get error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// POST /api/quickbooks/schedule
app.post('/api/quickbooks/schedule', requireAuth, requireAdmin, async (req, res) => {
    const { schedule_type, schedule_time } = req.body || {}
    try {
        await ensureQBRow('qb_schedule')
        await pool.execute(
            'UPDATE qb_schedule SET schedule_type=?, schedule_time=? ORDER BY id LIMIT 1',
            [schedule_type || '', schedule_time || '06:00']
        )
        await logActivity(req.user.id, 'qb_schedule_update', `Schedule set to ${schedule_type}`, getIp(req))
        res.json({ ok: true })
    } catch (e) {
        console.error('[QB] schedule save error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// GET /api/quickbooks/history
app.get('/api/quickbooks/history', requireAuth, requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT id, cafe_id, cafe_name, report_date, sent_at, status FROM qb_send_history ORDER BY sent_at DESC LIMIT 100'
        )
        res.json(rows)
    } catch (e) {
        console.error('[QB] history error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// ── Serve the Vite production build (only when build/ exists) ───────────────
const buildDir = path.join(__dirname, 'build')
//const fs = require('fs')
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
