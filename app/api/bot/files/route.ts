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

// GET - Get all bot files for user
export async function GET(_request: NextRequest) {
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

    // Get or create bot config for user
    let botConfig = await prisma.botConfig.findUnique({
      where: { userId: payload.userId },
      include: {
        files: {
          orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!botConfig) {
      try {
        // Create bot config for user
        botConfig = await prisma.botConfig.create({
          data: {
            userId: payload.userId,
          },
          include: {
            files: true,
          },
        });
      } catch (createError: any) {
        // If create fails, try to find again (race condition)
        if (createError?.code === 'P2002') {
          botConfig = await prisma.botConfig.findUnique({
            where: { userId: payload.userId },
            include: {
              files: {
                orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
              },
            },
          });
        } else {
          throw createError;
        }
      }
    }

    if (!botConfig) {
      throw new Error('Failed to get or create bot config');
    }

    return NextResponse.json({
      success: true,
      data: botConfig.files,
    });
  } catch (error: any) {
    console.error('Get bot files error:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });
    return NextResponse.json(
      { 
        success: false, 
        error: error?.message || 'Failed to get bot files',
        errorCode: error?.code,
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}

// POST - Create new bot file
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

    if (!payload.userId) {
      console.error('No userId in token payload:', payload);
      return NextResponse.json(
        { success: false, error: 'Invalid token: missing userId' },
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log('Create file request body:', { 
      fileName: body.fileName, 
      fileType: body.fileType, 
      contentLength: body.content?.length || 0,
      isMain: body.isMain 
    });
    const validated = botFileSchema.parse(body);

    // Validate file content (only if content is not empty)
    if (validated.content && validated.content.trim().length > 0) {
      if (validated.fileType === 'json') {
        try {
          JSON.parse(validated.content);
        } catch {
          return NextResponse.json(
            { success: false, error: `Invalid JSON in file ${validated.fileName}` },
            { status: 400 }
          );
        }
      } else if (validated.fileType === 'javascript' || validated.fileType === 'typescript') {
        // Skip strict validation to allow imports; runtime will surface errors
      }
    }

    // Get or create bot config for user
    console.log('Looking for bot config for userId:', payload.userId);
    let botConfig = await prisma.botConfig.findUnique({
      where: { userId: payload.userId },
    });

    if (!botConfig) {
      console.log('Bot config not found, creating new one...');
      try {
        botConfig = await prisma.botConfig.create({
          data: {
            userId: payload.userId,
          },
        });
        console.log('Bot config created:', botConfig.id);
      } catch (createError: any) {
        console.error('Error creating bot config:', createError);
        console.error('Create error details:', {
          code: createError?.code,
          message: createError?.message,
          meta: createError?.meta,
        });
        // If create fails, try to find again (race condition)
        if (createError?.code === 'P2002') {
          console.log('Race condition detected, finding existing config...');
          botConfig = await prisma.botConfig.findUnique({
            where: { userId: payload.userId },
          });
          if (!botConfig) {
            throw new Error('Failed to create or find bot config after race condition');
          }
        } else {
          throw createError;
        }
      }
    } else {
      console.log('Bot config found:', botConfig.id);
    }

    // Final null check
    if (!botConfig || !botConfig.id) {
      console.error('Bot config is null or missing id after get/create');
      throw new Error('Bot config is null or missing id after get/create');
    }

    // If this is the first file or isMain is true, set it as main
    const existingFiles = await prisma.botFile.findMany({
      where: { botConfigId: botConfig.id },
    });
    console.log('Existing files count:', existingFiles.length);

    if (existingFiles.length === 0 || validated.isMain) {
      // Unset other main files
      await prisma.botFile.updateMany({
        where: { botConfigId: botConfig.id, isMain: true },
        data: { isMain: false },
      });
      validated.isMain = true;
    }

    console.log('Creating bot file:', {
      botConfigId: botConfig.id,
      fileName: validated.fileName,
      fileType: validated.fileType,
      isMain: validated.isMain,
      contentLength: validated.content?.length || 0,
    });

    const file = await prisma.botFile.create({
      data: {
        botConfigId: botConfig.id,
        fileName: validated.fileName,
        fileType: validated.fileType,
        content: validated.content,
        isMain: validated.isMain,
      },
    });

    console.log('Bot file created successfully:', file.id);

    return NextResponse.json({
      success: true,
      data: file,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error('Create bot file error:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
      name: error?.name,
    });
    return NextResponse.json(
      { 
        success: false, 
        error: error?.message || 'Failed to create bot file',
        errorCode: error?.code,
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}



