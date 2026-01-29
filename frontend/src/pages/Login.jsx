import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { useSocket } from '../providers/SocketProvider';
import { sessionsApi } from '../services/api';
import { LoadingSpinner } from '../components/UI';
import { QrCode, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

export default function Login() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { socket, isConnected, qrCode, qrSessionId } = useSocket();
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [localQrCode, setLocalQrCode] = useState(null);

  // Debug: Log QR code changes
  useEffect(() => {
    console.log('🔐 Login Page - qrCode changed:', qrCode);
    console.log('🔐 Login Page - qrSessionId:', qrSessionId);
    console.log('🔐 Login Page - localQrCode:', localQrCode);

    if (qrCode && qrSessionId === sessionId) {
      console.log('✅ Grabbing QR code for session:', sessionId);
      setLocalQrCode(qrCode);
    }
  }, [qrCode, qrSessionId, sessionId]);

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  // Generate unique session ID
  const generateSessionId = () => {
    return `login-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Initialize WhatsApp session
  const initSession = async () => {
    try {
      setStatus('connecting');
      setError('');

      const newSessionId = generateSessionId();
      setSessionId(newSessionId);

      // Join Socket.IO room FIRST
      if (socket && isConnected) {
        console.log('🔗 Login: Joining session room:', newSessionId);
        socket.emit('join-session', newSessionId);
      }

      // Create session via API
      await sessionsApi.create({ sessionId: newSessionId });

      setStatus('qr');

      // Fallback: Request QR if not received after 2 seconds
      setTimeout(() => {
        console.log('⏰ Login: Requesting QR as fallback');
        socket.emit('request-qr', newSessionId);
      }, 2000);
    } catch (err) {
      console.error('Error initializing session:', err);
      setError('Failed to start WhatsApp session. Please try again.');
      setStatus('error');
    }
  };

  // Listen for connection status updates
  useEffect(() => {
    if (!socket || !isConnected || !sessionId) return;

    const handleConnectionStatus = (data) => {
      console.log('Connection status update:', data);

      if (data.sessionId === sessionId && data.status === 'connected') {
        setStatus('connected');
        setPhoneNumber(data.phoneNumber);

        setTimeout(() => {
          navigate('/');
        }, 1500);
      }
    };

    const handleSessionConnected = (data) => {
      if (data.sessionId === sessionId) {
        setStatus('connected');
        setPhoneNumber(data.phoneNumber);

        setTimeout(() => {
          navigate('/');
        }, 1500);
      }
    };

    socket.on('connection-status', handleConnectionStatus);
    socket.on('session-connected', handleSessionConnected);

    return () => {
      socket.off('connection-status', handleConnectionStatus);
      socket.off('session-connected', handleSessionConnected);
    };
  }, [socket, isConnected, sessionId, navigate]);

  // Auto-start session on mount
  useEffect(() => {
    if (isConnected && status === 'idle') {
      initSession();
    }
  }, [isConnected, status]);

  // Re-join session on reconnect
  useEffect(() => {
    if (isConnected && sessionId && socket) {
      console.log('🔗 Login: Re-joining session room:', sessionId);
      socket.emit('join-session', sessionId);
    }
  }, [isConnected, sessionId, socket]);

  const handleRefresh = () => {
    setSessionId(null);
    setPhoneNumber(null);
    setLocalQrCode(null);
    setStatus('idle');
    initSession();
  };

  // Show loading while checking auth status or connecting to socket
  if (authLoading || !isConnected) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium text-sm">Connecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex bg-gradient-to-br from-indigo-50 via-white to-purple-50 overflow-hidden">
      {/* Left Section - Hero */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 lg:p-12 flex-col justify-between relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute top-10 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-400/20 rounded-full blur-3xl animate-float stagger-2"></div>

        {/* Content */}
        <div className="relative z-10 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-xl flex items-center justify-center border border-white/30">
              <Smartphone className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Burhan2WS</h1>
              <p className="text-white/80 text-sm">WhatsApp Gateway</p>
            </div>
          </div>

          <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
            WhatsApp Blast
            <br />
            <span className="bg-gradient-to-r from-cyan-300 to-pink-300 bg-clip-text text-transparent">
              & Bot System
            </span>
          </h2>

          <p className="text-lg text-white/90 mb-8 leading-relaxed">
            Connect your WhatsApp in seconds. Scan QR code and you're ready!
          </p>

          {/* Features - Compact */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 bg-white/20 backdrop-blur-xl rounded-lg flex items-center justify-center border border-white/30 flex-shrink-0">
                <ShieldCheck className="text-cyan-300" size={16} />
              </div>
              <span className="text-white/90">100% Secure & Encrypted</span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 bg-white/20 backdrop-blur-xl rounded-lg flex items-center justify-center border border-white/30 flex-shrink-0">
                <QrCode className="text-pink-300" size={16} />
              </div>
              <span className="text-white/90">Instant QR Connection</span>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 bg-white/20 backdrop-blur-xl rounded-lg flex items-center justify-center border border-white/30 flex-shrink-0">
                <Smartphone className="text-purple-300" size={16} />
              </div>
              <span className="text-white/90">Multiple Sessions Support</span>
            </div>
          </div>
        </div>

        {/* Bottom Stats - Compact */}
        <div className="relative z-10 flex gap-6 text-sm">
          <div>
            <div className="text-2xl font-bold text-white">10K+</div>
            <div className="text-white/70 text-xs">Active Users</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">1M+</div>
            <div className="text-white/70 text-xs">Messages</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">99.9%</div>
            <div className="text-white/70 text-xs">Uptime</div>
          </div>
        </div>
      </div>

      {/* Right Section - QR Code */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 lg:p-6">
        <div className="w-full max-w-md">
          {/* Logo - Mobile Only */}
          <div className="lg:hidden text-center mb-4 animate-fade-in">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl shadow-lg mb-3">
              <Smartphone className="text-white" size={28} />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Burhan2WS
            </h1>
          </div>

          {/* Main Card */}
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl p-5 lg:p-6 border border-indigo-100 animate-scale-in">
            {status === 'connecting' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 relative">
                  <div className="absolute inset-0 rounded-full border-3 border-indigo-100"></div>
                  <div className="absolute inset-0 rounded-full border-3 border-indigo-600 border-t-transparent animate-spin"></div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Starting Session</h3>
                <p className="text-gray-500 text-sm">Connecting to WhatsApp...</p>
              </div>
            )}

            {status === 'qr' && (
              <div className="text-center">
                {/* Header - Compact */}
                <div className="mb-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl shadow-lg mb-3">
                    <QrCode className="text-white" size={24} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Scan QR Code</h2>
                  <p className="text-gray-600 text-sm">
                    WhatsApp → <strong>Linked Devices</strong> → <strong>Link a Device</strong>
                  </p>
                </div>

                {/* QR Code - Compact */}
                {localQrCode ? (
                  <div className="relative inline-block mb-4 animate-fade-in">
                    <div className="bg-white p-4 rounded-xl shadow-lg border border-indigo-100">
                      <QRCodeCanvas
                        value={localQrCode}
                        size={200}
                        level="M"
                        includeMargin={true}
                      />
                    </div>
                    {/* Corner Badges - Smaller */}
                    <div className="absolute -top-2 -left-2 w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center shadow-md">
                      <ShieldCheck className="text-white" size={16} />
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-8 rounded-xl inline-block mb-4">
                    <div className="w-14 h-14 mx-auto mb-3 relative">
                      <div className="absolute inset-0 rounded-full border-3 border-indigo-200"></div>
                      <div className="absolute inset-0 rounded-full border-3 border-indigo-600 border-t-transparent animate-spin"></div>
                    </div>
                    <p className="text-gray-600 font-medium text-sm">Loading QR...</p>
                  </div>
                )}

                {/* Button */}
                <button
                  onClick={handleRefresh}
                  className="btn-modern w-full flex items-center justify-center gap-2 py-3 text-sm"
                >
                  <RefreshCw size={16} />
                  Get New QR Code
                </button>

                {/* Instructions - Compact */}
                <div className="mt-4 p-3 bg-gradient-to-br from-gray-50 to-indigo-50 rounded-xl text-left">
                  <h3 className="text-xs font-bold text-gray-900 mb-2 flex items-center">
                    <Smartphone className="mr-1 text-indigo-600" size={14} />
                    How to connect:
                  </h3>
                  <ol className="space-y-1.5 text-xs">
                    {['Open WhatsApp', 'Tap Settings', 'Linked Devices', 'Link a Device', 'Scan QR'].map((step, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <div className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white text-xs font-bold flex-shrink-0">
                          {index + 1}
                        </div>
                        <span className="text-gray-700">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}

            {status === 'connected' && phoneNumber && (
              <div className="text-center py-8 animate-scale-in">
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center shadow-xl animate-pulse-glow">
                  <ShieldCheck className="text-white" size={36} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Connected! 🎉</h2>
                <p className="text-gray-600 text-sm mb-4">WhatsApp connected successfully</p>
                <div className="inline-block px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold shadow-md mb-4 text-sm">
                  {phoneNumber}
                </div>
                <div className="flex justify-center">
                  <div className="w-6 h-6 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-gray-500 text-xs mt-3">Redirecting...</p>
              </div>
            )}

            {status === 'error' && (
              <div className="text-center py-8 animate-scale-in">
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-red-400 to-rose-500 rounded-full flex items-center justify-center shadow-xl">
                  <span className="text-4xl">⚠️</span>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">Connection Error</h2>
                <p className="text-red-600 text-sm mb-4">{error}</p>
                <button
                  onClick={handleRefresh}
                  className="btn-modern px-8 py-3"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
