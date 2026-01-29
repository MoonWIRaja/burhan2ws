import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

// Singleton socket instance to prevent duplicate connections in React StrictMode
let socketInstance = null;
let isConnecting = false;

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(socketInstance);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [qrSessionId, setQrSessionId] = useState(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    // Prevent multiple initializations
    if (isInitialized.current) {
      return;
    }
    isInitialized.current = true;

    // Create socket connection only once
    if (!socketInstance && !isConnecting) {
      isConnecting = true;

      try {
        const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
        console.log('🔌 Connecting to:', socketUrl);

        socketInstance = io(socketUrl, {
          path: '/ws',
          transports: ['websocket', 'polling'],  // Try websocket first, then polling
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: Infinity,
          timeout: 10000,
          autoConnect: true,
          secure: true  // Use HTTPS/WSS
        });

        // Connection established
        socketInstance.on('connect', () => {
          console.log('✅ Connected to server');
          setIsConnected(true);
          setConnectionError(null);
          isConnecting = false;
        });

        // Connection lost
        socketInstance.on('disconnect', (reason) => {
          console.log('❌ Disconnected from server:', reason);
          setIsConnected(false);
        });

        socketInstance.on('connect_error', (error) => {
          console.error('❌ Socket connection error:', error.message);
          isConnecting = false;

          // Detect browser extension blocking
          const isBlocked = error.type === 'TransportError' ||
                           error.message.includes('block') ||
                           error.description === 'blocked' ||
                           error.message.includes('ERR_BLOCKED');

          if (isBlocked) {
            setConnectionError({
              type: 'extension_blocked',
              message: 'Connection is being blocked by a browser extension (ad blocker, privacy shield, etc.). Please disable extensions or use incognito mode.'
            });
            console.warn('⚠️ Connection blocked by browser extension');
            console.warn('   Fix: Disable ad blockers or use Incognito mode (Ctrl+Shift+N)');
          } else {
            setConnectionError({
              type: 'connection_failed',
              message: `Failed to connect: ${error.message}`
            });
          }
        });

        socketInstance.on('connected', (data) => {
          console.log('📡 Server acknowledged connection:', data);
        });

        // QR Code events
        socketInstance.on('qr', (data) => {
          console.log('📱 QR Code event received:', data);
          console.log('📱 QR data type:', typeof data);
          console.log('📱 QR keys:', Object.keys(data));
          setQrCode(data.qr);
          setQrSessionId(data.sessionId);
        });

        socketInstance.on('connection.update', (data) => {
          console.log('🔄 Connection update:', data);
          if (data.qr) {
            setQrCode(data.qr);
            setQrSessionId(data.sessionId);
          }
          if (data.connection === 'open') {
            // Connection successful, clear QR code
            setQrCode(null);
            setQrSessionId(null);
          }
        });

        // Handle session errors (like 515 stream error)
        socketInstance.on('connection-error', (data) => {
          console.error('⚠️ Session error:', data);

          // Show alert to user
          if (data.code === 515) {
            alert(`⚠️ ${data.error}\n\nPlease scan the QR code again to reconnect.`);
          }

          // Clear old QR to show new one
          if (data.sessionId === qrSessionId) {
            setQrCode(null);
          }
        });

        setSocket(socketInstance);
      } catch (error) {
        console.error('❌ Failed to create socket connection:', error);
        setConnectionError({
          type: 'init_failed',
          message: error.message
        });
        isConnecting = false;
      }
    } else if (socketInstance) {
      // Update connection state from existing socket
      setIsConnected(socketInstance.connected);
    }

    // Cleanup
    return () => {
      // Don't disconnect on unmount to handle React StrictMode
      // The socket will persist across remounts
    };
  }, []);

  const value = {
    socket,
    isConnected,
    connectionError,
    qrCode,
    qrSessionId,
    closeQrCode: () => {
      setQrCode(null);
      setQrSessionId(null);
    }
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === null) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

export default SocketProvider;
