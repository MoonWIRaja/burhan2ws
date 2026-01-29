import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../hooks/useSession';
import * as api from '../services/api';
const contactsApi = api.contactsApi;
import {
  IconUsers as Users,
  IconPlus as Plus,
  IconEdit as Edit,
  IconTrash as Trash2,
  IconSearch as Search,
  IconTag as Tag,
  IconMail as Mail,
  IconPhone as Phone,
  IconLoader2 as Loader2,
  IconDeviceFloppy as Save,
  IconX as X,
  IconUpload as Upload,
  IconFileText as FileText,
  IconAlertCircle as AlertCircle,
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils';

export default function Contact() {
  const queryClient = useQueryClient();
  const { session, sessionId, isConnected, isLoading: sessionLoading } = useSession();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    tags: [],
    notes: '',
  });

  // Fetch contacts
  const { data: contactsData, isLoading } = useQuery({
    queryKey: ['contacts', sessionId, searchQuery, selectedTags],
    queryFn: () =>
      contactsApi
        .getAll(sessionId, {
          search: searchQuery || undefined,
          tags: selectedTags.length > 0 ? selectedTags.join(',') : undefined,
        })
        .then((res) => res.data),
    enabled: !!sessionId && isConnected,
    refetchInterval: 5000,
  });

  // Fetch tags
  const { data: tagsData } = useQuery({
    queryKey: ['contact-tags', sessionId],
    queryFn: () => contactsApi.getTags(sessionId).then((res) => res.data),
    enabled: !!sessionId && isConnected,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data) => contactsApi.create(data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries(['contacts']);
      queryClient.invalidateQueries(['contact-tags']);
      resetForm();
      alert('Contact created successfully!');
    },
    onError: (error) => {
      alert(`Error: ${error.response?.data?.error || error.message}`);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => contactsApi.update(id, data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries(['contacts']);
      resetForm();
      setEditingContact(null);
      alert('Contact updated successfully!');
    },
    onError: (error) => {
      alert(`Error: ${error.response?.data?.error || error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => contactsApi.delete(id).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries(['contacts']);
      alert('Contact deleted successfully!');
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: (data) => contactsApi.import(data).then((res) => res.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['contacts']);
      queryClient.invalidateQueries(['contact-tags']);
      alert(`${data.data.imported} contacts imported successfully!`);
    },
    onError: (error) => {
      alert(`Error: ${error.response?.data?.error || error.message}`);
    },
  });

  const contacts = contactsData?.data?.contacts || [];
  const tags = tagsData?.data?.tags || [];

  const resetForm = () => {
    setFormData({
      name: '',
      phoneNumber: '',
      email: '',
      tags: [],
      notes: '',
    });
    setShowAddForm(false);
    setEditingContact(null);
  };

  const handleSave = () => {
    if (!isConnected) {
      alert('Please select a session first');
      return;
    }
    if (!formData.phoneNumber) {
      alert('Phone number is required');
      return;
    }

    const session = session;

    if (editingContact) {
      updateMutation.mutate({
        id: editingContact.id,
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

  const handleEdit = (contact) => {
    setFormData({
      name: contact.name || '',
      phoneNumber: contact.phoneNumber,
      email: contact.email || '',
      tags: contact.tags || [],
      notes: contact.notes || '',
    });
    setEditingContact(contact);
    setShowAddForm(true);
  };

  const toggleTag = (tag) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const handleAddTag = (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      const newTag = e.target.value.trim();
      if (!formData.tags.includes(newTag)) {
        setFormData({ ...formData, tags: [...formData.tags, newTag] });
      }
      e.target.value = '';
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tagToRemove) });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="card-modern p-6">
        <div className="flex items-center gap-4">
          <div className="iso-icon p-3 bg-gradient-to-br from-cyan-500 to-blue-500">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold gradient-text">Contacts</h1>
            <p className="text-slate-400 text-sm">Manage your contacts</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="xl:col-span-2 space-y-6">
          {/* Connection Status & Actions */}
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

              <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => {
                      resetForm();
                      setShowAddForm(true);
                    }}
                    className="btn-modern px-6 py-3 flex items-center gap-2"
                  >
                    <Plus className="h-5 w-5" />
                    Add Contact
                  </button>
                  <button
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.json,.csv';
                      input.onchange = async (e) => {
                        const file = e.target.files[0];
                        const text = await file.text();
                        try {
                          const data = JSON.parse(text);
                          importMutation.mutate({
                            sessionId: session.id,
                            contacts: Array.isArray(data) ? data : [data],
                          });
                        } catch (err) {
                          alert('Invalid file format. Please upload JSON or CSV.');
                        }
                      };
                      input.click();
                    }}
                    className="px-6 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition flex items-center gap-2"
                  >
                    <Upload className="h-5 w-5" />
                    Import
                  </button>
                </div>
              )}
            </div>

            {/* Search & Filter */}
            {isConnected && (
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search contacts..."
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>
              </div>
            )}

            {/* Tags Filter */}
            {isConnected && tags.length > 0 && (
              <div className="mt-4">
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition',
                        selectedTags.includes(tag)
                          ? 'bg-cyan-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      )}
                    >
                      <Tag className="h-3 w-3 inline mr-1" />
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Name
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="John Doe"
                          className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Phone Number *
                        </label>
                        <input
                          type="text"
                          value={formData.phoneNumber}
                          onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                          placeholder="+60123456789"
                          className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="john@example.com"
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Tags (press Enter to add)
                      </label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {formData.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-lg text-xs font-medium flex items-center gap-1"
                          >
                            {tag}
                            <button onClick={() => handleRemoveTag(tag)} className="hover:text-cyan-300">
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="Add a tag..."
                        onKeyDown={handleAddTag}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Notes
                      </label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Additional notes..."
                        rows={3}
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition resize-none"
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
                        {editingContact ? 'Update' : 'Save'} Contact
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

          {/* Contacts List */}
          {isConnected && (
            <div className="card-modern p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-cyan-400" />
                All Contacts ({contacts.length})
              </h2>

              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No contacts found</p>
                  <p className="text-slate-500 text-xs mt-1">Add your first contact or import from file</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {contacts.map((contact) => (
                    <motion.div
                      key={contact.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        'p-4 rounded-xl border transition',
                        contact.isBlocked
                          ? 'bg-red-500/10 border-red-500/30'
                          : 'bg-slate-800/30 border-slate-700/50'
                      )}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-white">
                            {contact.name || 'Unknown'}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
                            <Phone className="h-3 w-3" />
                            <span>{contact.phoneNumber}</span>
                          </div>
                          {contact.email && (
                            <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
                              <Mail className="h-3 w-3" />
                              <span>{contact.email}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(contact)}
                            className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('Are you sure you want to delete this contact?')) {
                                deleteMutation.mutate(contact.id);
                              }
                            }}
                            className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {contact.tags && contact.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {contact.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded-lg text-xs font-medium"
                            >
                              <Tag className="h-3 w-3 inline mr-1" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {contact.notes && (
                        <p className="text-xs text-slate-400 mt-2 line-clamp-2">{contact.notes}</p>
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
          <div className="card-modern p-6">
            <h2 className="text-lg font-bold text-white mb-4">Statistics</h2>

            {isConnected ? (
              <div className="space-y-4">
                <div className="p-4 bg-slate-800/30 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">Total Contacts</span>
                    <Users className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div className="text-2xl font-bold text-white">{contacts.length}</div>
                </div>

                <div className="p-4 bg-slate-800/30 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">Total Tags</span>
                    <Tag className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="text-2xl font-bold text-white">{tags.length}</div>
                </div>

                <div className="p-4 bg-slate-800/30 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">Blocked</span>
                    <X className="h-4 w-4 text-red-400" />
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {contacts.filter((c) => c.isBlocked).length}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Select a session to view statistics</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
