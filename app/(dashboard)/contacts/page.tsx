'use client';

import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NeonBox } from '@/components/neon/neon-box';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Users,
  Plus,
  Upload,
  Download,
  Edit,
  Trash2,
  Search,
  Tag,
  Phone,
  User,
  X,
  ChevronDown,
  FileDown,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';
import Papa from 'papaparse';

interface Contact {
  id: string;
  phone: string;
  name?: string;
  tags: string[];
  notes?: string;
  isBlocked: boolean;
  autoSaved: boolean;
  createdAt: string;
}

// Country codes list
const COUNTRY_CODES = [
  { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+62', country: 'Indonesia', flag: '🇮🇩' },
  { code: '+66', country: 'Thailand', flag: '🇹🇭' },
  { code: '+63', country: 'Philippines', flag: '🇵🇭' },
  { code: '+84', country: 'Vietnam', flag: '🇻🇳' },
  { code: '+95', country: 'Myanmar', flag: '🇲🇲' },
  { code: '+673', country: 'Brunei', flag: '🇧🇳' },
  { code: '+856', country: 'Laos', flag: '🇱🇦' },
  { code: '+855', country: 'Cambodia', flag: '🇰🇭' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+82', country: 'South Korea', flag: '🇰🇷' },
  { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
];

export default function ContactsPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  
  // Form state
  const [countryCode, setCountryCode] = useState('+60');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  
  // Tags state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Delete tag dialog state
  const [deleteTagDialogOpen, setDeleteTagDialogOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);
  const [tagUsageCount, setTagUsageCount] = useState(0);
  const [isDeletingTag, setIsDeletingTag] = useState(false);
  
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch contacts whenever page or search changes
  useEffect(() => {
    fetchContacts();
  }, [page, search]);

  // Fetch all tags once on mount (heavy call, avoid repeating)
  useEffect(() => {
    fetchAllTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setShowTagDropdown(false);
      }
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setShowCountryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchContacts = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '50',
        search,
      });
      const res = await fetch(`/api/contact?${params}`);
      const data = await res.json();
      if (data.success) {
        setContacts(data.data);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllTags = async () => {
    try {
      // Fetch all contacts to extract unique tags
      const res = await fetch('/api/contact?pageSize=1000');
      const data = await res.json();
      if (data.success) {
        const allTags = new Set<string>();
        data.data.forEach((contact: Contact) => {
          contact.tags.forEach((tag) => allTags.add(tag));
        });
        setAvailableTags(Array.from(allTags).sort());
      }
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    }
  };

  const syncFromWhatsApp = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/contact/sync', { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        if (data.data.imported === 0 && data.data.updated === 0) {
          toast({
            title: 'No New Contacts',
            description: `Found ${data.data.total} contacts in WhatsApp, but all already synced.`,
          });
        } else {
          toast({
            title: 'Sync Complete',
            description: `Imported: ${data.data.imported}, Updated: ${data.data.updated}`,
            variant: 'success',
          });
        }
        fetchContacts();
        fetchAllTags();
      } else {
        toast({
          title: 'Sync Failed',
          description: data.error || 'Failed to sync contacts',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Sync Failed',
        description: 'Connection error. Please check your WhatsApp connection.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSubmit = async () => {
    if (!phoneNumber) {
      toast({
        title: 'Error',
        description: 'Phone number is required',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      // Combine country code with phone number (remove leading 0 if any)
      const cleanPhone = phoneNumber.replace(/^0+/, '');
      const fullPhone = countryCode.replace('+', '') + cleanPhone;
      
      const url = editingContact ? `/api/contact/${editingContact.id}` : '/api/contact';
      const method = editingContact ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: fullPhone,
          name,
          tags: selectedTags,
          notes,
        }),
      });
      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: editingContact ? 'Contact updated!' : 'Contact added!',
          variant: 'success',
        });
        setDialogOpen(false);
        resetForm();
        fetchContacts();
        fetchAllTags(); // Refresh tags
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save contact',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;

    try {
      const res = await fetch(`/api/contact/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Contact deleted!',
        });
        fetchContacts();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete contact',
        variant: 'destructive',
      });
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        try {
          const res = await fetch('/api/contact/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contacts: results.data }),
          });
          const data = await res.json();

          if (data.success) {
            toast({
              title: 'Import Complete',
              description: `Imported: ${data.data.imported}, Skipped: ${data.data.skipped}`,
              variant: 'success',
            });
            fetchContacts();
            fetchAllTags();
          }
        } catch (error) {
          toast({
            title: 'Error',
            description: 'Failed to import contacts',
            variant: 'destructive',
          });
        }
      },
    });
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExport = () => {
    if (contacts.length === 0) {
      toast({
        title: 'No Data',
        description: 'No contacts to export',
        variant: 'destructive',
      });
      return;
    }

    const exportData = contacts.map((c) => ({
      phone: c.phone,
      name: c.name || '',
      tags: c.tags.join(';'),
      notes: c.notes || '',
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contacts_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Export Complete',
      description: `Exported ${contacts.length} contacts`,
      variant: 'success',
    });
  };

  const downloadTemplate = () => {
    const template = [
      { phone: '60123456789', name: 'John Doe', tags: 'customer;vip', notes: 'Sample contact' },
      { phone: '60187654321', name: 'Jane Smith', tags: 'lead', notes: '' },
    ];
    
    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'contacts_import_template.csv';
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Template Downloaded',
      description: 'Fill in the template and import it',
      variant: 'success',
    });
  };

  const resetForm = () => {
    setCountryCode('+60');
    setPhoneNumber('');
    setName('');
    setSelectedTags([]);
    setNotes('');
    setNewTagInput('');
    setEditingContact(null);
  };

  const openEditDialog = (contact: Contact) => {
    setEditingContact(contact);
    
    // Parse phone to extract country code
    const phone = contact.phone;
    let foundCode = COUNTRY_CODES.find((c) => phone.startsWith(c.code.replace('+', '')));
    if (foundCode) {
      setCountryCode(foundCode.code);
      setPhoneNumber(phone.substring(foundCode.code.length - 1));
    } else {
      // Default to Malaysia and use full number
      setCountryCode('+60');
      setPhoneNumber(phone.startsWith('60') ? phone.substring(2) : phone);
    }
    
    setName(contact.name || '');
    setSelectedTags(contact.tags);
    setNotes(contact.notes || '');
    setDialogOpen(true);
  };

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !selectedTags.includes(trimmedTag)) {
      setSelectedTags([...selectedTags, trimmedTag]);
      if (!availableTags.includes(trimmedTag)) {
        setAvailableTags([...availableTags, trimmedTag].sort());
      }
    }
    setNewTagInput('');
    setShowTagDropdown(false);
  };

  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((t) => t !== tag));
  };

  const handleDeleteTagClick = async (tag: string) => {
    try {
      // Get count of contacts using this tag
      const res = await fetch(`/api/contact/tags/${encodeURIComponent(tag)}`);
      const data = await res.json();
      
      if (data.success) {
        setTagToDelete(tag);
        setTagUsageCount(data.count);
        setDeleteTagDialogOpen(true);
      }
    } catch (error) {
      console.error('Failed to get tag count:', error);
      toast({
        title: 'Error',
        description: 'Failed to get tag information',
        variant: 'destructive',
      });
    }
  };

  const handleConfirmDeleteTag = async () => {
    if (!tagToDelete) return;

    setIsDeletingTag(true);
    try {
      const res = await fetch(`/api/contact/tags/${encodeURIComponent(tagToDelete)}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: data.message || 'Tag deleted successfully',
          variant: 'success',
        });
        
        // Remove tag from available tags
        setAvailableTags(availableTags.filter((t) => t !== tagToDelete));
        
        // Remove tag from selected tags if it's selected
        setSelectedTags(selectedTags.filter((t) => t !== tagToDelete));
        
        // Refresh contacts to update tags display
        fetchContacts();
        
        setDeleteTagDialogOpen(false);
        setTagToDelete(null);
        setTagUsageCount(0);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete tag',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingTag(false);
    }
  };

  const filteredTags = availableTags.filter(
    (tag) => 
      !selectedTags.includes(tag) && 
      tag.toLowerCase().includes(newTagInput.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Contacts"
        subtitle={`${total} total contacts`}
        showSearch
        onSearch={setSearch}
      />

      <div className="flex-1 p-6 space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="flex gap-2 flex-wrap">
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button variant="neon" onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingContact ? 'Edit Contact' : 'Add New Contact'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  {/* Phone Number with Country Code */}
                  <div className="space-y-2">
                    <Label variant="neon">Phone Number *</Label>
                    <div className="flex gap-2">
                      {/* Country Code Dropdown */}
                      <div className="relative" ref={countryDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                          className="flex items-center gap-1 px-3 py-2 h-10 neon-border rounded-md bg-[var(--bg)] hover:bg-[var(--panel)] transition-colors min-w-[100px]"
                        >
                          <span className="text-lg">
                            {COUNTRY_CODES.find((c) => c.code === countryCode)?.flag}
                          </span>
                          <span className="font-mono text-sm">{countryCode}</span>
                          <ChevronDown className="h-3 w-3 ml-auto" />
                        </button>
                        
                        {showCountryDropdown && (
                          <div className="absolute z-50 top-full left-0 mt-1 w-48 max-h-60 overflow-auto bg-[var(--bg)] neon-border rounded-md shadow-lg">
                            {COUNTRY_CODES.map((c) => (
                              <button
                                key={c.code}
                                type="button"
                                onClick={() => {
                                  setCountryCode(c.code);
                                  setShowCountryDropdown(false);
                                }}
                                className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[var(--panel)] transition-colors ${
                                  countryCode === c.code ? 'bg-[var(--panel)]' : ''
                                }`}
                              >
                                <span className="text-lg">{c.flag}</span>
                                <span className="font-mono text-sm">{c.code}</span>
                                <span className="text-xs text-[var(--text-dim)]">{c.country}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Phone Input */}
                      <Input
                        variant="neon"
                        placeholder="123456789"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                        className="flex-1"
                      />
                    </div>
                    <p className="text-xs text-[var(--text-dim)]">
                      Full number: {countryCode.replace('+', '')}{phoneNumber || '...'}
                    </p>
                  </div>

                  {/* Name */}
                  <div className="space-y-2">
                    <Label variant="neon">Name</Label>
                    <Input
                      variant="neon"
                      placeholder="Contact name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  {/* Tags Dropdown */}
                  <div className="space-y-2">
                    <Label variant="neon">Tags</Label>
                    
                    {/* Selected Tags */}
                    {selectedTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {selectedTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded neon-border bg-[var(--panel)]"
                          >
                            <Tag className="h-3 w-3" />
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              className="hover:text-[var(--neon-red)] ml-1"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {/* Tag Input/Dropdown */}
                    <div className="relative" ref={tagDropdownRef}>
                      <div className="flex gap-2">
                        <Input
                          variant="neon"
                          placeholder="Select or type new tag..."
                          value={newTagInput}
                          onChange={(e) => {
                            setNewTagInput(e.target.value);
                            setShowTagDropdown(true);
                          }}
                          onFocus={() => setShowTagDropdown(true)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newTagInput.trim()) {
                              e.preventDefault();
                              addTag(newTagInput);
                            }
                          }}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => newTagInput.trim() && addTag(newTagInput)}
                          disabled={!newTagInput.trim()}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {showTagDropdown && (filteredTags.length > 0 || newTagInput.trim()) && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-40 overflow-auto bg-[var(--bg)] neon-border rounded-md shadow-lg">
                          {/* Existing tags */}
                          {filteredTags.map((tag) => (
                            <div
                              key={tag}
                              className="w-full flex items-center justify-between px-3 py-2 hover:bg-[var(--panel)] transition-colors group"
                            >
                              <button
                                type="button"
                                onClick={() => addTag(tag)}
                                className="flex-1 text-left flex items-center gap-2"
                              >
                                <Tag className="h-3 w-3" />
                                {tag}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTagClick(tag);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-[var(--neon-red)]"
                                title="Delete tag"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          
                          {/* Create new tag option */}
                          {newTagInput.trim() && !availableTags.includes(newTagInput.trim().toLowerCase()) && (
                            <button
                              type="button"
                              onClick={() => addTag(newTagInput)}
                              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[var(--panel)] transition-colors border-t border-[var(--border)]"
                            >
                              <Plus className="h-3 w-3 text-[var(--neon-green)]" />
                              <span>Create "{newTagInput.trim()}"</span>
                            </button>
                          )}
                          
                          {filteredTags.length === 0 && !newTagInput.trim() && (
                            <p className="px-3 py-2 text-sm text-[var(--text-dim)]">
                              No tags yet. Type to create one.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-2">
                    <Label variant="neon">Notes</Label>
                    <textarea
                      className="w-full h-20 terminal-input resize-none p-2 rounded-md neon-border bg-[var(--bg)]"
                      placeholder="Additional notes..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  <Button
                    variant="neon"
                    className="w-full"
                    onClick={handleSubmit}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Saving...' : editingContact ? 'Update Contact' : 'Add Contact'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Delete Tag Confirmation Dialog */}
            <Dialog open={deleteTagDialogOpen} onOpenChange={setDeleteTagDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Delete Tag</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <p className="text-sm text-[var(--text)]">
                    Are you sure you want to delete the tag <strong className="neon-text">"{tagToDelete}"</strong>?
                  </p>
                  <div className="p-3 rounded-lg bg-[var(--panel)] border border-[var(--neon-color-primary)]/30">
                    <p className="text-sm text-[var(--text-dim)]">
                      This tag is currently used by <strong className="text-[var(--neon-color-primary)]">{tagUsageCount}</strong> contact(s).
                    </p>
                    <p className="text-xs text-[var(--text-dim)] mt-2">
                      The tag will be removed from all contacts that use it.
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDeleteTagDialogOpen(false);
                        setTagToDelete(null);
                        setTagUsageCount(0);
                      }}
                      disabled={isDeletingTag}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleConfirmDeleteTag}
                      disabled={isDeletingTag}
                    >
                      {isDeletingTag ? 'Deleting...' : 'Delete Tag'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleImport}
              className="hidden"
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>
            
            <Button variant="outline" onClick={downloadTemplate}>
              <FileDown className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            
            <Button variant="neon" onClick={syncFromWhatsApp} disabled={isSyncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync from WhatsApp'}
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-280px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contacts.map((contact) => (
              <NeonBox key={contact.id} variant="card" className="neon-shift">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full neon-border flex items-center justify-center">
                        <User className="h-5 w-5 neon-text" />
                      </div>
                      <div>
                        <h3 className="font-mono font-bold">
                          {contact.name || 'Unknown'}
                        </h3>
                        <p className="text-sm text-[var(--text-dim)] flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          +{contact.phone}
                        </p>
                      </div>
                    </div>
                    {contact.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {contact.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-0.5 rounded neon-border flex items-center gap-1"
                          >
                            <Tag className="h-2 w-2" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {contact.autoSaved && (
                      <span className="text-xs text-[var(--text-dim)]">
                        Auto-saved from chat
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(contact)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(contact.id)}
                    >
                      <Trash2 className="h-4 w-4 text-[#ff4444]" />
                    </Button>
                  </div>
                </div>
              </NeonBox>
            ))}
          </div>
          {contacts.length === 0 && (
            <div className="text-center py-12 space-y-4">
              <Users className="h-16 w-16 mx-auto text-[var(--text-dim)] opacity-50" />
              <p className="text-[var(--text-dim)]">
                No contacts found. Add your first contact!
              </p>
              <p className="text-sm text-[var(--text-dim)]">
                Or <button onClick={downloadTemplate} className="neon-text underline">download template</button> and import CSV
              </p>
            </div>
          )}
        </ScrollArea>

        {total > 50 && (
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="flex items-center px-4 font-mono text-sm">
              Page {page} of {Math.ceil(total / 50)}
            </span>
            <Button
              variant="outline"
              disabled={page >= Math.ceil(total / 50)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
