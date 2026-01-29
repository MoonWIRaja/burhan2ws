# burhan2ws - WhatsApp Web Gateway

A modern WhatsApp Web Gateway system with ISO Matrix 3D theme, built with Node.js, Express, React, and Baileys.

## Features

- 🚀 **Multi-Session Management** - Manage multiple WhatsApp sessions simultaneously
- 💬 **Real-Time Messaging** - Send and receive messages via WebSocket (Socket.IO)
- 📁 **File Processing** - Upload and process PDF, Excel, and CSV files
- 📊 **Dashboard** - Beautiful ISO Matrix 3D themed dashboard with statistics
- 🎨 **Modern UI** - Tailwind CSS with custom ISO Matrix 3D design
- 🔄 **Queue System** - BullMQ + Redis for efficient job processing
- 🗄️ **PostgreSQL** - Robust database with Prisma ORM

## Tech Stack

### Backend
- **Node.js** + **Express.js** - Web framework
- **@whiskeysockets/baileys** - WhatsApp integration
- **Socket.IO** - Real-time WebSocket communication
- **BullMQ** + **Redis** - Job queue management
- **Prisma ORM** - Database ORM
- **PostgreSQL** - Database
- **Multer** - File upload handling

### Frontend
- **React 18** - UI library
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Socket.IO Client** - Real-time updates
- **TanStack Query** - Data fetching
- **Zustand** - State management
- **Lucide React** - Icons

## Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 12
- Redis (optional, for queue system)
- pnpm, npm, or yarn

## Installation

### 1. Clone the repository

```bash
cd /var/dev/moon/burhan2ws
```

### 2. Install backend dependencies

```bash
cd /var/dev/moon/burhan2ws
npm install
```

### 3. Configure environment variables

Copy the `.env` file and update the configuration:

```bash
cp .env .env.local
```

Edit `.env.local` with your settings:

```env
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/burhan2ws_db"

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# WhatsApp Configuration
WA_SESSIONS_DIR=.wa-sessions
WA_RECONNECT_INTERVAL=30000

# File Upload Configuration
UPLOAD_DIR=uploads
MAX_FILE_SIZE=10485760

# CORS Configuration
FRONTEND_URL=http://localhost:5173
```

### 4. Set up the database

Run Prisma migrations:

```bash
npm run prisma:migrate
```

Generate Prisma client:

```bash
npm run prisma:generate
```

### 5. Install frontend dependencies

```bash
cd frontend
npm install
```

## Running the Application

### Starting the Backend

```bash
cd /var/dev/moon/burhan2ws
npm start
```

Or in development mode with auto-reload:

```bash
npm run dev
```

### Starting the Workers (Optional)

If using the queue system:

```bash
npm run worker
```

### Starting the Frontend

```bash
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- WebSocket: ws://localhost:3000

## Project Structure

```
burhan2ws/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── config/                # Configuration files
│   │   ├── database.js        # Prisma client
│   │   └── socket.js         # Socket.IO setup
│   ├── controllers/           # Route controllers
│   │   ├── sessionController.js
│   │   ├── messageController.js
│   │   └── fileController.js
│   ├── middleware/            # Express middleware
│   │   └── errorHandler.js
│   ├── routes/                # API routes
│   │   ├── index.js
│   │   ├── sessions.js
│   │   ├── messages.js
│   │   ├── files.js
│   │   └── stats.js
│   ├── services/              # Business logic
│   │   ├── whatsappService.js
│   │   ├── queueService.js
│   │   └── fileService.js
│   ├── workers/               # BullMQ workers
│   │   └── index.js
│   └── server.js              # Express server
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── Layout.jsx
│   │   │   └── UI.jsx
│   │   ├── pages/             # Page components
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Sessions.jsx
│   │   │   ├── Messages.jsx
│   │   │   ├── Files.jsx
│   │   │   └── Settings.jsx
│   │   ├── providers/         # Context providers
│   │   │   └── SocketProvider.jsx
│   │   ├── services/          # API services
│   │   │   └── api.js
│   │   ├── store/             # State management
│   │   │   └── useStore.js
│   │   ├── styles/            # Global styles
│   │   │   └── globals.css
│   │   ├── utils/             # Utility functions
│   │   │   └── index.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── uploads/                   # File uploads directory
├── .wa-sessions/             # WhatsApp session data
├── .env                       # Environment variables
├── package.json
└── README.md
```

## API Endpoints

### Sessions
- `GET /api/sessions` - Get all sessions
- `POST /api/sessions` - Create new session
- `GET /api/sessions/:id` - Get session details
- `DELETE /api/sessions/:id` - Disconnect session
- `GET /api/sessions/stats` - Get session statistics

### Messages
- `GET /api/messages/:sessionId` - Get messages for session
- `POST /api/messages/:sessionId/send` - Send message
- `GET /api/messages/:sessionId/stats` - Get message statistics

### Files
- `GET /api/files/:sessionId` - Get files for session
- `POST /api/uploads/:sessionId` - Upload file
- `GET /api/files/:sessionId/stats` - Get file statistics

### Stats
- `GET /api/stats/overview` - Get overall statistics
- `GET /api/stats/queue` - Get queue statistics

## WebSocket Events

### Client → Server
- `join-session` - Join a session room
- `leave-session` - Leave a session room
- `request-qr` - Request QR code for session

### Server → Client
- `connected` - Connection established
- `qr` - QR code received
- `connection-status` - Session connection status update
- `new-message` - New message received
- `message-sent` - Message sent successfully
- `message-status` - Message status update
- `session-connected` - Session connected

## Database Schema

### Session
- `id` - UUID
- `sessionId` - Unique session identifier
- `phoneNumber` - Connected phone number
- `status` - Connection status (connected, disconnected, qr, etc.)
- `qrCode` - QR code data
- `lastActive` - Last activity timestamp
- `createdAt` - Creation timestamp
- `updatedAt` - Update timestamp

### Message
- `id` - UUID
- `sessionId` - Session UUID
- `messageId` - WhatsApp message ID
- `from` - Sender phone number
- `to` - Recipient phone number
- `content` - Message content
- `messageType` - Type (text, image, video, audio, document)
- `timestamp` - Message timestamp
- `status` - Delivery status
- `direction` - inbound/outbound

### File
- `id` - UUID
- `sessionId` - Session UUID
- `fileName` - Original filename
- `filePath` - File path
- `fileSize` - File size in bytes
- `fileType` - File type
- `mimeType` - MIME type
- `uploadStatus` - Upload status
- `processedAt` - Processing timestamp
- `createdAt` - Upload timestamp

### Job
- `id` - UUID
- `jobId` - BullMQ job ID
- `type` - Job type (message, file)
- `status` - Job status
- `data` - Job data (JSON)
- `result` - Job result (JSON)
- `error` - Error message
- `createdAt` - Creation timestamp
- `completedAt` - Completion timestamp

## Troubleshooting

### Database Connection Issues

If you encounter database connection errors:

1. Check PostgreSQL is running:
```bash
sudo systemctl status postgresql
```

2. Verify database credentials in `.env`

3. Test connection:
```bash
psql -h localhost -U burhan2ws_user -d burhan2ws_db
```

### Redis Connection Issues

If using the queue system:

1. Check Redis is running:
```bash
sudo systemctl status redis
```

2. Test connection:
```bash
redis-cli ping
```

### WhatsApp Connection Issues

If sessions fail to connect:

1. Check network connectivity
2. Verify WhatsApp is not blocked
3. Check session logs in `.wa-sessions/` directory
4. Try creating a new session

### File Upload Issues

If file uploads fail:

1. Check `uploads/` directory exists and is writable
2. Verify `MAX_FILE_SIZE` in `.env`
3. Check file type is supported (PDF, Excel, CSV)

## Development

### Adding New Features

1. **Backend**:
   - Add new controller in `src/controllers/`
   - Add new routes in `src/routes/`
   - Add new service in `src/services/`

2. **Frontend**:
   - Add new page in `frontend/src/pages/`
   - Add new component in `frontend/src/components/`
   - Add API service in `frontend/src/services/api.js`

### Running Tests

```bash
# Backend tests (if configured)
npm test

# Frontend tests (if configured)
cd frontend
npm test
```

## Production Deployment

### Environment Setup

1. Set `NODE_ENV=production` in `.env`
2. Use environment-specific database
3. Configure proper CORS origins
4. Set up Redis with persistence
5. Configure file upload to cloud storage (S3, etc.)

### Running in Production

```bash
# Backend
npm start

# Workers (if using queue)
npm run worker

# Frontend (build and serve)
cd frontend
npm run build
npm run preview
```

### Using PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start backend
pm2 start src/server.js --name burhan2ws-backend

# Start workers
pm2 start src/workers/index.js --name burhan2ws-worker

# Save PM2 configuration
pm2 save

# Configure startup script
pm2 startup
```

## License

MIT

## Credits

Made with ❤️ by MoonWiraja

Built with:
- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp API
- [Socket.IO](https://socket.io/) - Real-time communication
- [BullMQ](https://docs.bullmq.io/) - Queue system
- [Prisma](https://www.prisma.io/) - Database ORM
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Vite](https://vitejs.dev/) - Build tool
- [React](https://react.dev/) - UI library
