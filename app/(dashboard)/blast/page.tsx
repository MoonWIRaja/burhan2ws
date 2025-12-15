'use client';

import { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NeonBox } from '@/components/neon/neon-box';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Send,
  Plus,
  Upload,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Pause,
  Play,
  Trash2,
  Image,
  Video,
  FileText,
  Music,
  X,
  Smile,
  RefreshCw,
  Paperclip,
  Calendar,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';

interface Blast {
  id: string;
  name: string;
  message: string;
  mediaUrl?: string;
  mediaType?: string;
  status: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  createdAt: string;
  isScheduled?: boolean;
  scheduleStartDate?: string;
  scheduleEndDate?: string;
  scheduleTime?: string;
  scheduleDays?: string;
  lastScheduledRun?: string;
}

interface Contact {
  id: string;
  phone: string;
  name?: string;
  tags: string[];
}

interface Attachment {
  id: string;
  file: File;
  type: 'image' | 'video' | 'audio' | 'document';
  preview: string | null;
}

// Common emojis for quick access
const COMMON_EMOJIS = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂',
  '😉', '😍', '🥰', '😘', '😗', '😋', '😛', '🤗', '🤔', '🤫',
  '👍', '👎', '👏', '🙏', '💪', '❤️', '💯', '🔥', '⭐', '✨',
  '🎉', '🎊', '💰', '💵', '🛒', '📦', '✅', '❌', '⚠️', '📢',
];

// Countdown component for scheduled blasts
function ScheduledCountdown({ 
  scheduleTime, 
  scheduleDays, 
  lastScheduledRun 
}: { 
  scheduleTime?: string; 
  scheduleDays?: string; 
  lastScheduledRun?: string;
}) {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    const updateCountdown = () => {
      if (!scheduleTime) {
        setTimeLeft('');
        return;
      }

      const now = new Date();
      const [hours, minutes] = scheduleTime.split(':').map(Number);
      
      // Get next scheduled time (today)
      let nextScheduled = new Date();
      nextScheduled.setHours(hours, minutes, 0, 0);
      nextScheduled.setSeconds(0, 0);
      
      // Check if today is a scheduled day
      const today = now.getDay();
      let isTodayScheduled = true;
      
      if (scheduleDays) {
        try {
          const days = JSON.parse(scheduleDays) as number[];
          if (days.length > 0) {
            isTodayScheduled = days.includes(today);
          }
        } catch {
          // Invalid JSON, assume every day
        }
      }
      
      // If time has passed today
      if (nextScheduled <= now) {
        // Check if we already sent today
        if (lastScheduledRun) {
          const lastRun = new Date(lastScheduledRun);
          const todayDate = new Date();
          todayDate.setHours(0, 0, 0, 0);
          lastRun.setHours(0, 0, 0, 0);
          
          // If already sent today, schedule for next scheduled day
          if (lastRun.getTime() === todayDate.getTime()) {
            // Find next scheduled day
            nextScheduled.setDate(nextScheduled.getDate() + 1);
            let daysToAdd = 1;
            while (daysToAdd <= 7) {
              const nextDay = nextScheduled.getDay();
              if (!scheduleDays || scheduleDays === 'null' || scheduleDays === '') {
                // Every day - use tomorrow
                break;
              }
              try {
                const days = JSON.parse(scheduleDays) as number[];
                if (days.length === 0 || days.includes(nextDay)) {
                  break;
                }
              } catch {
                break;
              }
              nextScheduled.setDate(nextScheduled.getDate() + 1);
              daysToAdd++;
            }
          } else if (isTodayScheduled) {
            // Time passed but not sent today - should send now
            setTimeLeft('Starting now...');
            return;
          } else {
            // Not scheduled today, find next scheduled day
            nextScheduled.setDate(nextScheduled.getDate() + 1);
            let daysToAdd = 1;
            while (daysToAdd <= 7) {
              const nextDay = nextScheduled.getDay();
              if (!scheduleDays || scheduleDays === 'null' || scheduleDays === '') {
                break;
              }
              try {
                const days = JSON.parse(scheduleDays) as number[];
                if (days.length === 0 || days.includes(nextDay)) {
                  break;
                }
              } catch {
                break;
              }
              nextScheduled.setDate(nextScheduled.getDate() + 1);
              daysToAdd++;
            }
          }
        } else if (isTodayScheduled) {
          // Time passed, not sent yet, today is scheduled - should send now
          setTimeLeft('Starting now...');
          return;
        } else {
          // Time passed, not scheduled today - find next scheduled day
          nextScheduled.setDate(nextScheduled.getDate() + 1);
          let daysToAdd = 1;
          while (daysToAdd <= 7) {
            const nextDay = nextScheduled.getDay();
            if (!scheduleDays || scheduleDays === 'null' || scheduleDays === '') {
              break;
            }
            try {
              const days = JSON.parse(scheduleDays) as number[];
              if (days.length === 0 || days.includes(nextDay)) {
                break;
              }
            } catch {
              break;
            }
            nextScheduled.setDate(nextScheduled.getDate() + 1);
            daysToAdd++;
          }
        }
      }

      const diff = nextScheduled.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft('Starting now...');
        return;
      }

      const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
      const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secondsLeft = Math.floor((diff % (1000 * 60)) / 1000);

      if (hoursLeft > 0) {
        setTimeLeft(`${hoursLeft}h ${minutesLeft}m ${secondsLeft}s`);
      } else if (minutesLeft > 0) {
        setTimeLeft(`${minutesLeft}m ${secondsLeft}s`);
      } else {
        setTimeLeft(`${secondsLeft}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [scheduleTime, scheduleDays, lastScheduledRun]);

  if (!timeLeft) return null;

  return (
    <div className="flex items-center gap-2 text-xs font-mono">
      <Clock className="h-3 w-3 text-[var(--neon-color-primary)]" />
      <span className="text-[var(--neon-color-primary)]">
        Next send in: {timeLeft}
      </span>
    </div>
  );
}

export default function BlastPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [blasts, setBlasts] = useState<Blast[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [filterTag, setFilterTag] = useState<string>('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    message: '',
    speed: 'NORMAL' as 'NORMAL' | 'SLOW' | 'RANDOM',
    isScheduled: false,
    scheduleStartDate: '',
    scheduleEndDate: '',
    scheduleTime: '',
    scheduleDays: [] as number[], // Array of day numbers (0=Sunday, 1=Monday, etc.)
  });
  
  // Multiple attachments state
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    fetchBlasts();
    fetchContacts();
  }, []);

  useEffect(() => {
    // Extract unique tags from contacts
    const tags = new Set<string>();
    contacts.forEach((c) => c.tags?.forEach((t) => tags.add(t)));
    setAvailableTags(Array.from(tags).sort());
  }, [contacts]);

  const fetchBlasts = async () => {
    try {
      const res = await fetch('/api/blast');
      const data = await res.json();
      if (data.success) {
        setBlasts(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch blasts:', error);
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/contact?pageSize=1000');
      const data = await res.json();
      if (data.success) {
        setContacts(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = [];

    Array.from(files).forEach((file) => {
      // Determine file type
      let type: 'image' | 'video' | 'audio' | 'document' = 'document';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';

      // Create preview for images
      let preview: string | null = null;
      if (type === 'image') {
        preview = URL.createObjectURL(file);
      }

      newAttachments.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        type,
        preview,
      });
    });

    setAttachments([...attachments, ...newAttachments]);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    const attachment = attachments.find((a) => a.id === id);
    if (attachment?.preview) {
      URL.revokeObjectURL(attachment.preview);
    }
    setAttachments(attachments.filter((a) => a.id !== id));
  };

  const clearAllAttachments = () => {
    attachments.forEach((a) => {
      if (a.preview) URL.revokeObjectURL(a.preview);
    });
    setAttachments([]);
  };

  const uploadFile = async (file: File): Promise<string> => {
    // Convert to base64 data URL
    // In production, upload to cloud storage (S3, GCS, etc.)
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleCreateBlast = async () => {
    if (!formData.name || !formData.message || selectedContacts.length === 0) {
      toast({
        title: 'Error',
        description: 'Please fill all required fields and select contacts',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      // Upload all attachments
      const mediaItems: { url: string; type: string; name: string }[] = [];
      
      for (const attachment of attachments) {
        const url = await uploadFile(attachment.file);
        mediaItems.push({
          url,
          type: attachment.type,
          name: attachment.file.name,
        });
      }

      // For now, use first attachment as primary media
      // TODO: Support multiple media in blast
      const primaryMedia = mediaItems[0];

      // Prepare scheduling data
      const scheduleData: any = {};
      if (formData.isScheduled) {
        scheduleData.isScheduled = true;
        scheduleData.scheduleStartDate = formData.scheduleStartDate;
        scheduleData.scheduleEndDate = formData.scheduleEndDate;
        scheduleData.scheduleTime = formData.scheduleTime;
        scheduleData.scheduleDays = formData.scheduleDays.length > 0 ? JSON.stringify(formData.scheduleDays) : null;
      } else {
        scheduleData.isScheduled = false;
      }

      const res = await fetch('/api/blast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          message: formData.message,
          speed: formData.speed,
          contactIds: selectedContacts,
          mediaUrl: primaryMedia?.url,
          mediaType: primaryMedia?.type,
          // Store additional media in buttonData as JSON for now
          buttonData: mediaItems.length > 1 ? JSON.stringify(mediaItems.slice(1)) : undefined,
          ...scheduleData,
        }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        const errorMsg = data.details 
          ? `Validation error: ${JSON.stringify(data.details)}` 
          : data.error || 'Failed to create blast';
        throw new Error(errorMsg);
      }
      
      if (data.success) {
        toast({
          title: 'Success',
          description: `Blast created! Sending to ${selectedContacts.length} contacts...`,
          variant: 'success',
        });
        setFormData({ 
          name: '', 
          message: '', 
          speed: 'NORMAL',
          isScheduled: false,
          scheduleStartDate: '',
          scheduleEndDate: '',
          scheduleTime: '',
          scheduleDays: [],
        });
        setSelectedContacts([]);
        clearAllAttachments();
        fetchBlasts();
      } else {
        throw new Error(data.error || 'Failed to create blast');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create blast',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBlastAction = async (blastId: string, action: string) => {
    try {
      const res = await fetch(`/api/blast/${blastId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      
      if (data.success) {
        fetchBlasts();
        toast({
          title: 'Success',
          description: `Blast ${action}d successfully`,
        });
      }
    } catch (error) {
      console.error('Failed to update blast:', error);
    }
  };

  const insertEmoji = (emoji: string) => {
    setFormData({ ...formData, message: formData.message + emoji });
    setShowEmojiPicker(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return '#44ff44';
      case 'RUNNING': return 'var(--neon-color-primary)';
      case 'PAUSED': return '#ffff44';
      case 'FAILED': return '#ff4444';
      case 'CANCELLED': return '#ff8844';
      default: return 'var(--text-dim)';
    }
  };

  const getAttachmentIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'audio': return <Music className="h-4 w-4" />;
      case 'document': return <FileText className="h-4 w-4" />;
      default: return <Paperclip className="h-4 w-4" />;
    }
  };

  // Filter contacts by tag
  const filteredContacts = filterTag
    ? contacts.filter((c) => c.tags?.includes(filterTag))
    : contacts;

  return (
    <div className="flex flex-col h-full">
      <Header title="WhatsApp Blast" subtitle="Send bulk messages to your contacts" />

      <div className="flex-1 p-6">
        <Tabs defaultValue="create" className="space-y-6">
          <TabsList>
            <TabsTrigger value="create">Create Blast</TabsTrigger>
            <TabsTrigger value="history">Blast History ({blasts.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Blast Form */}
              <Card variant="neon">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5" />
                    New Blast
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label variant="neon">Blast Name *</Label>
                    <Input
                      variant="neon"
                      placeholder="e.g., Promo December"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label variant="neon">Message *</Label>
                    <div className="relative">
                      <textarea
                        className="w-full h-32 p-3 rounded-md neon-border bg-[var(--bg)] resize-none font-mono text-sm"
                        placeholder="Type your message here... Use {name} and {phone} for personalization"
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="absolute bottom-2 right-2 p-1 hover:bg-[var(--panel)] rounded"
                      >
                        <Smile className="h-5 w-5 text-[var(--text-dim)]" />
                      </button>
                      
                      {/* Emoji Picker */}
                      {showEmojiPicker && (
                        <div className="absolute bottom-10 right-0 z-50 p-3 bg-[var(--bg)] neon-border rounded-lg shadow-lg w-64">
                          <div className="grid grid-cols-10 gap-1">
                            {COMMON_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => insertEmoji(emoji)}
                                className="text-xl hover:bg-[var(--panel)] rounded p-1"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-dim)]">
                      Variables: {'{name}'} = Contact name, {'{phone}'} = Contact phone
                    </p>
                  </div>

                  {/* Multiple Attachments */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label variant="neon">Attachments ({attachments.length})</Label>
                      {attachments.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={clearAllAttachments}
                          className="text-xs"
                        >
                          Clear All
                        </Button>
                      )}
                    </div>
                    
                    {/* Attachment List */}
                    {attachments.length > 0 && (
                      <div className="space-y-2 max-h-40 overflow-auto">
                        {attachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="flex items-center gap-2 p-2 neon-border rounded-md bg-[var(--panel)]"
                          >
                            {attachment.preview ? (
                              <img
                                src={attachment.preview}
                                alt="Preview"
                                className="w-10 h-10 object-cover rounded"
                              />
                            ) : (
                              <div className="w-10 h-10 flex items-center justify-center neon-border rounded">
                                {getAttachmentIcon(attachment.type)}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-xs truncate">{attachment.file.name}</p>
                              <p className="text-xs text-[var(--text-dim)]">
                                {attachment.type.toUpperCase()} • {(attachment.file.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeAttachment(attachment.id)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Add Attachment Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                        multiple
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (fileInputRef.current) {
                            fileInputRef.current.accept = 'image/*';
                            fileInputRef.current.click();
                          }
                        }}
                      >
                        <Image className="h-4 w-4 mr-1" />
                        Images
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (fileInputRef.current) {
                            fileInputRef.current.accept = 'video/*';
                            fileInputRef.current.click();
                          }
                        }}
                      >
                        <Video className="h-4 w-4 mr-1" />
                        Videos
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (fileInputRef.current) {
                            fileInputRef.current.accept = 'audio/*';
                            fileInputRef.current.click();
                          }
                        }}
                      >
                        <Music className="h-4 w-4 mr-1" />
                        Audio
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (fileInputRef.current) {
                            fileInputRef.current.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx';
                            fileInputRef.current.click();
                          }
                        }}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Docs
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (fileInputRef.current) {
                            fileInputRef.current.accept = '*/*';
                            fileInputRef.current.click();
                          }
                        }}
                      >
                        <Paperclip className="h-4 w-4 mr-1" />
                        Any File
                      </Button>
                    </div>
                    <p className="text-xs text-[var(--text-dim)]">
                      Note: First attachment sent as main media, others sent separately
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label variant="neon">Speed</Label>
                    <div className="flex gap-2">
                      {(['NORMAL', 'SLOW', 'RANDOM'] as const).map((speed) => (
                        <Button
                          key={speed}
                          variant={formData.speed === speed ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setFormData({ ...formData, speed })}
                        >
                          {speed}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-[var(--text-dim)]">
                      Normal: 3-5s | Slow: 5-10s | Random: 3-15s
                    </p>
                  </div>

                  {/* Scheduling Section */}
                  <div className="space-y-3 p-4 rounded-lg neon-border bg-[var(--panel)]">
                    <div className="flex items-center justify-between">
                      <Label variant="neon" className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Schedule Blast
                      </Label>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, isScheduled: !formData.isScheduled })}
                        className="flex items-center gap-2"
                      >
                        {formData.isScheduled ? (
                          <ToggleRight className="h-6 w-6 text-[var(--neon-color-primary)]" />
                        ) : (
                          <ToggleLeft className="h-6 w-6 text-[var(--text-dim)]" />
                        )}
                        <span className="text-sm font-mono">
                          {formData.isScheduled ? 'ON' : 'OFF'}
                        </span>
                      </button>
                    </div>

                    {formData.isScheduled && (
                      <div className="space-y-3 pt-2 border-t border-[var(--neon-color-primary)]/30">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label variant="neon" className="text-xs">Start Date *</Label>
                            <Input
                              type="date"
                              variant="neon"
                              value={formData.scheduleStartDate}
                              onChange={(e) => setFormData({ ...formData, scheduleStartDate: e.target.value })}
                              min={new Date().toISOString().split('T')[0]}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label variant="neon" className="text-xs">End Date *</Label>
                            <Input
                              type="date"
                              variant="neon"
                              value={formData.scheduleEndDate}
                              onChange={(e) => setFormData({ ...formData, scheduleEndDate: e.target.value })}
                              min={formData.scheduleStartDate || new Date().toISOString().split('T')[0]}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label variant="neon" className="text-xs">Time *</Label>
                          <Input
                            type="time"
                            variant="neon"
                            value={formData.scheduleTime}
                            onChange={(e) => setFormData({ ...formData, scheduleTime: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label variant="neon" className="text-xs">Days (Optional - leave empty for every day)</Label>
                          <div className="flex flex-wrap gap-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                              <Button
                                key={index}
                                type="button"
                                variant={formData.scheduleDays.includes(index) ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => {
                                  const newDays = formData.scheduleDays.includes(index)
                                    ? formData.scheduleDays.filter(d => d !== index)
                                    : [...formData.scheduleDays, index];
                                  setFormData({ ...formData, scheduleDays: newDays });
                                }}
                                className="text-xs"
                              >
                                {day}
                              </Button>
                            ))}
                          </div>
                          <p className="text-xs text-[var(--text-dim)]">
                            {formData.scheduleDays.length === 0 
                              ? 'Will send every day' 
                              : `Will send on: ${formData.scheduleDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}`}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="neon"
                    className="w-full"
                    onClick={handleCreateBlast}
                    disabled={isLoading || selectedContacts.length === 0}
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Start Blast ({selectedContacts.length} contacts)
                        {attachments.length > 0 && ` + ${attachments.length} files`}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Contact Selection */}
              <Card variant="neon">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Select Contacts
                    </span>
                    <span className="text-sm neon-text">
                      {selectedContacts.length} / {contacts.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Filter by tag */}
                  {availableTags.length > 0 && (
                    <div className="mb-4">
                      <Label variant="neon" className="text-xs">Filter by Tag</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Button
                          variant={!filterTag ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setFilterTag('')}
                        >
                          All
                        </Button>
                        {availableTags.map((tag) => (
                          <Button
                            key={tag}
                            variant={filterTag === tag ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setFilterTag(tag)}
                          >
                            {tag}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-2 mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedContacts(filteredContacts.map((c) => c.id))}
                    >
                      Select All {filterTag && `(${filterTag})`}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedContacts([])}
                    >
                      Clear
                    </Button>
                  </div>
                  
                  <ScrollArea className="h-[350px]">
                    <div className="space-y-2">
                      {filteredContacts.map((contact) => (
                        <label
                          key={contact.id}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                            selectedContacts.includes(contact.id)
                              ? 'bg-[var(--panel)] neon-border'
                              : 'hover:bg-[var(--panel)]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedContacts.includes(contact.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedContacts([...selectedContacts, contact.id]);
                              } else {
                                setSelectedContacts(selectedContacts.filter((id) => id !== contact.id));
                              }
                            }}
                            className="w-4 h-4 accent-[var(--neon-color-primary)]"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-sm truncate">
                              {contact.name || contact.phone}
                            </p>
                            {contact.name && (
                              <p className="text-xs text-[var(--text-dim)]">+{contact.phone}</p>
                            )}
                          </div>
                          {contact.tags?.length > 0 && (
                            <div className="flex gap-1">
                              {contact.tags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs px-1 py-0.5 rounded bg-[var(--panel)] text-[var(--text-dim)]"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </label>
                      ))}
                      {filteredContacts.length === 0 && (
                        <p className="text-center text-[var(--text-dim)] py-8">
                          No contacts found. Add contacts first.
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <div className="flex justify-end mb-4">
              <Button variant="outline" onClick={fetchBlasts}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
            
            {blasts.map((blast) => (
              <NeonBox key={blast.id} variant="card">
                <div className="flex items-center justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold neon-text">{blast.name}</h3>
                      {blast.mediaType && (
                        <span className="text-xs px-2 py-0.5 rounded neon-border">
                          {blast.mediaType.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-dim)] font-mono truncate max-w-md">
                      {blast.message}
                    </p>
                    <div className="flex items-center gap-4 text-xs font-mono">
                      <span
                        className="px-2 py-0.5 rounded"
                        style={{ 
                          color: getStatusColor(blast.status),
                          border: `1px solid ${getStatusColor(blast.status)}`,
                        }}
                      >
                        {blast.status}
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" style={{ color: '#44ff44' }} />
                        Sent: {blast.sentCount}/{blast.totalRecipients}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3 text-[var(--neon-color-primary)]" />
                        Read: {blast.readCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <XCircle className="h-3 w-3" style={{ color: '#ff4444' }} />
                        Failed: {blast.failedCount}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-dim)]">
                      Created: {new Date(blast.createdAt).toLocaleString()}
                    </p>
                    {blast.status === 'SCHEDULED' && blast.isScheduled && blast.scheduleTime && (
                      <ScheduledCountdown 
                        scheduleTime={blast.scheduleTime}
                        scheduleDays={blast.scheduleDays}
                        lastScheduledRun={blast.lastScheduledRun}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {blast.status === 'RUNNING' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBlastAction(blast.id, 'pause')}
                      >
                        <Pause className="h-4 w-4 mr-1" />
                        Pause
                      </Button>
                    )}
                    {blast.status === 'PAUSED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBlastAction(blast.id, 'resume')}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Resume
                      </Button>
                    )}
                    {['RUNNING', 'PAUSED', 'SCHEDULED'].includes(blast.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBlastAction(blast.id, 'cancel')}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </NeonBox>
            ))}
            {blasts.length === 0 && (
              <div className="text-center py-12">
                <Send className="h-16 w-16 mx-auto text-[var(--text-dim)] opacity-50 mb-4" />
                <p className="text-[var(--text-dim)]">
                  No blast history yet. Create your first blast!
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
