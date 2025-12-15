import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';
import { z } from 'zod';

const updateBotRuleSchema = z.object({
  name: z.string().min(1).optional(),
  keywords: z.array(z.string()).optional(),
  response: z.string().optional(),
  mediaUrl: z.string().optional().nullable(),
  mediaType: z.enum(['image', 'video', 'audio', 'document']).optional().nullable(),
  buttonData: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  isGreeting: z.boolean().optional(),
  priority: z.number().optional(),
  matchType: z.enum(['exact', 'contains', 'startsWith', 'regex']).optional(),
  autoTag: z.string().optional().nullable(),
});

// Update bot rule
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
    const data = updateBotRuleSchema.parse(body);

    const updateData: Record<string, unknown> = { ...data };
    if (data.keywords) {
      updateData.keywords = JSON.stringify(data.keywords);
    }

    const rule = await prisma.botRule.updateMany({
      where: {
        id: params.id,
        userId: payload.userId,
      },
      data: updateData,
    });

    if (rule.count === 0) {
      return NextResponse.json(
        { success: false, error: 'Bot rule not found' },
        { status: 404 }
      );
    }

    const updatedRule = await prisma.botRule.findFirst({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updatedRule,
        keywords: updatedRule?.keywords ? JSON.parse(updatedRule.keywords) : [],
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors },
        { status: 400 }
      );
    }
    console.error('Update bot rule error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update bot rule' },
      { status: 500 }
    );
  }
}

// Delete bot rule
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

    const rule = await prisma.botRule.deleteMany({
      where: {
        id: params.id,
        userId: payload.userId,
      },
    });

    if (rule.count === 0) {
      return NextResponse.json(
        { success: false, error: 'Bot rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Bot rule deleted successfully',
    });
  } catch (error) {
    console.error('Delete bot rule error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete bot rule' },
      { status: 500 }
    );
  }
}



