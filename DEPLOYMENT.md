# Deployment Guide - burhan2ws

This guide will help you deploy the burhan2ws WhatsApp Web Gateway system.

## Prerequisites

- **Node.js** >= 18.0.0
- **PostgreSQL** >= 12
- **Redis** (optional, for queue system)
- **PM2** (recommended for production)
- **Nginx** or **Apache** (recommended reverse proxy)

## Database Setup

### PostgreSQL Setup

1. Install PostgreSQL:
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
```

2. Run SQL commands:
```sql
CREATE USER burhan2ws_user WITH PASSWORD 'your_secure_password';
CREATE DATABASE burhan2ws_db OWNER burhan2ws_user;
GRANT ALL PRIVILEGES ON DATABASE burhan2ws_db TO burhan2ws_user;
ALTER USER burhan2ws_user CREATEDB;
\q
```

3. Test connection:
```bash
psql -h localhost -U burhan2ws_user -d burhan2ws_db -c "SELECT current_database();"
```

### Redis Setup (Optional, for Queue System)

1. Install Redis:
```bash
# Ubuntu/Debian
sudo apt install redis-server

# Start Redis
sudo systemctl start redis
sudo systemctl enable redis

# Test Redis
redis-cli ping
```

## Application Setup

### 1. Clone and Install

```bash
cd /var/dev/moon/burhan2ws

# Install backend dependencies
npm install --production

# Install frontend dependencies
cd frontend
npm install --production
cd ..

# Run Prisma migrations
npm run prisma:migrate

# Generate Prisma client
npm run prisma:generate
```

### 2. Configure Environment

Create `.env` file:

```env
NODE_ENV=production
PORT=3000
HOST=localhost

# Database
DATABASE_URL="postgresql://burhan2ws_user:your_secure_password@localhost:5432/burhan2ws_db"

# Redis (if using queue system)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# WhatsApp
WA_SESSIONS_DIR=.wa-sessions
WA_RECONNECT_INTERVAL=30000

# Uploads
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760

# CORS (update with your domain)
FRONTEND_URL=https://your-domain.com
```

### 3. Build Frontend

```bash
cd frontend
npm run build
```

## Running with PM2

### Install PM2

```bash
npm install -g pm2
```

### Start Backend

```bash
cd /var/dev/moon/burhan2ws

# Start server
pm2 start src/server.js --name burhan2ws-backend

# Start workers (if using queue system)
pm2 start src/workers/index.js --name burhan2ws-worker

# Save PM2 configuration
pm2 save

# Configure PM2 to start on system boot
pm2 startup
# Follow the instructions displayed
```

### Serve Frontend with PM2

Option 1: Using Vite's preview server:
```bash
cd frontend
pm2 start "npm run preview" --name burhan2ws-frontend
```

Option 2: Using a simple HTTP server (recommended):
```bash
cd frontend
npx serve -s dist -l 5173
pm2 serve dist 5173 --name burhan2ws-frontend
```

### PM2 Commands

```bash
# List all processes
pm2 list

# View logs
pm2 logs burhan2ws-backend
pm2 logs burhan2ws-frontend

# Restart processes
pm2 restart burhan2ws-backend
pm2 restart all

# Stop processes
pm2 stop burhan2ws-backend
pm2 stop all

# Delete processes
pm2 delete burhan2ws-backend
pm2 delete all
```

## Nginx Reverse Proxy

### Install Nginx

```bash
sudo apt update
sudo apt install nginx
```

### Configure Nginx

Create configuration file `/etc/nginx/sites-available/burhan2ws`:

```nginx
# Frontend (React app)
server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS (optional)
    # return 301 https://$server_name$request_uri;

    root /var/dev/moon/burhan2ws/frontend/dist;
    index index.html;

    # Frontend static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket proxy
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploads directory
    location /uploads {
        alias /var/dev/moon/burhan2ws/uploads;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
}
```

### Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/burhan2ws /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## SSL/HTTPS Setup with Let's Encrypt

### Install Certbot

```bash
sudo apt install certbot python3-certbot-nginx
```

### Obtain Certificate

```bash
sudo certbot --nginx -d your-domain.com
```

Follow the prompts and choose to redirect HTTP to HTTPS.

### Auto-renewal

Certbot automatically sets up auto-renewal. To verify:
```bash
sudo certbot renew --dry-run
```

## Firewall Setup

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

## Monitoring and Logs

### View PM2 Logs

```bash
# View all logs
pm2 logs

# View specific app logs
pm2 logs burhan2ws-backend

# Follow logs in real-time
pm2 logs --lines 100
```

### Application Logs

Logs are written to:
- PM2 logs: `~/.pm2/logs/`
- Application logs: `logs/` (if configured)
- Nginx logs: `/var/log/nginx/`

### Monitor PM2

```bash
# Monitor in real-time
pm2 monit

# List processes with details
pm2 list --depth 8
```

## Backup Strategy

### Database Backup

Create backup script `backup-db.sh`:

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/var/backups/burhan2ws"
DATABASE="burhan2ws_db"
USER="burhan2ws_user"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db_backup_$DATE.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup
pg_dump -h localhost -U $USER $DATABASE > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Remove backups older than 7 days
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

Add to crontab for daily backups:
```bash
crontab -e
```

Add line:
```
0 2 * * * /path/to/backup-db.sh
```

### Session Backup

WhatsApp sessions are stored in `.wa-sessions/` directory. Back up regularly:

```bash
tar -czf burhan2ws-sessions-$(date +%Y%m%d).tar.gz .wa-sessions/
```

## Security Best Practices

1. **Environment Variables**: Never commit `.env` files to version control
2. **Strong Passwords**: Use strong passwords for database and Redis
3. **Firewall**: Configure UFW to allow only necessary ports
4. **HTTPS**: Always use SSL in production
5. **Updates**: Keep Node.js, npm, and system packages updated
6. **Rate Limiting**: Implement rate limiting on API endpoints
7. **Input Validation**: Validate all user inputs
8. **File Upload Restrictions**: Limit file types and sizes

## Troubleshooting

### Application won't start

1. Check PM2 logs:
```bash
pm2 logs burhan2ws-backend
```

2. Verify environment variables:
```bash
pm2 env 0
```

3. Check database connection:
```bash
psql -h localhost -U burhan2ws_user -d burhan2ws_db
```

### WebSocket connection fails

1. Check Nginx configuration for WebSocket support
2. Verify CORS settings in `.env`
3. Check firewall settings

### File uploads fail

1. Verify `uploads/` directory exists and is writable:
```bash
ls -la uploads/
chmod 755 uploads/
```

2. Check file size limits in `.env`

### Sessions disconnected frequently

1. Check network connectivity
2. Verify WhatsApp servers are accessible
3. Check session logs in `.wa-sessions/`

## Scaling

### Multiple Backend Instances

1. Use a load balancer (Nginx)
2. Configure Redis for session sharing
3. Use shared storage for uploads (S3, etc.)

### Database Optimization

1. Enable connection pooling
2. Add indexes to frequently queried columns
3. Regular database maintenance (VACUUM, ANALYZE)
4. Consider read replicas for high read loads

### Queue Scaling

1. Run multiple worker instances
2. Configure Redis with persistence
3. Monitor queue depth

## Support

For issues and questions:
- Check the main README.md for documentation
- Review logs for error messages
- Test with `NODE_ENV=development` for verbose output
