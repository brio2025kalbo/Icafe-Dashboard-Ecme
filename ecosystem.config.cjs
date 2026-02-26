// PM2 ecosystem configuration for iCafe Dashboard
// Usage:
//   pm2 start ecosystem.config.cjs
//   pm2 save && pm2 startup

module.exports = {
    apps: [
        {
            name: 'icafe-dashboard',
            script: './server.cjs',
            instances: 1,
            exec_mode: 'fork',
            watch: false,
            autorestart: true,
            max_memory_restart: '512M',
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
            },
            // Log files (PM2 default: ~/.pm2/logs/)
            out_file: './logs/out.log',
            error_file: './logs/error.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
        },
    ],
}
