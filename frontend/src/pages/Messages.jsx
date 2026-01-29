import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '../hooks/useSession';
import * as api from '../services/api';
const messagesApi = api.messagesApi;
import {
  IconMessage2 as MessageSquare,
  IconInbox as Inbox,
  IconSend as Send,
  IconLoader2 as Loader2,
  IconSearch as Search,
  IconFilter as Filter,
  IconUser as User,
  IconRobot as Robot,
  IconCheck as Check,
  IconClock as Clock,
  IconX as X,
  IconAlertCircle as AlertCircle,
} from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { cn } from '../utils';

export default function Messages() {
  const { session, sessionId, isConnected, isLoading: sessionLoading } = useSession();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterDirection, setFilterDirection] = useState('all');

  // Fetch messages
  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['messages', sessionId, filterType, filterDirection],
    queryFn: () =>
      messagesApi
        .getBySession(sessionId, {
          limit: 100,
          type: filterType !== 'all' ? filterType : undefined,
        })
        .then((res) => res.data),
    enabled: !!sessionId && isConnected,
    refetchInterval: 5000,
  });

  const messages = messagesData?.data || [];

  // Filter messages based on search and direction
  const filteredMessages = messages.filter((msg) => {
    const matchesSearch =
      !searchQuery ||
      msg.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.to.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDirection =
      filterDirection === 'all' || msg.direction === filterDirection;

    return matchesSearch && matchesDirection;
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent':
        return <Check className="h-4 w-4 text-emerald-400" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-400" />;
      case 'failed':
        return <X className="h-4 w-4 text-red-400" />;
      default:
        return <Clock className="h-4 w-4 text-slate-400" />;
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="card-modern p-6">
        <div className="flex items-center gap-4">
          <div className="iso-icon p-3 bg-gradient-to-br from-emerald-500 to-teal-500">
            <MessageSquare className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold gradient-text">Messages</h1>
            <p className="text-slate-400 text-sm">View message history</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="xl:col-span-3 space-y-6">
          {/* Connection Status & Filters */}
          <div className="card-modern p-6">
            {!isConnected && (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl mb-4">
                <p className="text-yellow-400 text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Please connect your WhatsApp first at <a href="/sessions" className="underline">Sessions page</a>
                </p>
              </div>
            )}

            {isConnected && session?.phoneNumber && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl mb-4">
                <p className="text-emerald-400 text-sm">
                  Connected: {session.phoneNumber}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Message Type
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition"
                >
                  <option value="all">All Types</option>
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="audio">Audio</option>
                  <option value="document">Document</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Direction
                </label>
                <select
                  value={filterDirection}
                  onChange={(e) => setFilterDirection(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition"
                >
                  <option value="all">All Directions</option>
                  <option value="inbound">Inbound (Received)</option>
                  <option value="outbound">Outbound (Sent)</option>
                </select>
              </div>
            </div>

            {/* Search */}
            {isConnected && (
              <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search messages..."
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            )}
          </div>

          {/* Messages List */}
          {isConnected && (
            <div className="card-modern p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Inbox className="h-5 w-5 text-emerald-400" />
                  Message History
                </h2>
                <span className="text-sm text-slate-400">
                  {filteredMessages.length} {filteredMessages.length === 1 ? 'message' : 'messages'}
                </span>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No messages found</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {filteredMessages.map((msg, index) => (
                    <motion.div
                      key={msg.id || index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        'p-4 rounded-xl border transition',
                        msg.direction === 'inbound'
                          ? 'bg-blue-500/10 border-blue-500/30 ml-0'
                          : 'bg-emerald-500/10 border-emerald-500/30 ml-8'
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {msg.direction === 'inbound' ? (
                            <div className="p-2 rounded-lg bg-blue-500/20">
                              <User className="h-4 w-4 text-blue-400" />
                            </div>
                          ) : (
                            <div className="p-2 rounded-lg bg-emerald-500/20">
                              <Send className="h-4 w-4 text-emerald-400" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {msg.direction === 'inbound' ? msg.from : 'To: ' + msg.to}
                            </p>
                            <p className="text-xs text-slate-400">
                              {formatTimestamp(msg.timestamp)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {getStatusIcon(msg.status)}
                          <span className={cn(
                            'text-xs px-2 py-1 rounded-lg',
                            msg.messageType === 'text' ? 'bg-slate-700 text-slate-300' : 'bg-purple-500/20 text-purple-400'
                          )}>
                            {msg.messageType}
                          </span>
                        </div>
                      </div>

                      {msg.content && (
                        <div className={cn(
                          'p-3 rounded-lg text-sm',
                          msg.direction === 'inbound'
                            ? 'bg-blue-500/10 text-blue-100'
                            : 'bg-emerald-500/10 text-emerald-100'
                        )}>
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        </div>
                      )}

                      {msg.messageType !== 'text' && !msg.content && (
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                          <Robot className="h-4 w-4" />
                          <span>[{msg.messageType} message]</span>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stats Panel */}
        <div className="xl:col-span-1">
          <div className="card-modern p-6 sticky top-6">
            <h2 className="text-lg font-bold text-white mb-4">Statistics</h2>

            {isConnected ? (
              <div className="space-y-4">
                <div className="p-4 bg-slate-800/30 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">Total Messages</span>
                    <MessageSquare className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold text-white">{messages.length}</div>
                </div>

                <div className="p-4 bg-slate-800/30 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">Sent</span>
                    <Send className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {messages.filter((m) => m.direction === 'outbound').length}
                  </div>
                </div>

                <div className="p-4 bg-slate-800/30 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">Received</span>
                    <Inbox className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {messages.filter((m) => m.direction === 'inbound').length}
                  </div>
                </div>

                <div className="p-4 bg-slate-800/30 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">Text Messages</span>
                    <Filter className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {messages.filter((m) => m.messageType === 'text').length}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Select a session to view statistics</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
