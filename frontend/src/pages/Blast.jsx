import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../hooks/useSession';
import * as api from '../services/api';
const blastApi = api.blastApi;
import {
  IconSend as Send,
  IconPlus as Plus,
  IconClock as Clock,
  IconCalendar as Calendar,
  IconUsers as Users,
  IconFileText as FileText,
  IconTrash as Trash2,
  IconCircleCheck as CheckCircle,
  IconCircleX as XCircle,
  IconAlertCircle as AlertCircle,
  IconLoader2 as Loader2,
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils';

export default function Blast() {
  const queryClient = useQueryClient();
  const { session, sessionId, isConnected, isLoading: sessionLoading } = useSession();
  const [recipients, setRecipients] = useState('');
  const [message, setMessage] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');

  // Fetch blasts history
  const { data: blastsData, isLoading } = useQuery({
    queryKey: ['blasts'],
    queryFn: () => blastApi.getAll().then((res) => res.data),
    refetchInterval: 10000,
    enabled: isConnected,
  });

  // Quick send mutation
  const quickSendMutation = useMutation({
    mutationFn: (data) => blastApi.quickSend(data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries(['blasts']);
      setRecipients('');
      setMessage('');
      alert('Messages queued successfully!');
    },
    onError: (error) => {
      alert(`Error: ${error.response?.data?.error || error.message}`);
    },
  });

  // Create blast mutation
  const createBlastMutation = useMutation({
    mutationFn: (data) => blastApi.create(data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries(['blasts']);
      setRecipients('');
      setMessage('');
      setScheduledFor('');
      alert('Blast campaign created successfully!');
    },
    onError: (error) => {
      alert(`Error: ${error.response?.data?.error || error.message}`);
    },
  });

  const blasts = blastsData?.data?.blasts || [];

  const handleQuickSend = () => {
    if (!isConnected) {
      alert('Please connect your WhatsApp first');
      return;
    }
    if (!recipients.trim() || !message.trim()) {
      alert('Please fill in recipients and message');
      return;
    }

    const recipientsArray = recipients.split(',').map((r) => r.trim()).filter(Boolean);

    quickSendMutation.mutate({
      sessionId: session?.id,
      recipients: recipientsArray,
      message,
    });
  };

  const handleScheduleBlast = () => {
    if (!isConnected) {
      alert('Please connect your WhatsApp first');
      return;
    }
    if (!recipients.trim() || !message.trim() || !scheduledFor) {
      alert('Please fill in all fields including scheduled time');
      return;
    }

    const recipientsArray = recipients.split(',').map((r) => r.trim()).filter(Boolean);

    createBlastMutation.mutate({
      sessionId: session?.id,
      name: `Blast ${new Date().toLocaleString()}`,
      recipients: recipientsArray,
      message,
      scheduledFor: new Date(scheduledFor).toISOString(),
    });
  };

  const getBlastStatusConfig = (status) => {
    switch (status) {
      case 'completed':
        return { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'Completed' };
      case 'failed':
        return { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Failed' };
      case 'processing':
      case 'active':
        return { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Processing' };
      case 'scheduled':
        return { icon: Calendar, color: 'text-purple-400', bg: 'bg-purple-500/20', label: 'Scheduled' };
      case 'cancelled':
        return { icon: XCircle, color: 'text-gray-400', bg: 'bg-gray-500/20', label: 'Cancelled' };
      default:
        return { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Waiting' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="card-modern p-6">
        <div className="flex items-center gap-4">
          <div className="iso-icon p-3 bg-gradient-to-br from-purple-500 to-pink-500">
            <Send className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold gradient-text">Blast Messages</h1>
            <p className="text-slate-400 text-sm">Send bulk messages to multiple recipients</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Send Form */}
        <div className="xl:col-span-2 space-y-6">
          {/* New Blast Card */}
          <div className="card-modern p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-purple-400" />
              New Blast
            </h2>

            <div className="space-y-4">
              {/* Connection Status */}
              {!isConnected && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <p className="text-yellow-400 text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Please connect your WhatsApp first at <a href="/sessions" className="underline">Sessions page</a>
                  </p>
                </div>
              )}

              {isConnected && session?.phoneNumber && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                  <p className="text-emerald-400 text-sm">
                    Connected: {session.phoneNumber}
                  </p>
                </div>
              )}

              {/* Recipients */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Recipients (comma-separated phone numbers)
                </label>
                <textarea
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  placeholder="+60123456789, +60198765432, ..."
                  className="w-full h-32 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">
                  {recipients.split(',').filter(Boolean).length} recipients
                </p>
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message here..."
                  className="w-full h-40 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">{message.length} characters</p>
              </div>

              {/* Schedule (Optional) */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Schedule (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleQuickSend}
                  disabled={quickSendMutation.isLoading || !isConnected || !recipients || !message}
                  className="flex-1 btn-modern px-6 py-3 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {quickSendMutation.isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                  Send Now
                </button>

                {scheduledFor && (
                  <button
                    onClick={handleScheduleBlast}
                    disabled={createBlastMutation.isLoading}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {createBlastMutation.isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Calendar className="h-5 w-5" />
                    )}
                    Schedule
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Blast History */}
        <div className="xl:col-span-1">
          <div className="card-modern p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-400" />
              History
            </h2>

            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
              </div>
            ) : blasts.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">No blast campaigns yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {blasts.map((blast) => {
                  const statusConfig = getBlastStatusConfig(blast.status);
                  const StatusIcon = statusConfig.icon;

                  return (
                    <motion.div
                      key={blast.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white">
                            {blast.data?.name || `Blast ${new Date(blast.createdAt).toLocaleDateString()}`}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            {new Date(blast.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className={cn('flex items-center gap-1 px-2 py-1 rounded-lg', statusConfig.bg)}>
                          <StatusIcon className={cn('h-3 w-3', statusConfig.color, blast.status === 'processing' && 'animate-spin')} />
                          <span className={cn('text-xs font-semibold', statusConfig.color)}>
                            {statusConfig.label}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>{blast.data?.totalRecipients || 0} recipients</span>
                        </div>
                        {blast.data?.sentCount > 0 && (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-emerald-400" />
                            <span>{blast.data.sentCount} sent</span>
                          </div>
                        )}
                        {blast.data?.failedCount > 0 && (
                          <div className="flex items-center gap-1">
                            <XCircle className="h-3 w-3 text-red-400" />
                            <span>{blast.data.failedCount} failed</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
