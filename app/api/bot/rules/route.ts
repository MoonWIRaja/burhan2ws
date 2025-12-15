import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';
import { z } from 'zod';

const botRuleSchema = z.object({
  name: z.string().min(1),
  keywords: z.array(z.string()).min(1),
  response: z.string().min(1),
  mediaUrl: z.string().optional(),
  mediaType: z.enum(['image', 'video', 'audio', 'document']).optional(),
  buttonData: z.string().optional(),
  isActive: z.boolean().default(true),
  isGreeting: z.boolean().default(false),
  priority: z.number().default(0),
  matchType: z.enum(['exact', 'contains', 'startsWith', 'regex']).default('contains'),
  autoTag: z.string().optional(),
});

// Get all bot rules
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

    const rules = await prisma.botRule.findMany({
      where: { userId: payload.userId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({
      success: true,
      data: rules.map((rule) => ({
        ...rule,
        keywords: JSON.parse(rule.keywords),
      })),
    });
  } catch (error) {
    console.error('Get bot rules error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get bot rules' },
      { status: 500 }
    );
  }
}

// Create bot rule
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
    const data = botRuleSchema.parse(body);

    const rule = await prisma.botRule.create({
      data: {
        userId: payload.userId,
        name: data.name,
        keywords: JSON.stringify(data.keywords),
        response: data.response,
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType,
        buttonData: data.buttonData,
        isActive: data.isActive,
        isGreeting: data.isGreeting,
        priority: data.priority,
        matchType: data.matchType,
        autoTag: data.autoTag,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...rule,
        keywords: JSON.parse(rule.keywords),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors },
        { status: 400 }
      );
    }
    console.error('Create bot rule error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create bot rule' },
      { status: 500 }
    );
  }
}



