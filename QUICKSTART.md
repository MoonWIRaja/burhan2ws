# Quick Start Guide - burhan2ws

This guide will help you get the burhan2ws WhatsApp Web Gateway system up and running quickly.

## Prerequisites Check

Before starting, ensure you have:

- [ ] Node.js 18+ installed
- [ ] PostgreSQL 12+ installed and running
- [ ] Redis (optional, for queue system)
- [ ] Git installed

## Step 1: Install Backend Dependencies

```bash
cd /var/dev/moon/burhan2ws
npm install
```

## Step 2: Database Setup

The database has already been created with the following credentials:

- **Database**: `burhan2ws_db`
- **User**: `burhan2ws_user`
- **Password**: `burhan2ws_secure_pass_2024`
- **Host**: `localhost`
- **Port**: `5432`

Run Prisma migrations:

```bash
npx prisma migrate dev --name init
```

Generate Prisma client:

```bash
npx prisma generate
```

## Step 3: Install Frontend Dependencies

```bash
cd frontend
npm install
```

## Step 4: Start the Application

### Terminal 1 - Backend

```bash
cd /var/dev/moon/burhan2ws
npm run dev
```

You should see:
```
✅ Database connected
✅ Socket.IO initialized
🚀 Server running on http://localhost:3000
📡 WebSocket server ready
```

### Terminal 2 - Frontend

```bash
cd /var/dev/moon/burhan2ws/frontend
npm run dev
```

You should see:
```
VITE v5.x.x ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

## Step 5: Access the Application

Open your browser and navigate to:

**Frontend**: http://localhost:5173

You should see the burhan2ws dashboard with the ISO Matrix 3D theme!

## Step 6: Create a WhatsApp Session

1. Click on **Sessions** in the sidebar
2. Enter a session ID (e.g., `my-session-1`)
3. Click **Create Session**
4. Wait for the QR code to appear
5. Open WhatsApp on your phone
6. Go to **Settings > Linked Devices > Link a Device**
7. Scan the QR code
8. Once connected, the session status will change to **Connected**

## Step 7: Send Your First Message

1. Click on **Messages** in the sidebar
2. Select your session
3. Enter a phone number (with country code, e.g., `1234567890`) and message
4. Click **Send**

Your message will be sent via WhatsApp!

## Step 8: Upload a File

1. Click on **Files** in the sidebar
2. Select your session
3. Click **Choose File** and select a PDF, Excel, or CSV file
4. Click **Upload**
5. Wait for the file to be processed

## What's Next?

- **Dashboard**: View overall statistics and system status
- **Sessions**: Manage multiple WhatsApp connections
- **Messages**: Send and receive messages
- **Files**: Upload and process files
- **Settings**: View system information and configuration

## Troubleshooting

### Database Connection Error

```
Error: Connection refused
```

Solution: Check PostgreSQL is running:
```bash
sudo systemctl status postgresql
sudo systemctl start postgresql
```

### Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::3000
```

Solution: Kill the process using port 3000:
```bash
lsof -ti:3000 | xargs kill -9
```

### QR Code Not Appearing

If QR code doesn't appear:

1. Refresh the page
2. Check browser console for errors
3. Verify WebSocket connection is active (check Network tab)
4. Try creating a new session

### Messages Not Sending

1. Verify session is connected
2. Check phone number format (include country code)
3. Check browser console for errors
4. Review backend logs

### File Upload Fails

1. Check file type is supported (PDF, Excel, CSV)
2. Verify file size is under 10MB
3. Check `uploads/` directory exists and is writable
4. Review backend logs

## Development Tips

### Hot Reload

- **Backend**: `npm run dev` enables hot reload with nodemon
- **Frontend**: `npm run dev` enables hot reload with Vite

### Viewing Logs

- **Backend logs**: Check terminal running `npm run dev`
- **Frontend logs**: Check browser console (F12)
- **Prisma logs**: Set `LOG_LEVEL=debug` in `.env`

### Reset Database

```bash
# Drop database
sudo -u postgres psql -c "DROP DATABASE burhan2ws_db;"
sudo -u postgres psql -c "CREATE DATABASE burhan2ws_db OWNER burhan2ws_user;"

# Run migrations
npx prisma migrate dev --name init

# Seed database (if you have seed scripts)
npx prisma db seed
```

### Clear WhatsApp Sessions

```bash
rm -rf .wa-sessions/*
```

## Project Structure Overview

```
burhan2ws/
├── src/              # Backend source code
│   ├── config/       # Configuration
│   ├── controllers/  # Request handlers
│   ├── middleware/   # Express middleware
│   ├── routes/       # API routes
│   ├── services/     # Business logic
│   ├── workers/      # Queue workers
│   └── server.js     # Main server
├── frontend/         # Frontend source code
│   └── src/
│       ├── components/  # React components
│       ├── pages/       # Page components
│       ├── providers/   # Context providers
│       ├── services/    # API services
│       ├── store/       # State management
│       └── styles/      # CSS styles
├── prisma/           # Database schema and migrations
├── uploads/          # File uploads directory
├── .wa-sessions/     # WhatsApp session data
└── package.json      # Backend dependencies
```

## Environment Variables

The `.env` file contains configuration:

```env
# Server
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL="postgresql://burhan2ws_user:burhan2ws_secure_pass_2024@localhost:5432/burhan2ws_db"

# Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379

# WhatsApp
WA_SESSIONS_DIR=.wa-sessions

# Uploads
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760

# Frontend
FRONTEND_URL=http://localhost:5173
```

## API Endpoints

### Sessions
- `GET /api/sessions` - List all sessions
- `POST /api/sessions` - Create new session
- `DELETE /api/sessions/:id` - Disconnect session

### Messages
- `GET /api/messages/:sessionId` - Get messages
- `POST /api/messages/:sessionId/send` - Send message

### Files
- `GET /api/files/:sessionId` - Get files
- `POST /api/uploads/:sessionId` - Upload file

### Stats
- `GET /api/stats/overview` - Get statistics

## WebSocket Events

The application uses Socket.IO for real-time updates:

### From Client
- `join-session` - Join session room
- `request-qr` - Request QR code

### From Server
- `qr` - QR code available
- `connection-status` - Session status update
- `new-message` - New message received
- `message-sent` - Message sent

## Next Steps

1. **Explore the Dashboard**: Review all pages and features
2. **Create Multiple Sessions**: Test multi-session functionality
3. **Send Messages**: Try sending messages to different numbers
4. **Upload Files**: Test file processing with different formats
5. **Review Logs**: Check backend and frontend logs for any issues
6. **Customize**: Modify the theme, add features, etc.

## Support

For detailed documentation, see:
- **README.md** - Full documentation
- **DEPLOYMENT.md** - Deployment guide
- **API** - Available endpoints and events

## License

MIT - Feel free to use and modify!

Enjoy using burhan2ws! 🚀
