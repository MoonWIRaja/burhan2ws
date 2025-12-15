// User types
export interface User {
  id: string;
  phone?: string | null;
  name?: string | null;
  role: 'ADMIN' | 'USER' | 'SUBUSER';
  status: 'ACTIVE' | 'DISABLED' | 'PENDING';
  theme: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date | null;
}

// Session types
export interface WhatsAppSession {
  id: string;
  userId: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'QR_PENDING' | 'LOGGED_OUT';
  qrCode?: string | null;
  phone?: string | null;
  deviceName?: string | null;
  lastConnected?: Date | null;
}

// Contact types
export interface Contact {
  id: string;
  userId: string;
  phone: string;
  name?: string | null;
  tags?: string[] | null;
  groups?: string[] | null;
  notes?: string | null;
  isBlocked: boolean;
  autoSaved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Blast types
export interface Blast {
  id: string;
  userId: string;
  name: string;
  message: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  buttonData?: string | null;
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'PAUSED' | 'CANCELLED' | 'FAILED';
  speed: 'NORMAL' | 'SLOW' | 'RANDOM';
  minDelay: number;
  maxDelay: number;
  scheduledAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlastMessage {
  id: string;
  blastId: string;
  contactId: string;
  status: 'PENDING' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  messageId?: string | null;
  error?: string | null;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  readAt?: Date | null;
  contact?: Contact;
}

// Bot types
export interface BotRule {
  id: string;
  userId: string;
  name: string;
  keywords: string[];
  response: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  buttonData?: string | null;
  isActive: boolean;
  isGreeting: boolean;
  priority: number;
  matchType: 'exact' | 'contains' | 'startsWith' | 'regex';
  autoTag?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BotFlow {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  triggerKeywords?: string[] | null;
  nodes?: BotNode[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BotNode {
  id: string;
  flowId: string;
  type: 'MESSAGE' | 'CONDITION' | 'DELAY' | 'SEND_MEDIA' | 'JUMP' | 'START' | 'END';
  label: string;
  data: Record<string, unknown>;
  positionX: number;
  positionY: number;
  nextNodes?: string[] | null;
  conditions?: Record<string, unknown> | null;
}

// Chat types
export interface Chat {
  id: string;
  userId: string;
  contactId: string;
  remoteJid: string;
  isGroup: boolean;
  unreadCount: number;
  lastMessageAt?: Date | null;
  contact?: Contact;
  messages?: Message[];
}

export interface Message {
  id: string;
  chatId: string;
  userId: string;
  contactId?: string | null;
  messageId: string;
  fromMe: boolean;
  type: string;
  content?: string | null;
  mediaUrl?: string | null;
  mediaCaption?: string | null;
  quotedMessageId?: string | null;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  timestamp: Date;
}

// Analytics types
export interface Analytics {
  id: string;
  userId: string;
  date: Date;
  blastCount: number;
  blastSent: number;
  blastDelivered: number;
  blastRead: number;
  blastFailed: number;
  botInteractions: number;
  messagesReceived: number;
  messagesSent: number;
  newContacts: number;
}

// Log types
export interface Log {
  id: string;
  userId?: string | null;
  action: string;
  details?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Pagination types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Theme types
export type Theme = 'dark' | 'light' | 'system';

// Flow Builder types
export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    message?: string;
    mediaUrl?: string;
    delay?: number;
    conditions?: Array<{
      keyword: string;
      targetNodeId: string;
    }>;
    targetNodeId?: string;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}



