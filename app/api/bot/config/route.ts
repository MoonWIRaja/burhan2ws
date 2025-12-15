import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';
import { z } from 'zod';

const botFileSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  content: z.string(),
  isMain: z.boolean().default(false),
});

const botConfigSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  files: z.array(botFileSchema).min(1, 'At least one file is required'),
});

// GET - Get all bot configs
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

    const configs = await prisma.botConfig.findMany({
      where: { userId: payload.userId },
      include: {
        files: {
          orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: configs,
    });
  } catch (error) {
    console.error('Get bot configs error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get bot configs' },
      { status: 500 }
    );
  }
}

// POST - Create new bot config
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
    const validated = botConfigSchema.parse(body);

    // Validate files
    for (const file of validated.files) {
      if (file.fileType === 'json') {
        try {
          JSON.parse(file.content);
        } catch {
          return NextResponse.json(
            { success: false, error: `Invalid JSON in file ${file.fileName}` },
            { status: 400 }
          );
        }
      } else if (file.fileType === 'javascript' || file.fileType === 'typescript') {
        try {
          new Function('bot', `return (async function(bot) { ${file.content} })(bot);`);
        } catch (error) {
          return NextResponse.json(
            { success: false, error: `Invalid JavaScript/TypeScript in file ${file.fileName}: ${error instanceof Error ? error.message : 'Syntax error'}` },
            { status: 400 }
          );
        }
      }
    }

    // Ensure at least one main file
    const hasMain = validated.files.some((f) => f.isMain);
    if (!hasMain) {
      validated.files[0].isMain = true;
    }

    const config = await prisma.botConfig.create({
      data: {
        userId: payload.userId,
        name: validated.name,
        description: validated.description || null,
        files: {
          create: validated.files.map((f) => ({
            fileName: f.fileName,
            fileType: f.fileType,
            content: f.content,
            isMain: f.isMain,
          })),
        },
      },
      include: {
        files: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error('Create bot config error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create bot config' },
      { status: 500 }
    );
  }
}

