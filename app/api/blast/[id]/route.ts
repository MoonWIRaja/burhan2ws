import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';

// Get blast details
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

    const blast = await prisma.blast.findFirst({
      where: {
        id: params.id,
        userId: payload.userId,
      },
      include: {
        messages: {
          include: {
            contact: {
              select: {
                phone: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!blast) {
      return NextResponse.json(
        { success: false, error: 'Blast not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: blast,
    });
  } catch (error) {
    console.error('Get blast error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get blast' },
      { status: 500 }
    );
  }
}

// Update blast (pause/resume/cancel)
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

    const { action } = await request.json();

    const blast = await prisma.blast.findFirst({
      where: {
        id: params.id,
        userId: payload.userId,
      },
    });

    if (!blast) {
      return NextResponse.json(
        { success: false, error: 'Blast not found' },
        { status: 404 }
      );
    }

    let newStatus: string;
    const updateData: Record<string, unknown> = {};

    switch (action) {
      case 'pause':
        newStatus = 'PAUSED';
        break;
      case 'resume':
        newStatus = 'RUNNING';
        break;
      case 'cancel':
        newStatus = 'CANCELLED';
        // For scheduled blasts, also disable scheduling
        if (blast.isScheduled) {
          updateData.isScheduled = false;
        }
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    updateData.status = newStatus;
    if (action === 'cancel') {
      updateData.completedAt = new Date();
    }

    const updatedBlast = await prisma.blast.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: updatedBlast,
    });
  } catch (error) {
    console.error('Update blast error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update blast' },
      { status: 500 }
    );
  }
}

// Delete blast
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

    const blast = await prisma.blast.deleteMany({
      where: {
        id: params.id,
        userId: payload.userId,
      },
    });

    if (blast.count === 0) {
      return NextResponse.json(
        { success: false, error: 'Blast not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Blast deleted successfully',
    });
  } catch (error) {
    console.error('Delete blast error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete blast' },
      { status: 500 }
    );
  }
}


