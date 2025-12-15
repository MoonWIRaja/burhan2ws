import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';

// GET - Get count of contacts using this tag
export async function GET(
  request: NextRequest,
  { params }: { params: { tag: string } }
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

    const tag = decodeURIComponent(params.tag);

    // Count contacts that have this tag
    const contacts = await prisma.contact.findMany({
      where: {
        userId: payload.userId,
      },
      select: {
        tags: true,
      },
    });

    let count = 0;
    for (const contact of contacts) {
      if (contact.tags) {
        try {
          const tags = JSON.parse(contact.tags) as string[];
          if (tags.includes(tag)) {
            count++;
          }
        } catch {
          // Invalid JSON, skip
        }
      }
    }

    return NextResponse.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error('Get tag count error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get tag count' },
      { status: 500 }
    );
  }
}

// DELETE - Delete tag from all contacts
export async function DELETE(
  request: NextRequest,
  { params }: { params: { tag: string } }
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

    const tag = decodeURIComponent(params.tag);

    // Get all contacts with this tag
    const contacts = await prisma.contact.findMany({
      where: {
        userId: payload.userId,
      },
      select: {
        id: true,
        tags: true,
      },
    });

    let updatedCount = 0;
    for (const contact of contacts) {
      if (contact.tags) {
        try {
          const tags = JSON.parse(contact.tags) as string[];
          if (tags.includes(tag)) {
            // Remove tag from array
            const updatedTags = tags.filter((t) => t !== tag);
            await prisma.contact.update({
              where: { id: contact.id },
              data: {
                tags: updatedTags.length > 0 ? JSON.stringify(updatedTags) : null,
              },
            });
            updatedCount++;
          }
        } catch {
          // Invalid JSON, skip
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Tag removed from ${updatedCount} contact(s)`,
      updatedCount,
    });
  } catch (error) {
    console.error('Delete tag error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete tag' },
      { status: 500 }
    );
  }
}

