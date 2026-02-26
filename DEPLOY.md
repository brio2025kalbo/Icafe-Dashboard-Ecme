# Deploying iCafe Dashboard to a Live VPS

This guide walks you through a full production deployment on an **Ubuntu 22.04 / Debian 12** VPS using **Node.js**, **MySQL / MariaDB**, **PM2**, and **Nginx** with a free SSL certificate from **Let's Encrypt**.

---

## Prerequisites

| Requirement | Minimum |
|---|---|
| VPS RAM | 1 GB (2 GB recommended) |
| Disk | 10 GB |
| OS | Ubuntu 22.04 LTS / Debian 12 |
| Domain name | Pointed to your server's IP (A record) |

---

## 1 — Connect to Your VPS

```bash
ssh root@YOUR_SERVER_IP
# or with a non-root user:
ssh your_user@YOUR_SERVER_IP
```

---

## 2 — Install System Dependencies

### 2a. Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # should print v20.x.x
```

### 2b. pnpm (package manager used by this project)

```bash
npm install -g pnpm
pnpm -v
```

### 2c. PM2 (process manager)

```bash
npm install -g pm2
pm2 -v
```

### 2d. Nginx

```bash
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 2e. MySQL / MariaDB

```bash
sudo apt-get install -y mariadb-server
sudo systemctl enable mariadb
sudo systemctl start mariadb
sudo mysql_secure_installation   # follow the prompts
```

---

## 3 — Create the Database and User

Log in to the MySQL shell:

```bash
sudo mysql -u root -p
```

Run the following SQL:

```sql
CREATE DATABASE IF NOT EXISTS icafe_dashboard
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'icafe'@'localhost'
    IDENTIFIED BY 'your_strong_db_password';

GRANT ALL PRIVILEGES ON icafe_dashboard.* TO 'icafe'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

> **Tip:** Replace `your_strong_db_password` with a long random string.

---

## 4 — Upload the Project to the Server

### Option A — Clone from GitHub

```bash
cd /var/www
sudo git clone https://github.com/YOUR_ORG/Icafe-Dashboard-Ecme.git icafe-dashboard
sudo chown -R $USER:$USER /var/www/icafe-dashboard
cd /var/www/icafe-dashboard
```

### Option B — Copy a local build via SCP

```bash
# Run on your local machine:
scp -r /path/to/Icafe-Dashboard-Ecme your_user@YOUR_SERVER_IP:/var/www/icafe-dashboard
```

---

## 5 — Configure Environment Variables

```bash
cd /var/www/icafe-dashboard
cp .env.example .env
nano .env          # or use vim / any editor
```

Fill in every value:

```dotenv
PORT=3000

# Generate a secret: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=paste_your_generated_secret_here
JWT_EXPIRES_IN=7d

DB_HOST=localhost
DB_PORT=3306
DB_USER=icafe
DB_PASSWORD=your_strong_db_password
DB_NAME=icafe_dashboard
```

> **Security:** `.env` is already listed in `.gitignore`. Never commit it.

---

## 6 — Install Dependencies and Build the Frontend

```bash
cd /var/www/icafe-dashboard
pnpm install --frozen-lockfile
pnpm run build        # outputs to build/
```

Verify the build directory was created:

```bash
ls build/             # should list index.html, assets/, etc.
```

---

## 7 — Create the Logs Directory

PM2 is configured to write logs to `./logs/`:

```bash
mkdir -p /var/www/icafe-dashboard/logs
```

---

## 8 — Start the Server with PM2

```bash
cd /var/www/icafe-dashboard
pm2 start ecosystem.config.cjs
```

Check that it started correctly:

```bash
pm2 status
pm2 logs icafe-dashboard --lines 30
```

Save the PM2 process list and enable auto-start on reboot:

```bash
pm2 save
pm2 startup           # prints a command — copy and run it as instructed
```

---

## 9 — Configure Nginx as a Reverse Proxy

```bash
sudo cp /var/www/icafe-dashboard/nginx.conf.example \
        /etc/nginx/sites-available/icafe-dashboard
```

Open the file and replace **all** occurrences of `YOUR_DOMAIN` with your actual domain:

```bash
sudo nano /etc/nginx/sites-available/icafe-dashboard
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/icafe-dashboard \
           /etc/nginx/sites-enabled/icafe-dashboard

# Remove the default site if it conflicts:
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t            # test configuration
sudo systemctl reload nginx
```

---

## 10 — Obtain a Free SSL Certificate (Let's Encrypt)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN
```

Follow the interactive prompts. Certbot will automatically update your Nginx config.

Enable automatic renewal:

```bash
sudo systemctl enable certbot.timer
sudo certbot renew --dry-run   # verify renewal works
```

---

## 11 — Open Firewall Ports

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # ports 80 and 443
sudo ufw enable
sudo ufw status
```

---

## 12 — Verify the Deployment

Open `https://YOUR_DOMAIN` in a browser. You should see the iCafe Dashboard login page.

Check the running process:

```bash
pm2 status
pm2 logs icafe-dashboard --lines 50
```

---

## Updating the Application

```bash
cd /var/www/icafe-dashboard
git pull origin main            # or upload new files via SCP
pnpm install --frozen-lockfile
pnpm run build
pm2 restart icafe-dashboard
```

---

## Useful PM2 Commands

| Command | Description |
|---|---|
| `pm2 status` | Show all running processes |
| `pm2 logs icafe-dashboard` | Stream live logs |
| `pm2 restart icafe-dashboard` | Restart the app |
| `pm2 stop icafe-dashboard` | Stop the app |
| `pm2 delete icafe-dashboard` | Remove from PM2 list |
| `pm2 monit` | Real-time CPU / memory monitor |

---

## Troubleshooting

### App does not start

```bash
pm2 logs icafe-dashboard --lines 100
```

Common causes:
- **Missing `.env`** — run `cp .env.example .env` and fill in values.
- **Database connection failed** — verify `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and that MariaDB is running (`sudo systemctl status mariadb`).
- **Port already in use** — change `PORT` in `.env` or stop the conflicting process.

### 502 Bad Gateway from Nginx

```bash
pm2 status   # make sure the app is running
```

Verify `proxy_pass` in `/etc/nginx/sites-available/icafe-dashboard` points to the same port set in `.env`.

### SSL certificate issues

```bash
sudo certbot renew --dry-run
sudo nginx -t
sudo systemctl reload nginx
```

---

## Directory Layout (after deployment)

```
/var/www/icafe-dashboard/
├── build/           ← compiled React frontend (served by Express)
├── logs/            ← PM2 log files
├── src/             ← TypeScript source
├── uploads/         ← user-uploaded files
├── server.cjs       ← Express backend (entry point)
├── ecosystem.config.cjs  ← PM2 configuration
├── .env             ← secrets (never commit)
└── ...
```
