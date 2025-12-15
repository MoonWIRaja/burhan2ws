'use client';

import { useState, useEffect, useRef } from 'react';
import * as React from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NeonBox } from '@/components/neon/neon-box';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  MessageSquare,
  Send,
  User,
  Check,
  CheckCheck,
  Image,
  File,
  Mic,
  MoreVertical,
  Trash2,
  UserPlus,
  Edit,
} from 'lucide-react';
import { format } from 'date-fns';

interface Chat {
  id: string;
  remoteJid: string;
  isGroup: boolean;
  unreadCount: number;
  lastMessageAt: string;
  contact?: {
    id: string;
    phone: string;
    name?: string;
  };
}

interface Message {
  id: string;
  messageId: string;
  fromMe: boolean;
  type: string;
  content?: string;
  mediaUrl?: string;
  mediaCaption?: string;
  status: string;
  timestamp: string;
}

export default function ChatPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const messagesContainerRef = useRef<React.ElementRef<typeof ScrollArea>>(null);
  const isUserScrollingRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [editingContact, setEditingContact] = useState<{ id: string; name?: string; phone: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchChats();
    // Sync every 2 seconds for real-time updates
    // Fetch chats every 3 seconds (reduced frequency to optimize)
    const interval = setInterval(fetchChats, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.id);
      // Reset auto-scroll when switching chats
      shouldAutoScrollRef.current = true;
      isUserScrollingRef.current = false;
      // Sync messages every 1 second for real-time
      const interval = setInterval(() => fetchMessages(selectedChat.id), 1000);
      return () => clearInterval(interval);
    }
  }, [selectedChat]);

  // Handle scroll events to detect user scrolling
  useEffect(() => {
    if (!selectedChat || !messagesContainerRef.current) return;

    // Find the ScrollArea viewport element (Radix UI structure)
    const findViewport = (): HTMLElement | null => {
      // ScrollArea ref points to root, viewport is inside
      const root = messagesContainerRef.current;
      if (!root) return null;
      
      // Radix ScrollArea viewport has data attribute
      const viewport = root.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
      return viewport;
    };

    let scrollTimeout: NodeJS.Timeout;
    
    // Try to find viewport, retry if not found immediately
    const setupListener = () => {
      const viewport = findViewport();
      if (!viewport) {
        // Retry after DOM updates
        setTimeout(setupListener, 100);
        return;
      }

      const handleScroll = () => {
        isUserScrollingRef.current = true;
        clearTimeout(scrollTimeout);

        // Check if user is near bottom
        const distanceFromBottom =
          viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
        
        // If user scrolls to bottom, enable auto-scroll again
        if (distanceFromBottom < 100) {
          shouldAutoScrollRef.current = true;
        } else {
          // If user scrolls up, disable auto-scroll
          shouldAutoScrollRef.current = false;
        }

        // Reset scrolling flag after user stops scrolling
        scrollTimeout = setTimeout(() => {
          isUserScrollingRef.current = false;
        }, 150);
      };

      viewport.addEventListener('scroll', handleScroll, { passive: true });
      
      return () => {
        viewport.removeEventListener('scroll', handleScroll);
        clearTimeout(scrollTimeout);
      };
    };

    const cleanup = setupListener();
    return cleanup;
  }, [selectedChat]);

  // Auto-scroll when new messages arrive (only if user is at bottom)
  useEffect(() => {
    if (!messagesContainerRef.current || !messagesEndRef.current) return;
    if (!shouldAutoScrollRef.current) return; // Don't auto-scroll if user scrolled up
    if (isUserScrollingRef.current) return; // Don't auto-scroll while user is scrolling

    // Find the ScrollArea viewport element
    const findViewport = (): HTMLElement | null => {
      const root = messagesContainerRef.current;
      if (!root) return null;
      return root.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
    };

    const viewport = findViewport();
    if (!viewport) return;

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

    // Only auto-scroll if user is already near the bottom (within 200px)
    if (distanceFromBottom < 200) {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  }, [messages]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveContact = async () => {
    if (!contactPhone) {
      alert('Phone number is required');
      return;
    }

    try {
      const url = editingContact ? `/api/contact/${editingContact.id}` : '/api/contact';
      const method = editingContact ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: contactPhone,
          name: contactName || undefined,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setShowContactDialog(false);
        setContactName('');
        setContactPhone('');
        setEditingContact(null);
        fetchChats();
      } else {
        alert(data.error || 'Failed to save contact');
      }
    } catch (error) {
      console.error('Failed to save contact:', error);
      alert('Failed to save contact');
    }
  };

  const fetchChats = async () => {
    try {
      const res = await fetch('/api/chat/chats');
      const data = await res.json();
      if (data.success) {
        setChats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch chats:', error);
    }
  };

  const fetchMessages = async (chatId: string) => {
    try {
      const res = await fetch(`/api/chat/messages/${chatId}`);
      const data = await res.json();
      if (data.success) {
        // Filter out status messages and log for debugging
        const chatMessages = data.data.filter((msg: Message) => msg.type !== 'status');
        console.log('[Chat] Fetched messages:', {
          count: chatMessages.length,
          withMedia: chatMessages.filter(m => m.mediaUrl).length,
          fromMe: chatMessages.filter(m => m.fromMe).length
        });
        setMessages(chatMessages);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const sendMessage = async (text?: string, mediaFile?: File, mediaType?: string) => {
    const messageText = text || newMessage;
    if ((!messageText.trim() && !mediaFile) || !selectedChat) return;

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('chatId', selectedChat.id);
      formData.append('remoteJid', selectedChat.remoteJid);
      if (messageText) formData.append('message', messageText);
      if (mediaFile) {
        formData.append('media', mediaFile);
        formData.append('mediaType', mediaType || 'image');
      }

      const res = await fetch('/api/chat/send', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setNewMessage('');
        setSelectedFile(null);
        fetchMessages(selectedChat.id);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], 'voice.webm', { type: 'audio/webm' });
        sendMessage('', file, 'audio');
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-send if image/video
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        sendMessage(newMessage, file, file.type.startsWith('image/') ? 'image' : 'video');
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'READ':
        return <CheckCheck className="h-3 w-3 text-[var(--neon-blue)]" />;
      case 'DELIVERED':
        return <CheckCheck className="h-3 w-3" />;
      case 'SENT':
        return <Check className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <Image className="h-4 w-4" />;
      case 'document':
        return <File className="h-4 w-4" />;
      case 'audio':
        return <Mic className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Chat" subtitle="Chat with your contacts" />

      <div className="flex-1 flex overflow-hidden">
        {/* Chat List */}
        <div className="w-80 border-r border-[var(--neon-color-primary)]/30 flex flex-col">
          <div className="p-4 border-b border-[var(--neon-color-primary)]/30">
            <Input variant="neon" placeholder="Search chats..." />
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={`w-full p-3 rounded-lg text-left transition-all ${
                    selectedChat?.id === chat.id
                      ? 'neon-border bg-[var(--neon-color-primary)]/10'
                      : 'hover:bg-[var(--neon-color-primary)]/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full neon-border flex items-center justify-center">
                      <User className="h-5 w-5 neon-text" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-sm truncate">
                          {chat.contact?.name || chat.contact?.phone || chat.remoteJid.split('@')[0]}
                        </p>
                        {chat.unreadCount > 0 && (
                          <span className="w-5 h-5 rounded-full bg-[var(--neon-color-primary)] text-[var(--bg)] text-xs flex items-center justify-center">
                            {chat.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-dim)]">
                        {chat.lastMessageAt && format(new Date(chat.lastMessageAt), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
              {chats.length === 0 && (
                <p className="text-center text-[var(--text-dim)] py-8 text-sm">
                  No chats yet
                </p>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-[var(--neon-color-primary)]/30 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-full neon-border flex items-center justify-center">
                  <User className="h-5 w-5 neon-text" />
                </div>
                  <div className="flex-1">
                  <p className="font-mono font-bold">
                    {selectedChat.contact?.name ? selectedChat.contact.name : (selectedChat.contact?.phone || selectedChat.remoteJid.split('@')[0])}
                  </p>
                  <p className="text-xs text-[var(--text-dim)]">
                      {selectedChat.contact?.phone || selectedChat.remoteJid.split('@')[0]}
                  </p>
                </div>
              </div>
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-2 rounded-lg hover:bg-[var(--neon-color-primary)]/10 transition-colors"
                  >
                    <MoreVertical className="h-5 w-5 neon-text" />
                  </button>
                  {showMenu && (
                    <div
                      ref={menuRef}
                      className="absolute right-0 top-full mt-2 w-48 bg-[var(--panel)] border border-[var(--neon-color-primary)]/30 rounded-lg shadow-lg z-50"
                    >
                      <button
                        onClick={() => {
                          setContactName(selectedChat.contact?.name || '');
                          setContactPhone(selectedChat.contact?.phone || selectedChat.remoteJid.split('@')[0]);
                          setEditingContact(selectedChat.contact ? { id: selectedChat.contact.id, name: selectedChat.contact.name || undefined, phone: selectedChat.contact.phone } : null);
                          setShowContactDialog(true);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-[var(--neon-color-primary)]/10 flex items-center gap-2 text-sm"
                      >
                        {selectedChat.contact ? (
                          <>
                            <Edit className="h-4 w-4" />
                            Edit Contact
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4" />
                            Add Contact
                          </>
                        )}
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm('Are you sure you want to delete this chat?')) {
                            try {
                              const res = await fetch(`/api/chat/${selectedChat.id}`, {
                                method: 'DELETE',
                              });
                              const data = await res.json();
                              if (data.success) {
                                setSelectedChat(null);
                                fetchChats();
                              } else {
                                alert('Failed to delete chat');
                              }
                            } catch (error) {
                              console.error('Failed to delete chat:', error);
                              alert('Failed to delete chat');
                            }
                            setShowMenu(false);
                          }
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-[var(--neon-color-primary)]/10 flex items-center gap-2 text-sm text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Chat
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Messages - WhatsApp Style */}
              <ScrollArea className="flex-1" ref={messagesContainerRef}>
                <div className="p-4 space-y-1">
                  {messages.map((message, index) => {
                    const prevMessage = index > 0 ? messages[index - 1] : null;
                    const showDate = !prevMessage || 
                      new Date(message.timestamp).toDateString() !== new Date(prevMessage.timestamp).toDateString();
                    
                    return (
                      <div key={message.id}>
                        {showDate && (
                          <div className="flex justify-center my-4">
                            <span className="text-xs text-[var(--text-dim)] bg-[var(--panel)] px-3 py-1 rounded-full">
                              {format(new Date(message.timestamp), 'MMM dd, yyyy')}
                            </span>
                          </div>
                        )}
                        <div
                          className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'} mb-1`}
                        >
                          <div
                            className={`max-w-[75%] rounded-lg px-3 py-2 ${
                              message.fromMe
                                ? 'bg-[#005c4b] text-white rounded-tr-none'
                                : 'bg-[var(--panel)] text-[var(--text)] border border-[var(--text-dim)]/10 rounded-tl-none'
                            }`}
                          >
                            {/* Media Display */}
                            {(message.type === 'image' || message.type === 'sticker' || message.type === 'video' || message.type === 'audio' || message.type === 'document') && (
                              message.mediaUrl ? (
                                <div className="mb-2 rounded overflow-hidden">
                                  {message.type === 'image' && (
                                    <div>
                                      <img 
                                        src={message.mediaUrl?.startsWith('data:') 
                                          ? message.mediaUrl 
                                          : message.mediaUrl?.startsWith('https://mmg.whatsapp.net') || message.mediaUrl?.startsWith('https://mmg')
                                            ? `/api/media/${message.id}`
                                            : message.mediaUrl
                                              ? `/api/media?url=${encodeURIComponent(message.mediaUrl)}`
                                              : ''}
                                        alt="Image" 
                                        className="max-w-[300px] h-auto rounded cursor-pointer"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          // For base64, create blob URL, for others use API endpoint
                                          if (message.mediaUrl?.startsWith('data:')) {
                                            // Create blob from base64 and open in new tab
                                            const base64Data = message.mediaUrl.split(',')[1];
                                            const mimeType = message.mediaUrl.match(/data:([^;]+)/)?.[1] || 'image/png';
                                            const byteCharacters = atob(base64Data);
                                            const byteNumbers = new Array(byteCharacters.length);
                                            for (let i = 0; i < byteCharacters.length; i++) {
                                              byteNumbers[i] = byteCharacters.charCodeAt(i);
                                            }
                                            const byteArray = new Uint8Array(byteNumbers);
                                            const blob = new Blob([byteArray], { type: mimeType });
                                            const blobUrl = URL.createObjectURL(blob);
                                            window.open(blobUrl, '_blank');
                                            // Clean up after a delay
                                            setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                                          } else {
                                            // Use API endpoint
                                            const url = message.mediaUrl?.startsWith('https://mmg.whatsapp.net')
                                              ? `/api/media/${message.id}`
                                              : `/api/media?url=${encodeURIComponent(message.mediaUrl || '')}&messageId=${message.id}`;
                                            window.open(url, '_blank');
                                          }
                                        }}
                                        onError={(e) => {
                                          console.error('[Chat] Failed to load image:', {
                                            mediaUrl: message.mediaUrl?.substring(0, 100),
                                            type: message.type,
                                            messageId: message.id,
                                            currentSrc: e.currentTarget.src
                                          });
                                          // Try alternative: use messageId endpoint for encrypted URLs
                                          if (message.mediaUrl?.startsWith('https://mmg.whatsapp.net')) {
                                            // Already tried messageId endpoint, try again with retry
                                            const retrySrc = `/api/media/${message.id}?retry=${Date.now()}`;
                                            if (e.currentTarget.src !== retrySrc) {
                                              e.currentTarget.src = retrySrc;
                                            } else {
                                              e.currentTarget.style.display = 'none';
                                            }
                                          } else if (!message.mediaUrl?.startsWith('data:')) {
                                            e.currentTarget.src = `/api/media/${message.id}`;
                                          } else {
                                            e.currentTarget.style.display = 'none';
                                          }
                                        }}
                                        onLoad={() => console.log('[Chat] Image loaded successfully:', message.id)}
                                      />
                                    </div>
                                  )}
                                  {message.type === 'sticker' && (
                                    <div>
                                      <img 
                                        src={message.mediaUrl?.startsWith('data:') 
                                          ? message.mediaUrl 
                                          : message.mediaUrl?.startsWith('https://mmg.whatsapp.net') || message.mediaUrl?.startsWith('https://mmg')
                                            ? `/api/media/${message.id}`
                                            : message.mediaUrl
                                              ? `/api/media?url=${encodeURIComponent(message.mediaUrl)}`
                                              : ''}
                                        alt="Sticker" 
                                        className="max-w-[200px] h-auto"
                                        style={{ imageRendering: 'auto' }}
                                      onError={(e) => {
                                        console.error('[Chat] Failed to load sticker:', {
                                          mediaUrl: message.mediaUrl?.substring(0, 100),
                                          type: message.type,
                                          messageId: message.id
                                        });
                                        // Try alternative: use messageId endpoint for encrypted URLs
                                        if (message.mediaUrl?.startsWith('https://mmg.whatsapp.net')) {
                                          e.currentTarget.src = `/api/media/${message.id}`;
                                        } else if (!message.mediaUrl?.startsWith('data:')) {
                                          // Try with messageId parameter
                                          e.currentTarget.src = `/api/media?url=${encodeURIComponent(message.mediaUrl || '')}&messageId=${message.id}`;
                                        } else {
                                          e.currentTarget.style.display = 'none';
                                        }
                                      }}
                                        onLoad={() => console.log('[Chat] Sticker loaded successfully')}
                                      />
                                    </div>
                                  )}
                                  {message.type === 'video' && (
                                    <video 
                                      src={message.mediaUrl.startsWith('data:') ? message.mediaUrl : `/api/media?url=${encodeURIComponent(message.mediaUrl)}`}
                                      controls 
                                      className="max-w-[300px] h-auto rounded"
                                      onError={(e) => {
                                        console.error('[Chat] Failed to load video:', message.mediaUrl?.substring(0, 100));
                                      }}
                                    />
                                  )}
                                  {message.type === 'audio' && (
                                    <audio 
                                      src={message.mediaUrl.startsWith('data:') ? message.mediaUrl : `/api/media?url=${encodeURIComponent(message.mediaUrl)}`}
                                      controls 
                                      className="w-full"
                                      onError={(e) => {
                                        console.error('[Chat] Failed to load audio:', message.mediaUrl?.substring(0, 100));
                                      }}
                                    />
                                  )}
                                  {message.type === 'document' && (
                                    <div className="flex items-center gap-2 p-2 bg-[var(--bg)]/50 rounded">
                                      <File className="h-5 w-5" />
                                      <a 
                                        href={message.mediaUrl.startsWith('data:') ? message.mediaUrl : `/api/media?url=${encodeURIComponent(message.mediaUrl)}`}
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-sm underline truncate"
                                        download
                                      >
                                        {message.mediaCaption || 'Document'}
                                      </a>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="mb-2 p-2 bg-[var(--bg)]/30 rounded text-xs text-[var(--text-dim)]">
                                  Media tidak tersedia (type: {message.type})
                                </div>
                              )
                            )}

                            {/* Message Content - Support emoji */}
                            {message.content && (
                              <p className={`text-sm whitespace-pre-wrap break-words ${
                                message.fromMe ? 'text-white' : 'text-[var(--text)]'
                              }`} style={{ 
                                fontFamily: 'system-ui, -apple-system, "Segoe UI", "Apple Color Emoji", "Noto Color Emoji", "Segoe UI Emoji", sans-serif',
                                lineHeight: '1.5'
                              }}>
                          {message.content}
                        </p>
                            )}
                            
                            {/* Show caption if media has caption and no text content */}
                            {message.mediaCaption && message.mediaUrl && !message.content && (
                              <p className={`text-sm mt-2 whitespace-pre-wrap break-words ${
                                message.fromMe ? 'text-white/90' : 'text-[var(--text)]'
                              }`} style={{ 
                                fontFamily: 'system-ui, -apple-system, "Segoe UI", "Apple Color Emoji", "Noto Color Emoji", "Segoe UI Emoji", sans-serif'
                              }}>
                                {message.mediaCaption}
                              </p>
                            )}

                            {/* Timestamp and Status */}
                            <div className={`flex items-center justify-end gap-1 mt-1 ${
                              message.fromMe ? 'text-white/70' : 'text-[var(--text-dim)]'
                            }`}>
                              <span className="text-xs">
                            {format(new Date(message.timestamp), 'HH:mm')}
                          </span>
                              {message.fromMe && (
                                <span className="ml-1">
                                  {getStatusIcon(message.status)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input - WhatsApp Style */}
              <div className="p-3 border-t border-[var(--neon-color-primary)]/30 bg-[var(--panel)]">
                {selectedFile && (
                  <div className="mb-2 p-2 bg-[var(--neon-color-primary)]/10 rounded-lg flex items-center justify-between">
                    <span className="text-sm font-mono truncate">{selectedFile.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFile(null)}
                      className="h-6 w-6 p-0"
                    >
                      ×
                    </Button>
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (selectedFile) {
                      sendMessage(newMessage, selectedFile, selectedFile.type.startsWith('image/') ? 'image' : 'document');
                    } else {
                    sendMessage();
                    }
                  }}
                  className="flex items-end gap-2"
                >
                  {/* Attach Button */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-10 w-10"
                  >
                    <File className="h-5 w-5" />
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {/* Text Input */}
                  <div className="flex-1 relative">
                  <Input
                    variant="neon"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                      className="pr-10"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (selectedFile) {
                            sendMessage(newMessage, selectedFile, selectedFile.type.startsWith('image/') ? 'image' : 'document');
                          } else {
                            sendMessage();
                          }
                        }
                      }}
                    />
                  </div>

                  {/* Voice/Record Button */}
                  {!newMessage.trim() && !selectedFile ? (
                    <Button
                      type="button"
                      variant={isRecording ? "destructive" : "ghost"}
                      size="icon"
                      onMouseDown={startRecording}
                      onMouseUp={stopRecording}
                      onTouchStart={startRecording}
                      onTouchEnd={stopRecording}
                      className="h-10 w-10"
                    >
                      <Mic className="h-5 w-5" />
                    </Button>
                  ) : (
                  <Button
                    type="submit"
                    variant="neon"
                      disabled={isLoading || (!newMessage.trim() && !selectedFile)}
                      className="h-10 w-10"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                  )}
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 neon-text opacity-50" />
                <p className="text-[var(--text-dim)] font-mono">
                  Select a chat to start messaging
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contact Dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingContact ? 'Edit Contact' : 'Add Contact'}
            </DialogTitle>
            <DialogDescription>
              {editingContact ? 'Update contact information' : 'Add a new contact to your list'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Phone Number</label>
              <Input
                variant="neon"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="60123456789"
                disabled={!!editingContact}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Name</label>
              <Input
                variant="neon"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Contact name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="neon"
              onClick={() => {
                setShowContactDialog(false);
                setContactName('');
                setContactPhone('');
                setEditingContact(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="neon" onClick={handleSaveContact}>
              {editingContact ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


