import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';

interface CsvContact {
  phone: string;
  name?: string;
  tags?: string;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { contacts } = await request.json() as { contacts: CsvContact[] };

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No contacts provided' },
        { status: 400 }
      );
    }

    let imported = 0;
    let skipped = 0;

    for (const contact of contacts) {
      if (!contact.phone) {
        skipped++;
        continue;
      }

      try {
        await prisma.contact.upsert({
          where: {
            userId_phone: {
              userId: payload.userId,
              phone: contact.phone.replace(/[^0-9]/g, ''),
            },
          },
          create: {
            userId: payload.userId,
            phone: contact.phone.replace(/[^0-9]/g, ''),
            name: contact.name,
            tags: contact.tags ? JSON.stringify(contact.tags.split(',').map((t) => t.trim())) : null,
          },
          update: {
            name: contact.name,
            tags: contact.tags ? JSON.stringify(contact.tags.split(',').map((t) => t.trim())) : undefined,
          },
        });
        imported++;
      } catch {
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        imported,
        skipped,
        total: contacts.length,
      },
    });
  } catch (error) {
    console.error('Import contacts error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to import contacts' },
      { status: 500 }
    );
  }
}



