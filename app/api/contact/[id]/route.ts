import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';
import { z } from 'zod';

const updateContactSchema = z.object({
  phone: z.string().min(10).optional(),
  name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  groups: z.array(z.string()).optional(),
  notes: z.string().optional(),
  isBlocked: z.boolean().optional(),
});

// Get single contact
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const contact = await prisma.contact.findFirst({
      where: {
        id: params.id,
        userId: payload.userId,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...contact,
        tags: contact.tags ? JSON.parse(contact.tags) : [],
        groups: contact.groups ? JSON.parse(contact.groups) : [],
      },
    });
  } catch (error) {
    console.error('Get contact error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get contact' },
      { status: 500 }
    );
  }
}

// Update contact
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const data = updateContactSchema.parse(body);

    const contact = await prisma.contact.updateMany({
      where: {
        id: params.id,
        userId: payload.userId,
      },
      data: {
        ...data,
        tags: data.tags ? JSON.stringify(data.tags) : undefined,
        groups: data.groups ? JSON.stringify(data.groups) : undefined,
      },
    });

    if (contact.count === 0) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 }
      );
    }

    const updatedContact = await prisma.contact.findFirst({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updatedContact,
        tags: updatedContact?.tags ? JSON.parse(updatedContact.tags) : [],
        groups: updatedContact?.groups ? JSON.parse(updatedContact.groups) : [],
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors },
        { status: 400 }
      );
    }
    console.error('Update contact error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update contact' },
      { status: 500 }
    );
  }
}

// Delete contact
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const contact = await prisma.contact.deleteMany({
      where: {
        id: params.id,
        userId: payload.userId,
      },
    });

    if (contact.count === 0) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Contact deleted successfully',
    });
  } catch (error) {
    console.error('Delete contact error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete contact' },
      { status: 500 }
    );
  }
}



