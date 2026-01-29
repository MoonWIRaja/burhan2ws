import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../hooks/useSession';
import * as api from '../services/api';
const botApi = api.botApi;
import {
  IconRobot as Robot,
  IconPlus as Plus,
  IconEdit as Edit,
  IconTrash as Trash2,
  IconToggleLeft as ToggleLeft,
  IconToggleRight as ToggleRight,
  IconTestPipe as Test,
  IconLoader2 as Loader2,
  IconDeviceFloppy as Save,
  IconX as X,
  IconMessage2 as MessageSquare,
  IconCheck as Check,
  IconAlertCircle as AlertCircle,
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils';

export default function Bot() {
  const queryClient = useQueryClient();
  const { session, sessionId, isConnected, isLoading: sessionLoading } = useSession();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    keyword: '',
    response: '',
    matchType: 'contains',
    isEnabled: true,
  });

  // Fetch bot rules
  const { data: rulesData, isLoading } = useQuery({
    queryKey: ['bot-rules', sessionId],
    queryFn: () => botApi.getAll(sessionId).then((res) => res.data),
    enabled: !!sessionId && isConnected,
    refetchInterval: 5000,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data) => botApi.create(data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries(['bot-rules']);
      resetForm();
      alert('Bot rule created successfully!');
    },
    onError: (error) => {
      alert(`Error: ${error.response?.data?.error || error.message}`);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => botApi.update(id, data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries(['bot-rules']);
      resetForm();
      setEditingRule(null);
      alert('Bot rule updated successfully!');
    },
    onError: (error) => {
      alert(`Error: ${error.response?.data?.error || error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => botApi.delete(id).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries(['bot-rules']);
      alert('Bot rule deleted successfully!');
    },
  });

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: (id) => botApi.toggle(id).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries(['bot-rules']);
    },
  });

  // Test mutation
  const testMutation = useMutation({
    mutationFn: (data) => botApi.test(data).then((res) => res.data),
    onSuccess: (data) => {
      setTestResult(data.data);
    },
  });

  const rules = rulesData?.data?.rules || [];

  const resetForm = () => {
    setFormData({
      name: '',
      keyword: '',
      response: '',
      matchType: 'contains',
      isEnabled: true,
    });
    setShowAddForm(false);
    setEditingRule(null);
  };

  const handleSave = () => {
    if (!isConnected) {
      alert('Please connect your WhatsApp first');
      return;
    }
    if (!formData.name || !formData.keyword || !formData.response) {
      alert('Please fill in all required fields');
      return;
    }

    if (editingRule) {
      updateMutation.mutate({
        id: editingRule.id,
        data: {
          ...formData,
          sessionId: session.id,
        },
      });
    } else {
      createMutation.mutate({
        ...formData,
        sessionId: session.id,
      });
    }
  };

  const handleEdit = (rule) => {
    setFormData({
      name: rule.name,
      keyword: rule.keyword,
      response: rule.response,
      matchType: rule.matchType,
      isEnabled: rule.isEnabled,
    });
    setEditingRule(rule);
    setShowAddForm(true);
  };

  const handleTest = () => {
    if (!isConnected || !testMessage) {
      alert('Please connect your WhatsApp and enter a test message');
      return;
    }

    testMutation.mutate({
      sessionId: session.id,
      message: testMessage,
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="card-modern p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="iso-icon p-3 bg-gradient-to-br from-pink-500 to-rose-500">
              <Robot className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold gradient-text">Auto-Reply Bot</h1>
              <p className="text-slate-400 text-sm">Configure automated responses</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="xl:col-span-2 space-y-6">
          {/* Connection Status & Add Button */}
          <div className="card-modern p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1 mr-4">
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
              </div>

              <button
                onClick={() => {
                  resetForm();
                  setShowAddForm(true);
                }}
                disabled={!isConnected}
                className="btn-modern px-6 py-3 mt-6 flex items-center gap-2 disabled:opacity-50"
              >
                <Plus className="h-5 w-5" />
                Add Rule
              </button>
            </div>

            {/* Add/Edit Form */}
            <AnimatePresence>
              {showAddForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-slate-700 pt-4 mt-4"
                >
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Rule Name
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Greeting, FAQ, Support"
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Keyword / Trigger
                      </label>
                      <input
                        type="text"
                        value={formData.keyword}
                        onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                        placeholder="e.g., hello, help, price"
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Match Type
                      </label>
                      <select
                        value={formData.matchType}
                        onChange={(e) => setFormData({ ...formData, matchType: e.target.value })}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500 transition"
                      >
                        <option value="contains">Contains (default)</option>
                        <option value="exact">Exact Match</option>
                        <option value="regex">Regex</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Response
                      </label>
                      <textarea
                        value={formData.response}
                        onChange={(e) => setFormData({ ...formData, response: e.target.value })}
                        placeholder="Type the auto-reply message..."
                        rows={4}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 transition resize-none"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handleSave}
                        disabled={createMutation.isLoading || updateMutation.isLoading}
                        className="flex-1 btn-modern px-6 py-3 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {createMutation.isLoading || updateMutation.isLoading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Save className="h-5 w-5" />
                        )}
                        {editingRule ? 'Update' : 'Save'} Rule
                      </button>
                      <button
                        onClick={resetForm}
                        className="px-6 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition flex items-center gap-2"
                      >
                        <X className="h-5 w-5" />
                        Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Rules List */}
          {isConnected && (
            <div className="card-modern p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-pink-400" />
                Bot Rules
              </h2>

              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin text-pink-400" />
                </div>
              ) : rules.length === 0 ? (
                <div className="text-center py-8">
                  <Robot className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No bot rules configured</p>
                  <p className="text-slate-500 text-xs mt-1">Click "Add Rule" to create one</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rules.map((rule) => (
                    <motion.div
                      key={rule.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-base font-semibold text-white">{rule.name}</h3>
                            <span className="text-xs px-2 py-1 rounded-lg bg-slate-700 text-slate-300">
                              {rule.matchType}
                            </span>
                            {!rule.isEnabled && (
                              <span className="text-xs px-2 py-1 rounded-lg bg-red-500/20 text-red-400">
                                Disabled
                              </span>
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-slate-400">
                              <span className="text-pink-400 font-medium">Keyword:</span> {rule.keyword}
                            </p>
                            <p className="text-sm text-slate-400">
                              <span className="text-pink-400 font-medium">Response:</span> {rule.response}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleMutation.mutate(rule.id)}
                            className={cn(
                              'p-2 rounded-lg transition',
                              rule.isEnabled
                                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                            )}
                          >
                            {rule.isEnabled ? (
                              <ToggleRight className="h-5 w-5" />
                            ) : (
                              <ToggleLeft className="h-5 w-5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleEdit(rule)}
                            className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('Are you sure you want to delete this rule?')) {
                                deleteMutation.mutate(rule.id);
                              }
                            }}
                            className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Test Panel */}
        <div className="xl:col-span-1">
          <div className="card-modern p-6 sticky top-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Test className="h-5 w-5 text-pink-400" />
              Test Bot
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Test Message
                </label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Type a message to test bot responses..."
                  rows={4}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 transition resize-none"
                />
              </div>

              <button
                onClick={handleTest}
                disabled={testMutation.isLoading || !isConnected || !testMessage}
                className="w-full btn-modern px-6 py-3 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {testMutation.isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Test className="h-5 w-5" />
                )}
                Test
              </button>

              {/* Test Result */}
              <AnimatePresence>
                {testResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={cn(
                      'p-4 rounded-xl border',
                      testResult.matched
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-yellow-500/10 border-yellow-500/30'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {testResult.matched ? (
                        <Check className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-white mb-1">
                          {testResult.matched ? 'Rule Matched!' : 'No Match'}
                        </p>
                        {testResult.rule && (
                          <p className="text-xs text-slate-400 mb-2">
                            Matched: {testResult.rule.name}
                          </p>
                        )}
                        {testResult.response && (
                          <div className="p-3 bg-slate-800/50 rounded-lg">
                            <p className="text-xs text-slate-300">{testResult.response}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
