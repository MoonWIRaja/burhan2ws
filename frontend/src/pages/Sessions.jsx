import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { sessionsApi } from '../services/api';
import { LoadingSpinner } from '../components/UI';
import { useSocket } from '../providers/SocketProvider';
import QRCodeModal from '../components/QRCodeModal';
import {
  Smartphone,
  Plus,
  Power,
  RefreshCw,
  QrCode,
  MessageSquare,
  FileText,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  MoreVertical,
  ArrowUpRight
} from 'lucide-react';

export default function Sessions() {
  const { socket, isConnected, qrCode, qrSessionId, closeQrCode } = useSocket();
  const queryClient = useQueryClient();
  const [newSessionId, setNewSessionId] = useState('');

  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionsApi.getAll().then((res) => res.data),
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: (data) => sessionsApi.create(data).then((res) => res.data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['sessions']);

      // Join the session room FIRST, before creating
      console.log('🔗 Sessions: Joining session room BEFORE creation:', variables.sessionId);
      socket.emit('join-session', variables.sessionId);

      setNewSessionId('');
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (id) => sessionsApi.disconnect(id).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries(['sessions']);
    },
  });

  const handleCreateSession = (e) => {
    e.preventDefault();
    if (!newSessionId.trim()) return;

    // Join the session room FIRST
    console.log('🔗 Sessions: Joining session room BEFORE creation:', newSessionId);
    socket.emit('join-session', newSessionId);

    createMutation.mutate({ sessionId: newSessionId });
  };

  const handleDisconnect = (id, sessionId) => {
    if (window.confirm(`Are you sure you want to disconnect session ${sessionId}?`)) {
      disconnectMutation.mutate(id);
    }
  };

  const handleRefreshQr = (sessionId) => {
    socket.emit('join-session', sessionId);
    socket.emit('request-qr', sessionId);
  };

  const sessions = sessionsData?.data?.sessions || [];

  const getStatusConfig = (status) => {
    switch (status) {
      case 'connected':
        return {
          icon: CheckCircle,
          color: 'emerald',
          bg: 'bg-emerald-500/20',
          text: 'text-emerald-400',
          border: 'border-emerald-500/30',
          label: 'Connected'
        };
      case 'qr':
        return {
          icon: QrCode,
          color: 'yellow',
          bg: 'bg-yellow-500/20',
          text: 'text-yellow-400',
          border: 'border-yellow-500/30',
          label: 'QR Code'
        };
      case 'connecting':
        return {
          icon: Clock,
          color: 'purple',
          bg: 'bg-purple-500/20',
          text: 'text-purple-400',
          border: 'border-purple-500/30',
          label: 'Connecting'
        };
      case 'disconnected':
        return {
          icon: XCircle,
          color: 'red',
          bg: 'bg-red-500/20',
          text: 'text-red-400',
          border: 'border-red-500/30',
          label: 'Disconnected'
        };
      default:
        return {
          icon: Clock,
          color: 'slate',
          bg: 'bg-slate-500/20',
          text: 'text-slate-400',
          border: 'border-slate-500/30',
          label: status
        };
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header - Compact */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Sessions</h1>
        </div>
        <div className="stats-card px-4 py-2">
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <div className="text-lg font-bold gradient-text">{sessions.length}</div>
              <div className="text-xs text-slate-400">Total</div>
            </div>
            <div className="w-px h-4 bg-slate-700"></div>
            <div className="text-center">
              <div className="text-lg font-bold text-emerald-400">
                {sessions.filter(s => s.status === 'connected').length}
              </div>
              <div className="text-xs text-slate-400">Connected</div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Session Form - Compact */}
      <div className="card-modern p-4">
        <form onSubmit={handleCreateSession} className="flex gap-3">
          <input
            type="text"
            placeholder="Session ID (e.g., my-session)"
            value={newSessionId}
            onChange={(e) => setNewSessionId(e.target.value)}
            className="input-modern flex-1 px-4 py-2 text-sm"
            required
          />
          <button
            type="submit"
            disabled={createMutation.isLoading || !newSessionId.trim()}
            className="btn-modern px-6 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Plus size={16} />
            Create
          </button>
        </form>
      </div>

      {/* Sessions List - Compact Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="spinner"></div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="stats-card text-center py-12">
          <div className="iso-icon p-4 bg-gradient-to-br from-slate-600 to-slate-700 mx-auto mb-4">
            <Smartphone className="text-slate-400" size={32} />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">No Sessions Yet</h3>
          <p className="text-slate-400 text-sm mb-4">Create your first WhatsApp session</p>
          <button
            onClick={() => document.querySelector('input[type="text"]').focus()}
            className="btn-modern px-6 py-2 text-sm"
          >
            <Plus size={16} className="mr-2" />
            Create Session
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sessions.map((session, index) => {
            const statusConfig = getStatusConfig(session.status);
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={session.id}
                className="card-modern p-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`iso-icon p-3 bg-gradient-to-br ${
                      session.status === 'connected' ? 'from-emerald-500 to-teal-500' :
                      session.status === 'qr' ? 'from-yellow-500 to-orange-500' :
                      session.status === 'connecting' ? 'from-purple-500 to-pink-500' :
                      'from-slate-600 to-slate-700'
                    }`}>
                      <Smartphone className="text-white" size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white truncate max-w-[120px]">{session.sessionId}</h3>
                      <p className="text-xs text-slate-400 truncate max-w-[120px]">
                        {session.phoneNumber || 'Not connected'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg ${statusConfig.bg} ${statusConfig.border} border mb-3`}>
                  <StatusIcon className={statusConfig.text} size={14} />
                  <span className={`text-xs font-semibold ${statusConfig.text}`}>
                    {statusConfig.label}
                  </span>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="stats-card p-2 text-center">
                    <div className="text-base font-bold text-white">
                      {session._count?.messages || 0}
                    </div>
                    <div className="text-xs text-slate-400">Messages</div>
                  </div>

                  <div className="stats-card p-2 text-center">
                    <div className="text-base font-bold text-white">
                      {session._count?.files || 0}
                    </div>
                    <div className="text-xs text-slate-400">Files</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {session.status === 'connected' ? (
                    <button
                      onClick={() => handleDisconnect(session.id, session.sessionId)}
                      className="flex-1 nav-item py-2 px-3 text-sm"
                    >
                      <Power className="text-red-400" size={16} />
                      <div className="flex-1 text-left">
                        <div className="font-medium text-sm">Disconnect</div>
                      </div>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRefreshQr(session.sessionId)}
                      className="flex-1 nav-item py-2 px-3 text-sm"
                    >
                      <RefreshCw className="text-purple-400" size={16} />
                      <div className="flex-1 text-left">
                        <div className="font-medium text-sm">Connect</div>
                      </div>
                    </button>
                  )}
                </div>

                {/* Timestamps */}
                <div className="mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-400">
                  <div className="flex items-center justify-between">
                    <span>Created:</span>
                    <span className="text-slate-300 font-medium">
                      {new Date(session.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QR Code Modal */}
      <QRCodeModal
        qrCode={qrCode}
        sessionId={qrSessionId}
        onClose={closeQrCode}
        onRefresh={() => qrSessionId && handleRefreshQr(qrSessionId)}
      />
    </div>
  );
}
