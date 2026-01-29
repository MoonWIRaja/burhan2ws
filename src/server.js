import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initPrisma } from './config/database.js';
import { initSocket } from './config/socket.js';
import { initWhatsApp } from './services/whatsappService.js';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new Server(httpServer, {
  path: '/ws',  // Custom path to avoid Brave blocking
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:5175',
      'http://192.168.0.8:5175',
      'http://192.168.0.8:5173',
      'https://burhan2ws.owlscottage.com',
      'https://burhan2ws-api.owlscottage.com',
      process.env.FRONTEND_URL
    ].filter(Boolean),
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['*']
  },
  allowRequest: (req, callback) => {
    const origin = req.headers.origin;
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5175',
      'http://192.168.0.8:5175',
      'http://192.168.0.8:5173',
      'https://burhan2ws.owlscottage.com',
      'https://burhan2ws-api.owlscottage.com'
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
});

// Make io globally accessible
app.set('io', io);

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5175',
    'http://192.168.0.8:5175',
    'http://192.168.0.8:5173',
    'https://burhan2ws.owlscottage.com',
    'https://burhan2ws-api.owlscottage.com',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(join(__dirname, '../uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'burhan2ws API is running' });
});

// API Routes
app.use('/api', apiRoutes);

// Error handling middleware
app.use(errorHandler);

// Initialize Prisma and Socket.IO
async function startServer() {
  try {
    // Initialize Prisma
    await initPrisma();
    console.log('✅ Database connected');

    // Initialize Socket.IO
    initSocket(io);
    console.log('✅ Socket.IO initialized');

    // Start server
    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, async () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📡 WebSocket server ready`);
      console.log(`📁 Uploads directory: ${join(__dirname, '../uploads')}`);

      // Initialize WhatsApp service after server starts
      await initWhatsApp();
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

startServer();
