/**
 * Initialize Socket.IO server
 */
export function initSocket(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Send initial data to connected client
    socket.emit('connected', {
      message: 'Connected to burhan2ws WebSocket server',
      socketId: socket.id
    });

    // Handle client joining a session room
    socket.on('join-session', (sessionId) => {
      socket.join(`session:${sessionId}`);
      console.log(`📱 Client ${socket.id} joined session room: ${sessionId}`);
      console.log(`📱 Rooms for this socket:`, socket.rooms);
    });

    // Handle client leaving a session room
    socket.on('leave-session', (sessionId) => {
      socket.leave(`session:${sessionId}`);
      console.log(`📱 Client left session: ${sessionId}`);
    });

    // Handle QR code request
    socket.on('request-qr', async (sessionId) => {
      console.log(`📱 QR requested for session: ${sessionId}`);

      try {
        // Get the session from database to check if QR exists
        const { getPrisma } = await import('./database.js');
        const session = await getPrisma().session.findUnique({
          where: { sessionId }
        });

        if (session && session.qrCode) {
          // Emit the stored QR code
          socket.emit('qr', {
            sessionId,
            qr: session.qrCode
          });
          console.log(`✅ Sent stored QR for session: ${sessionId}`);
        } else {
          console.log(`⚠️ No QR code found for session: ${sessionId}`);
        }
      } catch (error) {
        console.error(`❌ Error handling QR request:`, error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  // Make io accessible to other modules
  global.io = io;

  console.log('✅ Socket.IO event handlers registered');
}

/**
 * Emit event to specific session room
 */
export function emitToSession(sessionId, event, data) {
  if (global.io) {
    const roomName = `session:${sessionId}`;
    console.log(`📤 Emitting to room [${roomName}]:`, event);
    console.log(`📤 Data:`, data);

    // Get all sockets in the room
    const room = global.io.sockets.adapter.rooms.get(roomName);
    if (room) {
      console.log(`📤 Room [${roomName}] has ${room.size} clients`);
    } else {
      console.warn(`⚠️ Room [${roomName}] has no clients!`);
    }

    global.io.to(roomName).emit(event, data);
  } else {
    console.warn('⚠️ global.io is not available');
  }
}

/**
 * Emit event to all connected clients
 */
export function broadcast(event, data) {
  if (global.io) {
    global.io.emit(event, data);
  }
}
