import { prisma } from '@/lib/prisma/client';
import { NotificationType } from '@prisma/client';

/**
 * Create a notification for a user
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link: link || null,
      },
    });
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
}

/**
 * Create notification for new message
 */
export async function notifyNewMessage(
  userId: string,
  contactName: string,
  chatId: string,
  messagePreview: string
) {
  return createNotification(
    userId,
    'MESSAGE',
    `New message from ${contactName}`,
    messagePreview,
    `/chat?chatId=${chatId}`
  );
}

/**
 * Create notification for blast completed
 */
export async function notifyBlastCompleted(
  userId: string,
  blastName: string,
  blastId: string,
  sentCount: number,
  totalRecipients: number
) {
  return createNotification(
    userId,
    'BLAST_COMPLETED',
    `Blast "${blastName}" completed`,
    `Successfully sent ${sentCount} out of ${totalRecipients} messages`,
    `/blast`
  );
}

/**
 * Create notification for blast failed
 */
export async function notifyBlastFailed(
  userId: string,
  blastName: string,
  blastId: string,
  errorMessage: string
) {
  return createNotification(
    userId,
    'BLAST_FAILED',
    `Blast "${blastName}" failed`,
    errorMessage.substring(0, 200),
    `/blast`
  );
}

/**
 * Create notification for WhatsApp disconnected
 */
export async function notifyWhatsAppDisconnected(userId: string) {
  return createNotification(
    userId,
    'WHATSAPP_DISCONNECTED',
    'WhatsApp Disconnected',
    'Your WhatsApp connection has been lost. Please reconnect.',
    '/'
  );
}

/**
 * Create notification for WhatsApp connected
 */
export async function notifyWhatsAppConnected(userId: string, phoneNumber?: string) {
  return createNotification(
    userId,
    'WHATSAPP_CONNECTED',
    'WhatsApp Connected',
    phoneNumber ? `Successfully connected to ${phoneNumber}` : 'Successfully connected to WhatsApp',
    '/'
  );
}

import { prisma } from '@/lib/prisma/client';
import { NotificationType } from '@prisma/client';

/**
 * Create a notification for a user
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link: link || null,
      },
    });
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
}

/**
 * Create notification for new message
 */
export async function notifyNewMessage(
  userId: string,
  contactName: string,
  chatId: string,
  messagePreview: string
) {
  return createNotification(
    userId,
    'MESSAGE',
    `New message from ${contactName}`,
    messagePreview,
    `/chat?chatId=${chatId}`
  );
}

/**
 * Create notification for blast completed
 */
export async function notifyBlastCompleted(
  userId: string,
  blastName: string,
  blastId: string,
  sentCount: number,
  totalRecipients: number
) {
  return createNotification(
    userId,
    'BLAST_COMPLETED',
    `Blast "${blastName}" completed`,
    `Successfully sent ${sentCount} out of ${totalRecipients} messages`,
    `/blast`
  );
}

/**
 * Create notification for blast failed
 */
export async function notifyBlastFailed(
  userId: string,
  blastName: string,
  blastId: string,
  errorMessage: string
) {
  return createNotification(
    userId,
    'BLAST_FAILED',
    `Blast "${blastName}" failed`,
    errorMessage.substring(0, 200),
    `/blast`
  );
}

/**
 * Create notification for WhatsApp disconnected
 */
export async function notifyWhatsAppDisconnected(userId: string) {
  return createNotification(
    userId,
    'WHATSAPP_DISCONNECTED',
    'WhatsApp Disconnected',
    'Your WhatsApp connection has been lost. Please reconnect.',
    '/'
  );
}

/**
 * Create notification for WhatsApp connected
 */
export async function notifyWhatsAppConnected(userId: string, phoneNumber?: string) {
  return createNotification(
    userId,
    'WHATSAPP_CONNECTED',
    'WhatsApp Connected',
    phoneNumber ? `Successfully connected to ${phoneNumber}` : 'Successfully connected to WhatsApp',
    '/'
  );
}



