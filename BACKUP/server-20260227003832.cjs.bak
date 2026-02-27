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
                deposit_account       VARCHAR(255) NOT NULL DEFAULT '',
                updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)

        // Migrate: add deposit_account column if it doesn't exist
        try {
            await conn.execute("ALTER TABLE qb_account_mappings ADD COLUMN deposit_account VARCHAR(255) NOT NULL DEFAULT '' AFTER center_expenses_account")
            console.log('[DB] Added deposit_account column to qb_account_mappings')
        } catch (err) {
            if (err.code !== 'ER_DUP_FIELDNAME') {
                console.error('[DB] Error adding deposit_account:', err.message)
            }
        }

        // QuickBooks automated report schedule
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS qb_schedule (
                id            INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
                schedule_type VARCHAR(50)  NOT NULL DEFAULT '',
                schedule_time VARCHAR(10)  NOT NULL DEFAULT '06:00',
                last_run_date VARCHAR(10)  NOT NULL DEFAULT '',
                updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)

        // Ensure last_run_date column exists for existing qb_schedule tables
        try {
            await conn.execute("ALTER TABLE qb_schedule ADD COLUMN last_run_date VARCHAR(10) NOT NULL DEFAULT '' AFTER schedule_time")
        } catch (err) {
            if (err.code !== 'ER_DUP_FIELDNAME') throw err
        }

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

        // QuickBooks scheduler run logs (visible in the UI)
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS qb_scheduler_logs (
                id          INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
                report_date VARCHAR(10)  NOT NULL,
                run_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                schedule_type VARCHAR(50) NOT NULL DEFAULT '',
                success_count INT        NOT NULL DEFAULT 0,
                skip_count    INT        NOT NULL DEFAULT 0,
                fail_count    INT        NOT NULL DEFAULT 0,
                details     TEXT         NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)

        // Google Sheets connection settings
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS gs_settings (
                id             INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
                client_id      VARCHAR(500) NOT NULL DEFAULT '',
                client_secret  VARCHAR(500) NOT NULL DEFAULT '',
                redirect_uri   VARCHAR(500) NOT NULL DEFAULT '',
                is_connected   TINYINT(1)   NOT NULL DEFAULT 0,
                access_token   TEXT         NULL,
                refresh_token  TEXT         NULL,
                token_expires_at DATETIME   NULL,
                updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)

        // Google Sheets sheet configuration
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS gs_sheet_config (
                id             INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
                spreadsheet_id VARCHAR(500) NOT NULL DEFAULT '',
                sheet_name     VARCHAR(255) NOT NULL DEFAULT 'Sheet1',
                updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)

        // Google Sheets automated report schedule
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS gs_schedule (
                id            INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
                schedule_type VARCHAR(50)  NOT NULL DEFAULT '',
                schedule_time VARCHAR(10)  NOT NULL DEFAULT '06:00',
                last_run_date VARCHAR(10)  NOT NULL DEFAULT '',
                updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)

        // Google Sheets send history (unique per cafe + date to prevent duplicates)
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS gs_send_history (
                id          VARCHAR(36)  NOT NULL PRIMARY KEY,
                cafe_id     VARCHAR(36)  NOT NULL,
                cafe_name   VARCHAR(255) NOT NULL,
                report_date DATE         NOT NULL,
                sent_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                status      VARCHAR(20)  NOT NULL DEFAULT 'success',
                sent_by     VARCHAR(36)  NULL,
                UNIQUE KEY uq_gs_cafe_date (cafe_id, report_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)

        // Google Sheets scheduler run logs
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS gs_scheduler_logs (
                id            INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
                report_date   VARCHAR(10)  NOT NULL,
                run_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                schedule_type VARCHAR(50)  NOT NULL DEFAULT '',
                success_count INT          NOT NULL DEFAULT 0,
                skip_count    INT          NOT NULL DEFAULT 0,
                fail_count    INT          NOT NULL DEFAULT 0,
                details       TEXT         NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)

        // Xero connection settings
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS xero_settings (
                id               INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
                client_id        VARCHAR(500) NOT NULL DEFAULT '',
                client_secret    VARCHAR(500) NOT NULL DEFAULT '',
                xero_redirect_uri VARCHAR(500) NOT NULL DEFAULT '',
                is_connected     TINYINT(1)   NOT NULL DEFAULT 0,
                access_token     TEXT         NULL,
                refresh_token    TEXT         NULL,
                tenant_id        VARCHAR(100) NULL,
                tenant_name      VARCHAR(255) NULL,
                token_expires_at DATETIME     NULL,
                updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)

        // Xero account mappings
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS xero_account_mappings (
                id                      INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
                topups_account          VARCHAR(255) NOT NULL DEFAULT '',
                shop_sales_account      VARCHAR(255) NOT NULL DEFAULT '',
                refunds_account         VARCHAR(255) NOT NULL DEFAULT '',
                center_expenses_account VARCHAR(255) NOT NULL DEFAULT '',
                bank_account            VARCHAR(255) NOT NULL DEFAULT '',
                updated_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)

        // Xero automated report schedule
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS xero_schedule (
                id            INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
                schedule_type VARCHAR(50)  NOT NULL DEFAULT '',
                schedule_time VARCHAR(10)  NOT NULL DEFAULT '06:00',
                last_run_date VARCHAR(10)  NOT NULL DEFAULT '',
                updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)

        // Xero send history (unique per cafe + date to prevent duplicates)
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS xero_send_history (
                id          VARCHAR(36)  NOT NULL PRIMARY KEY,
                cafe_id     VARCHAR(36)  NOT NULL,
                cafe_name   VARCHAR(255) NOT NULL,
                report_date DATE         NOT NULL,
                sent_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                status      VARCHAR(20)  NOT NULL DEFAULT 'success',
                sent_by     VARCHAR(36)  NULL,
                UNIQUE KEY uq_xero_cafe_date (cafe_id, report_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)

        // Xero scheduler run logs
        await conn.execute(`
            CREATE TABLE IF NOT EXISTS xero_scheduler_logs (
                id            INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
                report_date   VARCHAR(10)  NOT NULL,
                run_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                schedule_type VARCHAR(50)  NOT NULL DEFAULT '',
                success_count INT          NOT NULL DEFAULT 0,
                skip_count    INT          NOT NULL DEFAULT 0,
                fail_count    INT          NOT NULL DEFAULT 0,
                details       TEXT         NULL
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
            deposit_account: row.deposit_account || '',
        })
    } catch (e) {
        console.error('[QB] mappings get error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// POST /api/quickbooks/mappings
app.post('/api/quickbooks/mappings', requireAuth, requireAdmin, async (req, res) => {
    const { topups_account, shop_sales_account, refunds_account, center_expenses_account, deposit_account } = req.body || {}
    try {
        await ensureQBRow('qb_account_mappings')
        await pool.execute(
            'UPDATE qb_account_mappings SET topups_account=?, shop_sales_account=?, refunds_account=?, center_expenses_account=?, deposit_account=? ORDER BY id LIMIT 1',
            [topups_account || '', shop_sales_account || '', refunds_account || '', center_expenses_account || '', deposit_account || '']
        )
        await logActivity(req.user.id, 'qb_mappings_update', 'QuickBooks account mappings updated', getIp(req))
        res.json({ ok: true })
    } catch (e) {
        console.error('[QB] mappings save error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// POST /api/quickbooks/send-report
// ── Core QB report-sending logic (shared by HTTP endpoint and scheduler) ─────
// Returns { ok, message, totals?, qb_journal_id? }
async function sendQBReportForCafe(cafe_id, report_date, sent_by) {
    // Check for duplicate
    const [[existing]] = await pool.execute(
        'SELECT id FROM qb_send_history WHERE cafe_id=? AND report_date=?',
        [cafe_id, report_date]
    )
    if (existing) {
        return { ok: false, status: 409, message: 'Report for this cafe and date has already been sent' }
    }

    // Look up cafe details (name, iCafe cafe_id, api_key)
    const [[cafe]] = await pool.execute('SELECT name, cafe_id AS icafe_cafe_id, api_key FROM cafes WHERE id=?', [cafe_id])
    if (!cafe) {
        return { ok: false, status: 404, message: 'Cafe not found' }
    }
    const cafeName = cafe.name

    // Verify QuickBooks is connected
    await ensureQBRow('qb_settings')
    const [[qbSettings]] = await pool.execute('SELECT * FROM qb_settings LIMIT 1')
    if (!qbSettings.is_connected || !qbSettings.realm_id) {
        return { ok: false, status: 400, message: 'QuickBooks is not connected. Please connect first.' }
    }

    // Get valid QB access token
    const accessToken = await getValidQBToken()
    if (!accessToken) {
        return { ok: false, status: 401, message: 'QuickBooks session expired. Please reconnect.' }
    }

    // Load account mappings
    await ensureQBRow('qb_account_mappings')
    const [[mappings]] = await pool.execute('SELECT * FROM qb_account_mappings LIMIT 1')
    if (!mappings.topups_account && !mappings.shop_sales_account && !mappings.refunds_account && !mappings.center_expenses_account) {
        return { ok: false, status: 400, message: 'No account mappings configured. Please set up account mappings first.' }
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
        // shift_staff_name=all is required — without it the iCafe API returns empty results.
        const shiftListResp = await fetchIcafeApi(
            `/cafe/${cafe.icafe_cafe_id}/reports/shiftList?date_start=${report_date}&date_end=${nextDate}&time_start=00:00&time_end=23:59&shift_staff_name=all`
        )
        const rawShifts = (shiftListResp && shiftListResp.data) || []

        if (rawShifts.length === 0) {
            console.log(`[QB] shiftList API returned empty for cafe ${cafe.icafe_cafe_id}. Response:`, JSON.stringify(shiftListResp).substring(0, 500))
        }

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

        // Collect itemized expenses and refunds across all shifts
        const allExpenseItems = []   // { log_money, log_details, staff_name }
        const allRefundItems = []    // { log_money, log_details, log_member_account }

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
            const staffName = d.staff_name || String(shift.shift_staff_name || '')

            totalTopUps += topUps
            totalShopSales += shopSales
            totalRefunds += refunds
            totalExpenses += expenses

            console.log(`[QB] Shift ${shiftId}: topUps=${topUps.toFixed(2)}, shopSales=${shopSales.toFixed(2)}, refunds=${refunds.toFixed(2)}, expenses=${expenses.toFixed(2)}`)

            // Fetch itemized expense details from reportData API
            if (expenses !== 0 && staffName) {
                const shiftStart = (d.start_time || '').split(' ')[0]
                const shiftEnd = (d.end_time || '').split(' ')[0]
                if (shiftStart) {
                    let dateEnd = shiftEnd || shiftStart
                    if (dateEnd === shiftStart) {
                        const parts = shiftStart.split('-').map(Number)
                        const nd = new Date(parts[0], parts[1] - 1, parts[2])
                        nd.setDate(nd.getDate() + 1)
                        dateEnd = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-${String(nd.getDate()).padStart(2, '0')}`
                    }
                    const reportData = await fetchIcafeApi(
                        `/cafe/${cafe.icafe_cafe_id}/reports/reportData?date_start=${shiftStart}&date_end=${dateEnd}&time_start=06:00&time_end=05:59&log_staff_name=${encodeURIComponent(staffName)}`
                    )
                    const expItems = reportData?.data?.income?.expense?.items
                    if (Array.isArray(expItems) && expItems.length > 0) {
                        for (const item of expItems) {
                            allExpenseItems.push({
                                log_money: String(item.log_money || '0'),
                                log_details: String(item.log_details || ''),
                                staff_name: staffName,
                            })
                        }
                        console.log(`[QB] Shift ${shiftId}: found ${expItems.length} expense item(s)`)
                    }
                }
            }
        }

        // Fetch itemized refund details from billingLogs API (with pagination)
        if (totalRefunds !== 0) {
            let blDateEnd = nextDate
            let blPage = 1
            let blTotalPages = 1

            do {
                const blUrl = `/cafe/${cafe.icafe_cafe_id}/billingLogs?date_start=${report_date}&date_end=${blDateEnd}&time_start=06:00&time_end=05:59&event=TOPUP&page=${blPage}`
                const blResp = await fetchIcafeApi(blUrl)

                // Parse the response structure (matches frontend's apiGetBillingLogs logic)
                const blData = blResp?.data
                let entries = []
                let paging = null

                if (Array.isArray(blData)) {
                    // response: { code, message, data: [ ...entries ] }
                    entries = blData
                    paging = blResp?.paging_info || null
                } else if (blData && typeof blData === 'object') {
                    // response: { code, message, data: { items: [...], paging_info: {...} } }
                    if (Array.isArray(blData.items)) {
                        entries = blData.items
                    } else {
                        // Try to find any array-valued key
                        const arrVal = Object.values(blData).find(Array.isArray)
                        entries = arrVal || []
                    }
                    paging = blData.paging_info || null
                }

                if (blPage === 1) {
                    console.log(`[QB] billingLogs page ${blPage}: resp keys:`,
                        blResp ? Object.keys(blResp) : 'null',
                        '| data type:', Array.isArray(blData) ? 'array' : typeof blData,
                        '| entries:', entries.length,
                        '| paging:', paging ? JSON.stringify(paging) : 'none')
                }

                if (entries.length === 0) break

                for (const entry of entries) {
                    const money = parseFloat(String(entry.log_money ?? entry.money ?? 0)) || 0
                    if (money < 0) {
                        allRefundItems.push({
                            log_money: String(entry.log_money ?? entry.money ?? money),
                            log_details: String(entry.log_details ?? entry.log_detail ?? entry.details ?? ''),
                            log_member_account: entry.log_member_account ? String(entry.log_member_account) : '',
                        })
                    }
                }

                if (!paging) break
                blTotalPages = Number(paging.pages ?? paging.total_pages ?? 1) || 1
                blPage++
            } while (blPage <= blTotalPages)

            if (allRefundItems.length > 0) {
                console.log(`[QB] Found ${allRefundItems.length} refund item(s) from billing logs (${blPage} page(s))`)
            } else {
                console.log(`[QB] No refund items found in billing logs despite totalRefunds=${totalRefunds.toFixed(2)}`)
            }
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

        // Refund lines — itemized breakdowns when available, aggregated fallback
        if (totalRefunds !== 0 && mappings.refunds_account) {
            if (allRefundItems.length > 0) {
                for (const item of allRefundItems) {
                    const amount = Math.round(Math.abs(parseFloat(item.log_money) || 0) * 100) / 100
                    if (amount === 0) continue
                    const desc = item.log_details
                        ? `Refund: ${item.log_details}${item.log_member_account ? ' (' + item.log_member_account + ')' : ''} - ${cafeName} - ${report_date}`
                        : `Refund${item.log_member_account ? ' (' + item.log_member_account + ')' : ''} - ${cafeName} - ${report_date}`
                    lines.push({
                        Description: desc,
                        Amount: amount,
                        DetailType: 'JournalEntryLineDetail',
                        JournalEntryLineDetail: {
                            PostingType: 'Debit',
                            AccountRef: { value: mappings.refunds_account },
                        },
                    })
                }
            } else {
                // Fallback: single aggregated line
                lines.push({
                    Description: `Refunds - ${cafeName} - ${report_date}`,
                    Amount: Math.round(Math.abs(totalRefunds) * 100) / 100,
                    DetailType: 'JournalEntryLineDetail',
                    JournalEntryLineDetail: {
                        PostingType: 'Debit',
                        AccountRef: { value: mappings.refunds_account },
                    },
                })
            }
        }

        // Expense lines — itemized breakdowns when available, aggregated fallback
        if (totalExpenses !== 0 && mappings.center_expenses_account) {
            if (allExpenseItems.length > 0) {
                for (const item of allExpenseItems) {
                    const amount = Math.round(Math.abs(parseFloat(item.log_money) || 0) * 100) / 100
                    if (amount === 0) continue
                    const desc = item.log_details
                        ? `Expense: ${item.log_details} (${item.staff_name}) - ${cafeName} - ${report_date}`
                        : `Expense (${item.staff_name}) - ${cafeName} - ${report_date}`
                    lines.push({
                        Description: desc,
                        Amount: amount,
                        DetailType: 'JournalEntryLineDetail',
                        JournalEntryLineDetail: {
                            PostingType: 'Debit',
                            AccountRef: { value: mappings.center_expenses_account },
                        },
                    })
                }
            } else {
                // Fallback: single aggregated line
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
        }

        if (lines.length === 0) {
            return { ok: false, status: 400, message: `No reportable amounts found for ${cafeName} on ${report_date}. All totals are zero or no account mappings configured.` }
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

        if (!mappings.deposit_account) {
            return { ok: false, status: 400, message: 'No Deposit To (Cash/Bank) account configured. Please set up the deposit account in Account Mappings first.' }
        }

        if (netOffset > 0) {
            // More credits than debits → add a Debit line to Cash/Bank account
            lines.push({
                Description: `Cash/Bank Deposit - ${cafeName} - ${report_date}`,
                Amount: netOffset,
                DetailType: 'JournalEntryLineDetail',
                JournalEntryLineDetail: {
                    PostingType: 'Debit',
                    AccountRef: { value: mappings.deposit_account },
                },
            })
        } else if (netOffset < 0) {
            // More debits than credits → add a Credit line to Cash/Bank account
            lines.push({
                Description: `Cash/Bank - ${cafeName} - ${report_date}`,
                Amount: Math.abs(netOffset),
                DetailType: 'JournalEntryLineDetail',
                JournalEntryLineDetail: {
                    PostingType: 'Credit',
                    AccountRef: { value: mappings.deposit_account },
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
                [historyId, cafe_id, cafeName, report_date, 'success', sent_by]
            )
            await logActivity(sent_by, 'qb_report_sent', `Report sent for ${cafeName} on ${report_date} (Top-ups: ${totalTopUps.toFixed(2)}, Shop Sales: ${totalShopSales.toFixed(2)}, Refunds: ${totalRefunds.toFixed(2)}, Expenses: ${totalExpenses.toFixed(2)})`)

            let qbResponse = {}
            try { qbResponse = JSON.parse(qbResult.body) } catch {}
            return { ok: true, id: historyId, qb_journal_id: qbResponse.JournalEntry ? qbResponse.JournalEntry.Id : null, totals: { top_ups: totalTopUps, shop_sales: totalShopSales, refunds: totalRefunds, center_expenses: totalExpenses } }
        } else {
            // Failed — log to history with failed status
            console.error('[QB] JournalEntry creation failed:', qbResult.statusCode, qbResult.body)
            await pool.execute(
                'INSERT INTO qb_send_history (id, cafe_id, cafe_name, report_date, status, sent_by) VALUES (?,?,?,?,?,?)',
                [historyId, cafe_id, cafeName, report_date, 'failed', sent_by]
            )
            await logActivity(sent_by, 'qb_report_failed', `Report failed for ${cafeName} on ${report_date}: QB status ${qbResult.statusCode}`)

            let errorMsg = 'Failed to create journal entry in QuickBooks'
            try {
                const errBody = JSON.parse(qbResult.body)
                if (errBody.Fault && errBody.Fault.Error) {
                    errorMsg = errBody.Fault.Error.map(e => e.Message || e.Detail).join('; ')
                }
            } catch {}
            return { ok: false, status: 502, message: errorMsg }
        }
}

// ── HTTP endpoint wrapping the core function ─────────────────────────────────
app.post('/api/quickbooks/send-report', requireAuth, requireAdmin, async (req, res) => {
    const { cafe_id, report_date } = req.body || {}
    if (!cafe_id || !report_date) {
        return res.status(400).json({ message: 'cafe_id and report_date required' })
    }
    try {
        const result = await sendQBReportForCafe(cafe_id, report_date, req.user.id)
        if (result.ok) {
            res.json(result)
        } else {
            res.status(result.status || 500).json({ message: result.message })
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
            last_run_date: row.last_run_date || '',
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
            'SELECT id, cafe_id, cafe_name, DATE_FORMAT(report_date, "%Y-%m-%d") AS report_date, sent_at, status, sent_by FROM qb_send_history ORDER BY sent_at DESC LIMIT 100'
        )
        res.json(rows)
    } catch (e) {
        console.error('[QB] history error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// GET /api/quickbooks/scheduler-logs
app.get('/api/quickbooks/scheduler-logs', requireAuth, requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT id, report_date, run_at, schedule_type, success_count, skip_count, fail_count, details FROM qb_scheduler_logs ORDER BY run_at DESC LIMIT 20'
        )
        res.json(rows)
    } catch (e) {
        console.error('[QB] scheduler-logs error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// ── QuickBooks Automated Report Scheduler ────────────────────────────────────
// Runs every 60 seconds. Checks qb_schedule table for a configured schedule,
// then sends reports for all cafes for yesterday's business day.
// Uses Asia/Manila timezone for time comparisons (Philippines).

function getManilaTime() {
    const now = new Date()
    // Get current time parts in Asia/Manila timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    })
    const parts = {}
    for (const { type, value } of formatter.formatToParts(now)) {
        parts[type] = value
    }
    const currentTime = `${parts.hour}:${parts.minute}`
    // Yesterday in Manila timezone
    const manilaMs = now.getTime() + (now.getTimezoneOffset() * 60000) + (8 * 3600000) // UTC+8
    const yesterdayManila = new Date(manilaMs - 86400000)
    const reportDate = `${yesterdayManila.getFullYear()}-${String(yesterdayManila.getMonth() + 1).padStart(2, '0')}-${String(yesterdayManila.getDate()).padStart(2, '0')}`
    return { currentTime, reportDate }
}

async function runScheduledQBReports() {
    try {
        await ensureQBRow('qb_schedule')
        const [[schedule]] = await pool.execute('SELECT * FROM qb_schedule LIMIT 1')
        if (!schedule || !schedule.schedule_type) return // No schedule configured

        const { currentTime, reportDate } = getManilaTime()

        // Already ran for this date?
        if (schedule.last_run_date === reportDate) return

        // Determine if it's time to run.
        // Use >= comparison so we don't miss the window if setInterval
        // doesn't tick at the exact minute. Once run, last_run_date
        // prevents re-runs for the same reportDate.
        let shouldRun = false
        const schedType = schedule.schedule_type
        const schedTime = schedule.schedule_time || '06:00'

        if (schedType === 'daily_at_time') {
            shouldRun = (currentTime >= schedTime)
        } else if (schedType === 'after_business_day') {
            shouldRun = (currentTime >= '06:00')
        } else if (schedType === 'after_last_shift') {
            shouldRun = (currentTime >= '06:00')
        }

        if (!shouldRun) return

        console.log(`[QB-Scheduler] Running automated reports for ${reportDate} (schedule: ${schedType}, time: ${schedTime}, Manila time: ${currentTime})`)

        // Get all cafes
        const [cafes] = await pool.execute('SELECT id, name FROM cafes ORDER BY sort_order ASC')
        if (!cafes || cafes.length === 0) {
            console.log('[QB-Scheduler] No cafes configured')
            return
        }

        let successCount = 0
        let skipCount = 0
        let failCount = 0
        const details = []

        for (const cafe of cafes) {
            try {
                const result = await sendQBReportForCafe(cafe.id, reportDate, 'scheduler')
                if (result.ok) {
                    successCount++
                    details.push(`✓ ${cafe.name}: sent`)
                    console.log(`[QB-Scheduler] ✓ ${cafe.name}: sent successfully`)
                } else if (result.status === 409) {
                    skipCount++
                    details.push(`⊘ ${cafe.name}: already sent`)
                    console.log(`[QB-Scheduler] ⊘ ${cafe.name}: already sent, skipping`)
                } else {
                    failCount++
                    details.push(`✗ ${cafe.name}: ${result.message}`)
                    console.log(`[QB-Scheduler] ✗ ${cafe.name}: ${result.message}`)
                }
            } catch (err) {
                failCount++
                details.push(`✗ ${cafe.name}: ${err.message}`)
                console.error(`[QB-Scheduler] ✗ ${cafe.name}: error —`, err.message)
            }
        }

        // Mark as run for today so we don't run again
        await pool.execute(
            'UPDATE qb_schedule SET last_run_date=? ORDER BY id LIMIT 1',
            [reportDate]
        )

        // Log the run to the scheduler_logs table (visible in the UI)
        await pool.execute(
            'INSERT INTO qb_scheduler_logs (report_date, schedule_type, success_count, skip_count, fail_count, details) VALUES (?,?,?,?,?,?)',
            [reportDate, schedType, successCount, skipCount, failCount, details.join('\n')]
        )

        console.log(`[QB-Scheduler] Completed: ${successCount} sent, ${skipCount} skipped, ${failCount} failed`)
    } catch (err) {
        console.error('[QB-Scheduler] Error:', err.message)
    }
}

// Run the scheduler check every 60 seconds
setInterval(runScheduledQBReports, 60 * 1000)
// Also run once on startup (after a short delay for DB to be ready)
setTimeout(runScheduledQBReports, 5000)
console.log('[QB-Scheduler] Initialized — checking every 60s (Asia/Manila timezone)')

// ── Google Sheets API ────────────────────────────────────────────────────────

// Google OAuth2 endpoints
const GS_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GS_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GS_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const GS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const GS_SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

// Helper: ensure single-row config tables have a row
async function ensureGSRow(table) {
    const [[row]] = await pool.execute(`SELECT id FROM ${table} LIMIT 1`)
    if (!row) {
        await pool.execute(`INSERT INTO ${table} () VALUES ()`)
    }
}

// Helper: make an HTTPS POST to exchange/refresh tokens
function gsHttpsRequest(url, options = {}) {
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
            res.on('end', () => { resolve({ statusCode: res.statusCode, body }) })
        })
        req.on('error', reject)
        if (options.body) req.write(options.body)
        req.end()
    })
}

// Helper: refresh the Google access token using the refresh token
async function refreshGSToken(settings) {
    const postData = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: settings.refresh_token,
        client_id: settings.client_id,
        client_secret: settings.client_secret,
    }).toString()
    const result = await gsHttpsRequest(GS_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: postData,
    })
    if (result.statusCode !== 200) {
        console.error('[GS] Token refresh failed:', result.body)
        return null
    }
    const tokenData = JSON.parse(result.body)
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)
    await pool.execute(
        'UPDATE gs_settings SET access_token=?, token_expires_at=? ORDER BY id LIMIT 1',
        [tokenData.access_token, expiresAt]
    )
    return tokenData.access_token
}

// Helper: get a valid Google access token (refreshes if expired)
async function getValidGSToken() {
    await ensureGSRow('gs_settings')
    const [[settings]] = await pool.execute('SELECT * FROM gs_settings LIMIT 1')
    if (!settings || !settings.is_connected || !settings.access_token) return null

    const now = new Date()
    const expiresAt = settings.token_expires_at ? new Date(settings.token_expires_at) : null
    if (!expiresAt || now >= new Date(expiresAt.getTime() - 5 * 60 * 1000)) {
        if (!settings.refresh_token) return null
        return await refreshGSToken(settings)
    }
    return settings.access_token
}

// GET /api/googlesheets/settings
app.get('/api/googlesheets/settings', requireAuth, requireAdmin, async (req, res) => {
    try {
        await ensureGSRow('gs_settings')
        const [[row]] = await pool.execute('SELECT * FROM gs_settings LIMIT 1')
        res.json({
            client_id: row.client_id,
            client_secret: row.client_secret,
            redirect_uri: row.redirect_uri,
            is_connected: !!row.is_connected,
        })
    } catch (e) {
        console.error('[GS] settings get error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// POST /api/googlesheets/settings
app.post('/api/googlesheets/settings', requireAuth, requireAdmin, async (req, res) => {
    const { client_id, client_secret, redirect_uri } = req.body || {}
    try {
        await ensureGSRow('gs_settings')
        await pool.execute(
            'UPDATE gs_settings SET client_id=?, client_secret=?, redirect_uri=? ORDER BY id LIMIT 1',
            [client_id || '', client_secret || '', redirect_uri || '']
        )
        await logActivity(req.user.id, 'gs_settings_update', 'Google Sheets settings updated', getIp(req))
        res.json({ ok: true })
    } catch (e) {
        console.error('[GS] settings save error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// GET /api/googlesheets/auth-url — generate the Google OAuth2 authorization URL
app.get('/api/googlesheets/auth-url', requireAuth, requireAdmin, async (req, res) => {
    try {
        await ensureGSRow('gs_settings')
        const [[settings]] = await pool.execute('SELECT * FROM gs_settings LIMIT 1')
        if (!settings.redirect_uri) {
            return res.status(400).json({ message: 'Please save your Redirect URI first.' })
        }
        if (!settings.client_id || !settings.client_secret) {
            return res.status(400).json({ message: 'Please save your Client ID and Client Secret first.' })
        }
        const params = new URLSearchParams({
            client_id: settings.client_id,
            redirect_uri: settings.redirect_uri,
            response_type: 'code',
            scope: GS_SCOPE,
            access_type: 'offline',
            prompt: 'consent',
        })
        const auth_url = `${GS_AUTH_URL}?${params.toString()}`
        res.json({ auth_url })
    } catch (e) {
        console.error('[GS] auth-url error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// GET /api/googlesheets/callback — handle the OAuth2 callback from Google
app.get('/api/googlesheets/callback', async (req, res) => {
    const { code, error } = req.query
    if (error) {
        console.error('[GS] OAuth error:', error)
        return res.redirect('/googlesheets?gs_error=' + encodeURIComponent(error))
    }
    if (!code) {
        return res.redirect('/googlesheets?gs_error=missing_code')
    }
    try {
        await ensureGSRow('gs_settings')
        const [[settings]] = await pool.execute('SELECT * FROM gs_settings LIMIT 1')
        if (!settings.redirect_uri || !settings.client_id || !settings.client_secret) {
            return res.redirect('/googlesheets?gs_error=missing_credentials')
        }

        // Exchange authorization code for tokens
        const postData = new URLSearchParams({
            grant_type: 'authorization_code',
            code: String(code),
            redirect_uri: settings.redirect_uri,
            client_id: settings.client_id,
            client_secret: settings.client_secret,
        }).toString()

        const result = await gsHttpsRequest(GS_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: postData,
        })

        if (result.statusCode !== 200) {
            console.error('[GS] Token exchange failed:', result.body)
            return res.redirect('/googlesheets?gs_error=token_exchange_failed')
        }

        const tokenData = JSON.parse(result.body)
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

        await pool.execute(
            'UPDATE gs_settings SET access_token=?, refresh_token=?, token_expires_at=?, is_connected=1 ORDER BY id LIMIT 1',
            [tokenData.access_token, tokenData.refresh_token || null, expiresAt]
        )

        return res.redirect('/googlesheets?gs_connected=true')
    } catch (e) {
        console.error('[GS] callback error:', e.message)
        return res.redirect('/googlesheets?gs_error=server_error')
    }
})

// POST /api/googlesheets/disconnect — revoke tokens and clear connection
app.post('/api/googlesheets/disconnect', requireAuth, requireAdmin, async (req, res) => {
    try {
        await ensureGSRow('gs_settings')
        const [[settings]] = await pool.execute('SELECT * FROM gs_settings LIMIT 1')

        // Revoke the access token at Google
        if (settings.access_token) {
            try {
                await gsHttpsRequest(`${GS_REVOKE_URL}?token=${encodeURIComponent(settings.access_token)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                })
            } catch (revokeErr) {
                console.warn('[GS] Token revoke error (continuing):', revokeErr.message)
            }
        }

        await pool.execute(
            'UPDATE gs_settings SET is_connected=0, access_token=NULL, refresh_token=NULL, token_expires_at=NULL ORDER BY id LIMIT 1'
        )
        await logActivity(req.user.id, 'gs_disconnect', 'Google Sheets disconnected', getIp(req))
        res.json({ ok: true })
    } catch (e) {
        console.error('[GS] disconnect error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// GET /api/googlesheets/sheet-config
app.get('/api/googlesheets/sheet-config', requireAuth, requireAdmin, async (req, res) => {
    try {
        await ensureGSRow('gs_sheet_config')
        const [[row]] = await pool.execute('SELECT * FROM gs_sheet_config LIMIT 1')
        res.json({
            spreadsheet_id: row.spreadsheet_id,
            sheet_name: row.sheet_name,
        })
    } catch (e) {
        console.error('[GS] sheet-config get error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// POST /api/googlesheets/sheet-config
app.post('/api/googlesheets/sheet-config', requireAuth, requireAdmin, async (req, res) => {
    const { spreadsheet_id, sheet_name } = req.body || {}
    try {
        await ensureGSRow('gs_sheet_config')
        await pool.execute(
            'UPDATE gs_sheet_config SET spreadsheet_id=?, sheet_name=? ORDER BY id LIMIT 1',
            [spreadsheet_id || '', sheet_name || 'Sheet1']
        )
        await logActivity(req.user.id, 'gs_sheet_config_update', 'Google Sheets sheet config updated', getIp(req))
        res.json({ ok: true })
    } catch (e) {
        console.error('[GS] sheet-config save error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// GET /api/googlesheets/schedule
app.get('/api/googlesheets/schedule', requireAuth, requireAdmin, async (req, res) => {
    try {
        await ensureGSRow('gs_schedule')
        const [[row]] = await pool.execute('SELECT * FROM gs_schedule LIMIT 1')
        res.json({
            schedule_type: row.schedule_type,
            schedule_time: row.schedule_time,
            last_run_date: row.last_run_date || '',
        })
    } catch (e) {
        console.error('[GS] schedule get error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// POST /api/googlesheets/schedule
app.post('/api/googlesheets/schedule', requireAuth, requireAdmin, async (req, res) => {
    const { schedule_type, schedule_time } = req.body || {}
    try {
        await ensureGSRow('gs_schedule')
        await pool.execute(
            'UPDATE gs_schedule SET schedule_type=?, schedule_time=? ORDER BY id LIMIT 1',
            [schedule_type || '', schedule_time || '06:00']
        )
        await logActivity(req.user.id, 'gs_schedule_update', `Google Sheets schedule set to ${schedule_type}`, getIp(req))
        res.json({ ok: true })
    } catch (e) {
        console.error('[GS] schedule save error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// GET /api/googlesheets/history
app.get('/api/googlesheets/history', requireAuth, requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT id, cafe_id, cafe_name, DATE_FORMAT(report_date, "%Y-%m-%d") AS report_date, sent_at, status, sent_by FROM gs_send_history ORDER BY sent_at DESC LIMIT 100'
        )
        res.json(rows)
    } catch (e) {
        console.error('[GS] history error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// GET /api/googlesheets/scheduler-logs
app.get('/api/googlesheets/scheduler-logs', requireAuth, requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT id, report_date, run_at, schedule_type, success_count, skip_count, fail_count, details FROM gs_scheduler_logs ORDER BY run_at DESC LIMIT 20'
        )
        res.json(rows)
    } catch (e) {
        console.error('[GS] scheduler-logs error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// ── Core GS report-sending logic (shared by HTTP endpoint and scheduler) ─────
// Returns { ok, message, totals? }
async function sendGSReportForCafe(cafe_id, report_date, sent_by) {
    // Check for duplicate
    const [[existing]] = await pool.execute(
        'SELECT id FROM gs_send_history WHERE cafe_id=? AND report_date=?',
        [cafe_id, report_date]
    )
    if (existing) {
        return { ok: false, status: 409, message: 'Report for this cafe and date has already been sent' }
    }

    // Look up cafe details
    const [[cafe]] = await pool.execute('SELECT name, cafe_id AS icafe_cafe_id, api_key FROM cafes WHERE id=?', [cafe_id])
    if (!cafe) {
        return { ok: false, status: 404, message: 'Cafe not found' }
    }
    const cafeName = cafe.name

    // Verify Google Sheets is connected
    await ensureGSRow('gs_settings')
    const [[gsSettings]] = await pool.execute('SELECT * FROM gs_settings LIMIT 1')
    if (!gsSettings.is_connected) {
        return { ok: false, status: 400, message: 'Google Sheets is not connected. Please connect first.' }
    }

    // Get valid access token
    const accessToken = await getValidGSToken()
    if (!accessToken) {
        return { ok: false, status: 401, message: 'Google Sheets session expired. Please reconnect.' }
    }

    // Load sheet config
    await ensureGSRow('gs_sheet_config')
    const [[sheetConfig]] = await pool.execute('SELECT * FROM gs_sheet_config LIMIT 1')
    if (!sheetConfig.spreadsheet_id) {
        return { ok: false, status: 400, message: 'No spreadsheet configured. Please set up Sheet Configuration first.' }
    }

    // Fetch daily totals from iCafe API (same logic as QuickBooks)
    const dateParts = report_date.split('-').map(Number)
    const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2])
    dateObj.setDate(dateObj.getDate() + 1)
    const nextDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`

    const authHeader = `Bearer ${cafe.api_key}`

    async function fetchIcafeApi(urlPath) {
        const url = 'https://api.icafecloud.com/api/v2' + urlPath
        try {
            const result = await fetchUpstream(url, { authorization: authHeader })
            if (result.statusCode !== 200) return null
            const bodyStr = typeof result.body === 'string' ? result.body : result.body.toString('utf8')
            return JSON.parse(bodyStr)
        } catch (err) {
            console.error(`[GS] iCafe API fetch error:`, err.message)
            return null
        }
    }

    const shiftListResp = await fetchIcafeApi(
        `/cafe/${cafe.icafe_cafe_id}/reports/shiftList?date_start=${report_date}&date_end=${nextDate}&time_start=00:00&time_end=23:59&shift_staff_name=all`
    )
    const rawShifts = (shiftListResp && shiftListResp.data) || []

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

    let totalTopUps = 0
    let totalShopSales = 0
    let totalRefunds = 0
    let totalExpenses = 0

    for (const shift of allShifts) {
        const shiftId = shift.shift_id || shift.id
        if (!shiftId) continue
        const detail = await fetchIcafeApi(
            `/cafe/${cafe.icafe_cafe_id}/reports/shiftDetail/${shiftId}`
        )
        if (!detail || !detail.data) continue
        const d = detail.data

        const cash = Number(d.cash) || 0
        const shopSalesArr = Array.isArray(d.shop_sales) ? d.shop_sales : []
        const shopSales = shopSalesArr.reduce((sum, item) => sum + (parseFloat(String(item.cash || 0)) || 0), 0)
        const digitalTopups = (Number(d.qr_topup) || 0) + (Number(d.credit_card) || 0)
        const topUps = (cash - shopSales) + digitalTopups

        totalTopUps += topUps
        totalShopSales += shopSales
        totalRefunds += Number(d.cash_refund) || 0
        totalExpenses += Number(d.center_expenses) || 0
    }

    console.log(`[GS] Totals for ${cafeName} on ${report_date}: topUps=${totalTopUps.toFixed(2)}, shopSales=${totalShopSales.toFixed(2)}, refunds=${totalRefunds.toFixed(2)}, expenses=${totalExpenses.toFixed(2)}`)

    // ── Append row to Google Sheet ────────────────────────────────────────────
    // Row format: Date | Cafe | Top-ups | Shop Sales | Refunds | Center Expenses
    const range = encodeURIComponent(`${sheetConfig.sheet_name || 'Sheet1'}`)
    const appendUrl = `${GS_SHEETS_API_BASE}/${sheetConfig.spreadsheet_id}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`

    const rowValues = [
        [
            report_date,
            cafeName,
            Math.round(totalTopUps * 100) / 100,
            Math.round(totalShopSales * 100) / 100,
            Math.round(Math.abs(totalRefunds) * 100) / 100,
            Math.round(totalExpenses * 100) / 100,
        ]
    ]

    const gsResult = await gsHttpsRequest(appendUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ values: rowValues }),
    })

    const historyId = randomUUID()

    if (gsResult.statusCode === 200 || gsResult.statusCode === 201) {
        await pool.execute(
            'INSERT INTO gs_send_history (id, cafe_id, cafe_name, report_date, status, sent_by) VALUES (?,?,?,?,?,?)',
            [historyId, cafe_id, cafeName, report_date, 'success', sent_by]
        )
        await logActivity(sent_by, 'gs_report_sent', `Google Sheets report sent for ${cafeName} on ${report_date}`)
        return { ok: true, id: historyId, totals: { top_ups: totalTopUps, shop_sales: totalShopSales, refunds: totalRefunds, center_expenses: totalExpenses } }
    } else {
        console.error('[GS] Append failed:', gsResult.statusCode, gsResult.body)
        await pool.execute(
            'INSERT INTO gs_send_history (id, cafe_id, cafe_name, report_date, status, sent_by) VALUES (?,?,?,?,?,?)',
            [historyId, cafe_id, cafeName, report_date, 'failed', sent_by]
        )
        await logActivity(sent_by, 'gs_report_failed', `Google Sheets report failed for ${cafeName} on ${report_date}: status ${gsResult.statusCode}`)

        let errorMsg = 'Failed to append row to Google Sheets'
        try {
            const errBody = JSON.parse(gsResult.body)
            if (errBody.error && errBody.error.message) {
                errorMsg = errBody.error.message
            }
        } catch {}
        return { ok: false, status: 502, message: errorMsg }
    }
}

// POST /api/googlesheets/send-report
app.post('/api/googlesheets/send-report', requireAuth, requireAdmin, async (req, res) => {
    const { cafe_id, report_date } = req.body || {}
    if (!cafe_id || !report_date) {
        return res.status(400).json({ message: 'cafe_id and report_date required' })
    }
    try {
        const result = await sendGSReportForCafe(cafe_id, report_date, req.user.id)
        if (result.ok) {
            res.json(result)
        } else {
            res.status(result.status || 500).json({ message: result.message })
        }
    } catch (e) {
        console.error('[GS] send-report error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// ── Google Sheets Automated Report Scheduler ─────────────────────────────────
// Uses the same Asia/Manila timezone logic as the QuickBooks scheduler.

async function runScheduledGSReports() {
    try {
        await ensureGSRow('gs_schedule')
        const [[schedule]] = await pool.execute('SELECT * FROM gs_schedule LIMIT 1')
        if (!schedule || !schedule.schedule_type) return

        const { currentTime, reportDate } = getManilaTime()

        if (schedule.last_run_date === reportDate) return

        let shouldRun = false
        const schedType = schedule.schedule_type
        const schedTime = schedule.schedule_time || '06:00'

        if (schedType === 'daily_at_time') {
            shouldRun = (currentTime >= schedTime)
        } else if (schedType === 'after_business_day') {
            shouldRun = (currentTime >= '06:00')
        } else if (schedType === 'after_last_shift') {
            shouldRun = (currentTime >= '06:00')
        }

        if (!shouldRun) return

        console.log(`[GS-Scheduler] Running automated reports for ${reportDate} (schedule: ${schedType}, time: ${schedTime}, Manila time: ${currentTime})`)

        const [cafes] = await pool.execute('SELECT id, name FROM cafes ORDER BY sort_order ASC')
        if (!cafes || cafes.length === 0) {
            console.log('[GS-Scheduler] No cafes configured')
            return
        }

        let successCount = 0
        let skipCount = 0
        let failCount = 0
        const details = []

        for (const cafe of cafes) {
            try {
                const result = await sendGSReportForCafe(cafe.id, reportDate, 'scheduler')
                if (result.ok) {
                    successCount++
                    details.push(`✓ ${cafe.name}: sent`)
                    console.log(`[GS-Scheduler] ✓ ${cafe.name}: sent successfully`)
                } else if (result.status === 409) {
                    skipCount++
                    details.push(`⊘ ${cafe.name}: already sent`)
                    console.log(`[GS-Scheduler] ⊘ ${cafe.name}: already sent, skipping`)
                } else {
                    failCount++
                    details.push(`✗ ${cafe.name}: ${result.message}`)
                    console.log(`[GS-Scheduler] ✗ ${cafe.name}: ${result.message}`)
                }
            } catch (err) {
                failCount++
                details.push(`✗ ${cafe.name}: ${err.message}`)
                console.error(`[GS-Scheduler] ✗ ${cafe.name}: error —`, err.message)
            }
        }

        await pool.execute(
            'UPDATE gs_schedule SET last_run_date=? ORDER BY id LIMIT 1',
            [reportDate]
        )

        await pool.execute(
            'INSERT INTO gs_scheduler_logs (report_date, schedule_type, success_count, skip_count, fail_count, details) VALUES (?,?,?,?,?,?)',
            [reportDate, schedType, successCount, skipCount, failCount, details.join('\n')]
        )

        console.log(`[GS-Scheduler] Completed: ${successCount} sent, ${skipCount} skipped, ${failCount} failed`)
    } catch (err) {
        console.error('[GS-Scheduler] Error:', err.message)
    }
}

// Run the Google Sheets scheduler check every 60 seconds
setInterval(runScheduledGSReports, 60 * 1000)
setTimeout(runScheduledGSReports, 6000)
console.log('[GS-Scheduler] Initialized — checking every 60s (Asia/Manila timezone)')

// ── Xero API ─────────────────────────────────────────────────────────────────

// Xero OAuth2 endpoints
const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize'
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token'
const XERO_REVOKE_URL = 'https://identity.xero.com/connect/revocation'
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections'
const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0'
const XERO_SCOPE = 'accounting.transactions accounting.settings offline_access'

// Helper: ensure single-row config tables have a row
async function ensureXeroRow(table) {
    const [[row]] = await pool.execute(`SELECT id FROM ${table} LIMIT 1`)
    if (!row) {
        await pool.execute(`INSERT INTO ${table} () VALUES ()`)
    }
}

// Helper: make an HTTPS request and return { statusCode, body }
function xeroHttpsRequest(url, options = {}) {
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
            res.on('end', () => { resolve({ statusCode: res.statusCode, body }) })
        })
        req.on('error', reject)
        if (options.body) req.write(options.body)
        req.end()
    })
}

// Helper: refresh the Xero access token using the refresh token
async function refreshXeroToken(settings) {
    const basicAuth = Buffer.from(`${settings.client_id}:${settings.client_secret}`).toString('base64')
    const postData = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: settings.refresh_token,
    }).toString()
    const result = await xeroHttpsRequest(XERO_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${basicAuth}`,
        },
        body: postData,
    })
    if (result.statusCode !== 200) {
        console.error('[Xero] Token refresh failed:', result.body)
        return null
    }
    const tokenData = JSON.parse(result.body)
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)
    await pool.execute(
        'UPDATE xero_settings SET access_token=?, refresh_token=?, token_expires_at=? ORDER BY id LIMIT 1',
        [tokenData.access_token, tokenData.refresh_token || settings.refresh_token, expiresAt]
    )
    return tokenData.access_token
}

// Helper: get a valid Xero access token (refreshes if expired)
async function getValidXeroToken() {
    await ensureXeroRow('xero_settings')
    const [[settings]] = await pool.execute('SELECT * FROM xero_settings LIMIT 1')
    if (!settings || !settings.is_connected || !settings.access_token) return null

    const now = new Date()
    const expiresAt = settings.token_expires_at ? new Date(settings.token_expires_at) : null
    if (!expiresAt || now >= new Date(expiresAt.getTime() - 5 * 60 * 1000)) {
        if (!settings.refresh_token) return null
        return await refreshXeroToken(settings)
    }
    return settings.access_token
}

// GET /api/xero/settings
app.get('/api/xero/settings', requireAuth, requireAdmin, async (req, res) => {
    try {
        await ensureXeroRow('xero_settings')
        const [[row]] = await pool.execute('SELECT * FROM xero_settings LIMIT 1')
        res.json({
            client_id: row.client_id,
            client_secret: row.client_secret,
            xero_redirect_uri: row.xero_redirect_uri,
            is_connected: !!row.is_connected,
            tenant_id: row.tenant_id || '',
            tenant_name: row.tenant_name || '',
        })
    } catch (e) {
        console.error('[Xero] settings get error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// POST /api/xero/settings
app.post('/api/xero/settings', requireAuth, requireAdmin, async (req, res) => {
    const { client_id, client_secret, xero_redirect_uri } = req.body || {}
    try {
        await ensureXeroRow('xero_settings')
        await pool.execute(
            'UPDATE xero_settings SET client_id=?, client_secret=?, xero_redirect_uri=? ORDER BY id LIMIT 1',
            [client_id || '', client_secret || '', xero_redirect_uri || '']
        )
        await logActivity(req.user.id, 'xero_settings_update', 'Xero settings updated', getIp(req))
        res.json({ ok: true })
    } catch (e) {
        console.error('[Xero] settings save error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// GET /api/xero/auth-url — generate the Xero OAuth2 authorization URL
app.get('/api/xero/auth-url', requireAuth, requireAdmin, async (req, res) => {
    try {
        await ensureXeroRow('xero_settings')
        const [[settings]] = await pool.execute('SELECT * FROM xero_settings LIMIT 1')
        if (!settings.xero_redirect_uri) {
            return res.status(400).json({ message: 'Please save your Redirect URI first.' })
        }
        if (!settings.client_id || !settings.client_secret) {
            return res.status(400).json({ message: 'Please save your Client ID and Client Secret first.' })
        }
        const state = randomUUID()
        const authUrl = `${XERO_AUTH_URL}?response_type=code&client_id=${encodeURIComponent(settings.client_id)}&redirect_uri=${encodeURIComponent(settings.xero_redirect_uri)}&scope=${encodeURIComponent(XERO_SCOPE)}&state=${state}`
        res.json({ auth_url: authUrl, state })
    } catch (e) {
        console.error('[Xero] auth-url error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// GET /api/xero/callback — handle the OAuth2 callback from Xero
app.get('/api/xero/callback', async (req, res) => {
    const { code, state, error } = req.query
    if (error) {
        console.error('[Xero] OAuth error:', error)
        return res.redirect('/xero?xero_error=' + encodeURIComponent(error))
    }
    if (!code) {
        return res.redirect('/xero?xero_error=missing_code')
    }
    try {
        await ensureXeroRow('xero_settings')
        const [[settings]] = await pool.execute('SELECT * FROM xero_settings LIMIT 1')
        if (!settings.xero_redirect_uri || !settings.client_id || !settings.client_secret) {
            return res.redirect('/xero?xero_error=missing_credentials')
        }

        // Exchange authorization code for tokens
        const basicAuth = Buffer.from(`${settings.client_id}:${settings.client_secret}`).toString('base64')
        const postData = new URLSearchParams({
            grant_type: 'authorization_code',
            code: String(code),
            redirect_uri: settings.xero_redirect_uri,
        }).toString()

        const result = await xeroHttpsRequest(XERO_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${basicAuth}`,
            },
            body: postData,
        })

        if (result.statusCode !== 200) {
            console.error('[Xero] Token exchange failed:', result.body)
            return res.redirect('/xero?xero_error=token_exchange_failed')
        }

        const tokenData = JSON.parse(result.body)
        const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

        // Fetch connected tenant (organisation) from Xero connections API
        let tenantId = ''
        let tenantName = ''
        try {
            const connResult = await xeroHttpsRequest(XERO_CONNECTIONS_URL, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`,
                    'Accept': 'application/json',
                },
            })
            if (connResult.statusCode === 200) {
                const connections = JSON.parse(connResult.body)
                if (Array.isArray(connections) && connections.length > 0) {
                    tenantId = connections[0].tenantId || ''
                    tenantName = connections[0].tenantName || ''
                }
            }
        } catch (connErr) {
            console.error('[Xero] Failed to fetch connections:', connErr.message)
        }

        // Store tokens and mark as connected
        await pool.execute(
            'UPDATE xero_settings SET access_token=?, refresh_token=?, token_expires_at=?, tenant_id=?, tenant_name=?, is_connected=1 ORDER BY id LIMIT 1',
            [tokenData.access_token, tokenData.refresh_token, expiresAt, tenantId, tenantName]
        )

        await logActivity(null, 'xero_connect', `Connected to Xero (tenantId=${tenantId})`, '')
        console.log('[Xero] Successfully connected, tenantId:', tenantId, 'org:', tenantName)

        return res.redirect('/xero?xero_connected=true')
    } catch (e) {
        console.error('[Xero] callback error:', e.message)
        return res.redirect('/xero?xero_error=server_error')
    }
})

// POST /api/xero/disconnect — revoke tokens and clear connection
app.post('/api/xero/disconnect', requireAuth, requireAdmin, async (req, res) => {
    try {
        await ensureXeroRow('xero_settings')
        const [[settings]] = await pool.execute('SELECT * FROM xero_settings LIMIT 1')

        // Revoke the token at Xero if we have one
        if (settings.refresh_token && settings.client_id && settings.client_secret) {
            try {
                const basicAuth = Buffer.from(`${settings.client_id}:${settings.client_secret}`).toString('base64')
                const postData = new URLSearchParams({ token: settings.refresh_token }).toString()
                await xeroHttpsRequest(XERO_REVOKE_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': `Basic ${basicAuth}`,
                    },
                    body: postData,
                })
                console.log('[Xero] Token revoked')
            } catch (revokeErr) {
                console.error('[Xero] Token revoke error (non-critical):', revokeErr.message)
            }
        }

        // Clear tokens and mark as disconnected
        await pool.execute(
            'UPDATE xero_settings SET is_connected=0, access_token=NULL, refresh_token=NULL, tenant_id=NULL, tenant_name=NULL, token_expires_at=NULL ORDER BY id LIMIT 1'
        )
        await logActivity(req.user.id, 'xero_disconnect', 'Disconnected from Xero', getIp(req))
        res.json({ ok: true })
    } catch (e) {
        console.error('[Xero] disconnect error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// GET /api/xero/accounts — fetch Chart of Accounts from Xero API
app.get('/api/xero/accounts', requireAuth, requireAdmin, async (req, res) => {
    try {
        await ensureXeroRow('xero_settings')
        const [[settings]] = await pool.execute('SELECT * FROM xero_settings LIMIT 1')

        if (!settings.is_connected || !settings.tenant_id) {
            return res.json([])
        }

        const accessToken = await getValidXeroToken()
        if (!accessToken) {
            await pool.execute(
                'UPDATE xero_settings SET is_connected=0, access_token=NULL, refresh_token=NULL, tenant_id=NULL, tenant_name=NULL, token_expires_at=NULL ORDER BY id LIMIT 1'
            )
            return res.status(401).json({ message: 'Xero session expired. Please reconnect.' })
        }

        const url = `${XERO_API_BASE}/Accounts?where=Status%3D%3D%22ACTIVE%22&order=Name`
        const result = await xeroHttpsRequest(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Xero-Tenant-Id': settings.tenant_id,
                'Accept': 'application/json',
            },
        })

        if (result.statusCode !== 200) {
            console.error('[Xero] Account query failed:', result.statusCode, result.body)
            return res.status(502).json({ message: 'Failed to fetch accounts from Xero' })
        }

        const data = JSON.parse(result.body)
        const xeroAccounts = (data.Accounts) || []
        const accounts = xeroAccounts.map((acct) => ({
            id: acct.Code || acct.AccountID,
            name: `${acct.Type} - ${acct.Name}`,
        }))

        res.json(accounts)
    } catch (e) {
        console.error('[Xero] accounts error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// GET /api/xero/mappings
app.get('/api/xero/mappings', requireAuth, requireAdmin, async (req, res) => {
    try {
        await ensureXeroRow('xero_account_mappings')
        const [[row]] = await pool.execute('SELECT * FROM xero_account_mappings LIMIT 1')
        res.json({
            topups_account: row.topups_account,
            shop_sales_account: row.shop_sales_account,
            refunds_account: row.refunds_account,
            center_expenses_account: row.center_expenses_account,
            bank_account: row.bank_account,
        })
    } catch (e) {
        console.error('[Xero] mappings get error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// POST /api/xero/mappings
app.post('/api/xero/mappings', requireAuth, requireAdmin, async (req, res) => {
    const { topups_account, shop_sales_account, refunds_account, center_expenses_account, bank_account } = req.body || {}
    try {
        await ensureXeroRow('xero_account_mappings')
        await pool.execute(
            'UPDATE xero_account_mappings SET topups_account=?, shop_sales_account=?, refunds_account=?, center_expenses_account=?, bank_account=? ORDER BY id LIMIT 1',
            [topups_account || '', shop_sales_account || '', refunds_account || '', center_expenses_account || '', bank_account || '']
        )
        await logActivity(req.user.id, 'xero_mappings_update', 'Xero account mappings updated', getIp(req))
        res.json({ ok: true })
    } catch (e) {
        console.error('[Xero] mappings save error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// ── Core Xero report-sending logic (shared by HTTP endpoint and scheduler) ────
// Returns { ok, message, totals?, xero_journal_id? }
async function sendXeroReportForCafe(cafe_id, report_date, sent_by) {
    // Check for duplicate
    const [[existing]] = await pool.execute(
        'SELECT id FROM xero_send_history WHERE cafe_id=? AND report_date=?',
        [cafe_id, report_date]
    )
    if (existing) {
        return { ok: false, status: 409, message: 'Report for this cafe and date has already been sent' }
    }

    // Look up cafe details
    const [[cafe]] = await pool.execute('SELECT name, cafe_id AS icafe_cafe_id, api_key FROM cafes WHERE id=?', [cafe_id])
    if (!cafe) {
        return { ok: false, status: 404, message: 'Cafe not found' }
    }
    const cafeName = cafe.name

    // Verify Xero is connected
    await ensureXeroRow('xero_settings')
    const [[xeroSettings]] = await pool.execute('SELECT * FROM xero_settings LIMIT 1')
    if (!xeroSettings.is_connected || !xeroSettings.tenant_id) {
        return { ok: false, status: 400, message: 'Xero is not connected. Please connect first.' }
    }

    // Get valid Xero access token
    const accessToken = await getValidXeroToken()
    if (!accessToken) {
        return { ok: false, status: 401, message: 'Xero session expired. Please reconnect.' }
    }

    // Load account mappings
    await ensureXeroRow('xero_account_mappings')
    const [[mappings]] = await pool.execute('SELECT * FROM xero_account_mappings LIMIT 1')
    if (!mappings.topups_account && !mappings.shop_sales_account && !mappings.refunds_account && !mappings.center_expenses_account) {
        return { ok: false, status: 400, message: 'No account mappings configured. Please set up account mappings first.' }
    }

    // ── Fetch daily totals from iCafe API ─────────────────────────────────────
    const dateParts = report_date.split('-').map(Number)
    const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2])
    dateObj.setDate(dateObj.getDate() + 1)
    const nextDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`

    const authHeader = `Bearer ${cafe.api_key}`

    async function fetchIcafeApi(urlPath) {
        const url = 'https://api.icafecloud.com/api/v2' + urlPath
        try {
            const result = await fetchUpstream(url, { authorization: authHeader })
            if (result.statusCode !== 200) {
                console.error(`[Xero] iCafe API error: ${result.statusCode}`, typeof result.body === 'string' ? result.body.substring(0, 200) : '')
                return null
            }
            const bodyStr = typeof result.body === 'string' ? result.body : result.body.toString('utf8')
            return JSON.parse(bodyStr)
        } catch (err) {
            console.error(`[Xero] iCafe API fetch error:`, err.message)
            return null
        }
    }

    const shiftListResp = await fetchIcafeApi(
        `/cafe/${cafe.icafe_cafe_id}/reports/shiftList?date_start=${report_date}&date_end=${nextDate}&time_start=00:00&time_end=23:59&shift_staff_name=all`
    )
    const rawShifts = (shiftListResp && shiftListResp.data) || []

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

    console.log(`[Xero] Found ${allShifts.length} shifts for ${cafeName} on ${report_date}`)

    let totalTopUps = 0
    let totalShopSales = 0
    let totalRefunds = 0
    let totalExpenses = 0

    for (const shift of allShifts) {
        const shiftId = shift.shift_id || shift.id
        if (!shiftId) continue
        const detail = await fetchIcafeApi(
            `/cafe/${cafe.icafe_cafe_id}/reports/shiftDetail/${shiftId}`
        )
        if (!detail || !detail.data) continue
        const d = detail.data

        const cash = Number(d.cash) || 0
        const shopSalesArr = Array.isArray(d.shop_sales) ? d.shop_sales : []
        const shopSales = shopSalesArr.reduce((sum, item) => sum + (parseFloat(String(item.cash || 0)) || 0), 0)
        const digitalTopups = (Number(d.qr_topup) || 0) + (Number(d.credit_card) || 0)
        const topUps = (cash - shopSales) + digitalTopups

        totalTopUps += topUps
        totalShopSales += shopSales
        totalRefunds += Number(d.cash_refund) || 0
        totalExpenses += Number(d.center_expenses) || 0

        console.log(`[Xero] Shift ${shiftId}: topUps=${topUps.toFixed(2)}, shopSales=${shopSales.toFixed(2)}, refunds=${(Number(d.cash_refund) || 0).toFixed(2)}, expenses=${(Number(d.center_expenses) || 0).toFixed(2)}`)
    }

    console.log(`[Xero] Totals for ${cafeName} on ${report_date}: topUps=${totalTopUps.toFixed(2)}, shopSales=${totalShopSales.toFixed(2)}, refunds=${totalRefunds.toFixed(2)}, expenses=${totalExpenses.toFixed(2)}`)

    // ── Build Xero Manual Journal ─────────────────────────────────────────────
    // Xero ManualJournal: positive LineAmount = Debit, negative = Credit
    // Revenue accounts (top-ups, shop sales) are credited (negative)
    // Offset/bank account is debited (positive) for total income
    // Refunds debit the revenue account (reduce income)
    // Expenses debit the expense account
    const description = `${cafeName} Daily Report - ${report_date}`
    const journalLines = []

    const totalIncome = (totalTopUps + totalShopSales) - Math.abs(totalRefunds)
    const bankCode = mappings.bank_account

    // Income: credit revenue accounts, debit bank
    if (totalTopUps !== 0 && mappings.topups_account) {
        journalLines.push({
            LineAmount: -(Math.round(totalTopUps * 100) / 100),
            AccountCode: mappings.topups_account,
            Description: `Top-ups - ${cafeName} - ${report_date}`,
        })
    }
    if (totalShopSales !== 0 && mappings.shop_sales_account) {
        journalLines.push({
            LineAmount: -(Math.round(totalShopSales * 100) / 100),
            AccountCode: mappings.shop_sales_account,
            Description: `Shop Sales - ${cafeName} - ${report_date}`,
        })
    }
    if (totalRefunds !== 0 && mappings.refunds_account) {
        journalLines.push({
            LineAmount: Math.round(Math.abs(totalRefunds) * 100) / 100,
            AccountCode: mappings.refunds_account,
            Description: `Refunds - ${cafeName} - ${report_date}`,
        })
    }
    if (totalExpenses !== 0 && mappings.center_expenses_account) {
        journalLines.push({
            LineAmount: Math.round(totalExpenses * 100) / 100,
            AccountCode: mappings.center_expenses_account,
            Description: `Center Expenses - ${cafeName} - ${report_date}`,
        })
    }

    // Offsetting debit to bank/cash account (net income - expenses)
    if (bankCode) {
        const bankDebit = Math.round((totalIncome - totalExpenses) * 100) / 100
        if (bankDebit !== 0) {
            journalLines.push({
                LineAmount: bankDebit,
                AccountCode: bankCode,
                Description: `Net - ${cafeName} - ${report_date}`,
            })
        }
    }

    if (journalLines.length === 0) {
        // Nothing to post
        const historyId = randomUUID()
        await pool.execute(
            'INSERT INTO xero_send_history (id, cafe_id, cafe_name, report_date, status, sent_by) VALUES (?,?,?,?,?,?)',
            [historyId, cafe_id, cafeName, report_date, 'success', sent_by]
        )
        return { ok: true, totals: { top_ups: totalTopUps, shop_sales: totalShopSales, refunds: totalRefunds, center_expenses: totalExpenses } }
    }

    // ── POST ManualJournal to Xero ────────────────────────────────────────────
    const manualJournal = {
        Narration: description,
        JournalLines: journalLines,
        Date: report_date,
        ShowOnCashBasisReports: false,
    }

    const xeroResult = await xeroHttpsRequest(`${XERO_API_BASE}/ManualJournals`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Xero-Tenant-Id': xeroSettings.tenant_id,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ ManualJournals: [manualJournal] }),
    })

    const historyId = randomUUID()

    if (xeroResult.statusCode === 200 || xeroResult.statusCode === 201) {
        let xeroJournalId = ''
        try {
            const xeroBody = JSON.parse(xeroResult.body)
            xeroJournalId = (xeroBody.ManualJournals && xeroBody.ManualJournals[0] && xeroBody.ManualJournals[0].ManualJournalID) || ''
        } catch {}

        await pool.execute(
            'INSERT INTO xero_send_history (id, cafe_id, cafe_name, report_date, status, sent_by) VALUES (?,?,?,?,?,?)',
            [historyId, cafe_id, cafeName, report_date, 'success', sent_by]
        )
        await logActivity(sent_by, 'xero_report_sent', `Xero report sent for ${cafeName} on ${report_date}`)
        return { ok: true, xero_journal_id: xeroJournalId, totals: { top_ups: totalTopUps, shop_sales: totalShopSales, refunds: totalRefunds, center_expenses: totalExpenses } }
    } else {
        console.error('[Xero] ManualJournal POST failed:', xeroResult.statusCode, xeroResult.body)
        await pool.execute(
            'INSERT INTO xero_send_history (id, cafe_id, cafe_name, report_date, status, sent_by) VALUES (?,?,?,?,?,?)',
            [historyId, cafe_id, cafeName, report_date, 'failed', sent_by]
        )
        await logActivity(sent_by, 'xero_report_failed', `Xero report failed for ${cafeName} on ${report_date}: status ${xeroResult.statusCode}`)

        let errorMsg = 'Failed to create manual journal in Xero'
        try {
            const errBody = JSON.parse(xeroResult.body)
            if (errBody.Message) errorMsg = errBody.Message
            else if (errBody.Elements && errBody.Elements[0] && errBody.Elements[0].ValidationErrors && errBody.Elements[0].ValidationErrors[0]) {
                errorMsg = errBody.Elements[0].ValidationErrors[0].Message
            }
        } catch {}
        return { ok: false, status: 502, message: errorMsg }
    }
}

// POST /api/xero/send-report
app.post('/api/xero/send-report', requireAuth, requireAdmin, async (req, res) => {
    const { cafe_id, report_date } = req.body || {}
    if (!cafe_id || !report_date) {
        return res.status(400).json({ message: 'cafe_id and report_date required' })
    }
    try {
        const result = await sendXeroReportForCafe(cafe_id, report_date, req.user.id)
        if (result.ok) {
            res.json(result)
        } else {
            res.status(result.status || 500).json({ message: result.message })
        }
    } catch (e) {
        console.error('[Xero] send-report error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// GET /api/xero/schedule
app.get('/api/xero/schedule', requireAuth, requireAdmin, async (req, res) => {
    try {
        await ensureXeroRow('xero_schedule')
        const [[row]] = await pool.execute('SELECT * FROM xero_schedule LIMIT 1')
        res.json({
            schedule_type: row.schedule_type,
            schedule_time: row.schedule_time,
            last_run_date: row.last_run_date || '',
        })
    } catch (e) {
        console.error('[Xero] schedule get error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// POST /api/xero/schedule
app.post('/api/xero/schedule', requireAuth, requireAdmin, async (req, res) => {
    const { schedule_type, schedule_time } = req.body || {}
    try {
        await ensureXeroRow('xero_schedule')
        await pool.execute(
            'UPDATE xero_schedule SET schedule_type=?, schedule_time=? ORDER BY id LIMIT 1',
            [schedule_type || '', schedule_time || '06:00']
        )
        await logActivity(req.user.id, 'xero_schedule_update', `Xero schedule set to ${schedule_type}`, getIp(req))
        res.json({ ok: true })
    } catch (e) {
        console.error('[Xero] schedule save error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// GET /api/xero/history
app.get('/api/xero/history', requireAuth, requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT id, cafe_id, cafe_name, DATE_FORMAT(report_date, "%Y-%m-%d") AS report_date, sent_at, status, sent_by FROM xero_send_history ORDER BY sent_at DESC LIMIT 100'
        )
        res.json(rows)
    } catch (e) {
        console.error('[Xero] history error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// GET /api/xero/scheduler-logs
app.get('/api/xero/scheduler-logs', requireAuth, requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT id, report_date, run_at, schedule_type, success_count, skip_count, fail_count, details FROM xero_scheduler_logs ORDER BY run_at DESC LIMIT 20'
        )
        res.json(rows)
    } catch (e) {
        console.error('[Xero] scheduler-logs error:', e.message)
        res.status(500).json({ message: 'Server error' })
    }
})

// ── Xero Automated Report Scheduler ──────────────────────────────────────────
// Uses the same Asia/Manila timezone logic as the QuickBooks/Google Sheets schedulers.

async function runScheduledXeroReports() {
    try {
        await ensureXeroRow('xero_schedule')
        const [[schedule]] = await pool.execute('SELECT * FROM xero_schedule LIMIT 1')
        if (!schedule || !schedule.schedule_type) return

        const { currentTime, reportDate } = getManilaTime()

        if (schedule.last_run_date === reportDate) return

        let shouldRun = false
        const schedType = schedule.schedule_type
        const schedTime = schedule.schedule_time || '06:00'

        if (schedType === 'daily_at_time') {
            shouldRun = (currentTime >= schedTime)
        } else if (schedType === 'after_business_day') {
            shouldRun = (currentTime >= '06:00')
        } else if (schedType === 'after_last_shift') {
            shouldRun = (currentTime >= '06:00')
        }

        if (!shouldRun) return

        console.log(`[Xero-Scheduler] Running automated reports for ${reportDate} (schedule: ${schedType}, time: ${schedTime}, Manila time: ${currentTime})`)

        const [cafes] = await pool.execute('SELECT id, name FROM cafes ORDER BY sort_order ASC')
        if (!cafes || cafes.length === 0) {
            console.log('[Xero-Scheduler] No cafes configured')
            return
        }

        let successCount = 0
        let skipCount = 0
        let failCount = 0
        const details = []

        for (const cafe of cafes) {
            try {
                const result = await sendXeroReportForCafe(cafe.id, reportDate, 'scheduler')
                if (result.ok) {
                    successCount++
                    details.push(`✓ ${cafe.name}: sent`)
                    console.log(`[Xero-Scheduler] ✓ ${cafe.name}: sent successfully`)
                } else if (result.status === 409) {
                    skipCount++
                    details.push(`⊘ ${cafe.name}: already sent`)
                    console.log(`[Xero-Scheduler] ⊘ ${cafe.name}: already sent, skipping`)
                } else {
                    failCount++
                    details.push(`✗ ${cafe.name}: ${result.message}`)
                    console.log(`[Xero-Scheduler] ✗ ${cafe.name}: ${result.message}`)
                }
            } catch (err) {
                failCount++
                details.push(`✗ ${cafe.name}: ${err.message}`)
                console.error(`[Xero-Scheduler] ✗ ${cafe.name}: error —`, err.message)
            }
        }

        await pool.execute(
            'UPDATE xero_schedule SET last_run_date=? ORDER BY id LIMIT 1',
            [reportDate]
        )

        await pool.execute(
            'INSERT INTO xero_scheduler_logs (report_date, schedule_type, success_count, skip_count, fail_count, details) VALUES (?,?,?,?,?,?)',
            [reportDate, schedType, successCount, skipCount, failCount, details.join('\n')]
        )

        console.log(`[Xero-Scheduler] Completed: ${successCount} sent, ${skipCount} skipped, ${failCount} failed`)
    } catch (err) {
        console.error('[Xero-Scheduler] Error:', err.message)
    }
}

// Run the Xero scheduler check every 60 seconds
setInterval(runScheduledXeroReports, 60 * 1000)
setTimeout(runScheduledXeroReports, 7000)
console.log('[Xero-Scheduler] Initialized — checking every 60s (Asia/Manila timezone)')

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
