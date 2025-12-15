import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';
import { z } from 'zod';

const contactSchema = z.object({
  phone: z.string().min(10),
  name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  groups: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

// Get all contacts
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const search = searchParams.get('search') || '';
    const tag = searchParams.get('tag');

    const where: Record<string, unknown> = { userId: payload.userId };

    if (search) {
      where.OR = [
        { phone: { contains: search } },
        { name: { contains: search } },
      ];
    }

    if (tag) {
      where.tags = { contains: tag };
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contact.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: contacts.map((c) => ({
        ...c,
        tags: c.tags ? JSON.parse(c.tags) : [],
        groups: c.groups ? JSON.parse(c.groups) : [],
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get contacts' },
      { status: 500 }
    );
  }
}

// Create contact
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

    const body = await request.json();
    const data = contactSchema.parse(body);

    // Check if contact already exists
    const existing = await prisma.contact.findUnique({
      where: {
        userId_phone: {
          userId: payload.userId,
          phone: data.phone,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Contact already exists' },
        { status: 400 }
      );
    }

    const contact = await prisma.contact.create({
      data: {
        userId: payload.userId,
        phone: data.phone,
        name: data.name,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        groups: data.groups ? JSON.stringify(data.groups) : null,
        notes: data.notes,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...contact,
        tags: contact.tags ? JSON.parse(contact.tags) : [],
        groups: contact.groups ? JSON.parse(contact.groups) : [],
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors },
        { status: 400 }
      );
    }
    console.error('Create contact error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create contact' },
      { status: 500 }
    );
  }
}



