# MySQL / MariaDB Setup Guide

The iCafe Dashboard uses **MySQL** (or the drop-in compatible **MariaDB**) as its database backend.

---

## 1. Install MySQL or MariaDB

### Ubuntu / Debian
```bash
sudo apt-get install -y mysql-server   # MySQL
# — or —
sudo apt-get install -y mariadb-server # MariaDB (lighter, fully compatible)
sudo service mysql start               # or: sudo service mariadb start
```

### macOS (Homebrew)
```bash
brew install mysql
brew services start mysql
```

### Windows
Download the installer from https://dev.mysql.com/downloads/mysql/ and follow the wizard.

---

## 2. Create the database and user

Log in as root and run:

```sql
CREATE DATABASE IF NOT EXISTS icafe_dashboard
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'icafe'@'localhost'
    IDENTIFIED BY 'your_strong_password';

GRANT ALL PRIVILEGES ON icafe_dashboard.* TO 'icafe'@'localhost';
FLUSH PRIVILEGES;
```

The application will automatically create the `cafes` table on first startup.

---

## 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

```dotenv
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_USER=icafe
DB_PASSWORD=your_strong_password
DB_NAME=icafe_dashboard
```

> **Note:** `.env` is listed in `.gitignore` and will never be committed.

---

## 4. Start the server

```bash
node server.cjs          # production
# — or —
pnpm run dev:local       # development (Vite + server.cjs concurrently)
```

---

## Schema reference

```sql
CREATE TABLE cafes (
    id         VARCHAR(36)  NOT NULL PRIMARY KEY,  -- UUID
    name       VARCHAR(255) NOT NULL,
    cafe_id    VARCHAR(100) NOT NULL,               -- iCafeCloud cafe ID
    api_key    TEXT         NOT NULL,               -- iCafeCloud JWT token
    sort_order INT          NOT NULL DEFAULT 0,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```
