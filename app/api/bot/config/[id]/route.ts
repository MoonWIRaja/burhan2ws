import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';
import { z } from 'zod';

const botFileSchema = z.object({
  id: z.string().optional(),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  content: z.string(),
  isMain: z.boolean().default(false),
});

const botConfigSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  files: z.array(botFileSchema).optional(),
});

// GET - Get single bot config
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

    const config = await prisma.botConfig.findUnique({
      where: { id: params.id },
      include: {
        files: {
          orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!config || config.userId !== payload.userId) {
      return NextResponse.json(
        { success: false, error: 'Bot config not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Get bot config error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get bot config' },
      { status: 500 }
    );
  }
}

// PUT - Update bot config
export async function PUT(
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

    const config = await prisma.botConfig.findUnique({
      where: { id: params.id },
      include: { files: true },
    });

    if (!config || config.userId !== payload.userId) {
      return NextResponse.json(
        { success: false, error: 'Bot config not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validated = botConfigSchema.parse(body);

    // Validate files if provided
    if (validated.files) {
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
      if (!hasMain && validated.files.length > 0) {
        validated.files[0].isMain = true;
      }

      // Delete files that are not in the update
      const existingFileIds = config.files.map((f) => f.id);
      const newFileIds = validated.files
        .map((f) => f.id)
        .filter((id): id is string => !!id);
      const filesToDelete = existingFileIds.filter((id) => !newFileIds.includes(id));

      if (filesToDelete.length > 0) {
        await prisma.botFile.deleteMany({
          where: {
            id: { in: filesToDelete },
            botConfigId: params.id,
          },
        });
      }

      // Update or create files
      for (const file of validated.files) {
        if (file.id && existingFileIds.includes(file.id)) {
          // Update existing file
          await prisma.botFile.update({
            where: { id: file.id },
            data: {
              fileName: file.fileName,
              fileType: file.fileType,
              content: file.content,
              isMain: file.isMain,
            },
          });
        } else {
          // Create new file
          await prisma.botFile.create({
            data: {
              botConfigId: params.id,
              fileName: file.fileName,
              fileType: file.fileType,
              content: file.content,
              isMain: file.isMain,
            },
          });
        }
      }
    }

    // Update config
    const updateData: any = {};
    if (validated.name) updateData.name = validated.name;
    if (validated.description !== undefined) updateData.description = validated.description;

    const updated = await prisma.botConfig.update({
      where: { id: params.id },
      data: updateData,
      include: {
        files: {
          orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error('Update bot config error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update bot config' },
      { status: 500 }
    );
  }
}

// DELETE - Delete bot config
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

    const config = await prisma.botConfig.findUnique({
      where: { id: params.id },
    });

    if (!config || config.userId !== payload.userId) {
      return NextResponse.json(
        { success: false, error: 'Bot config not found' },
        { status: 404 }
      );
    }

    // Stop bot if running
    if (config.isRunning) {
      await prisma.botConfig.update({
        where: { id: params.id },
        data: {
          isActive: false,
          isRunning: false,
          lastStopped: new Date(),
        },
      });
    }

    // Delete config (files will be deleted via cascade)
    await prisma.botConfig.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Delete bot config error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete bot config' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';
import { z } from 'zod';

const botFileSchema = z.object({
  id: z.string().optional(),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  content: z.string(),
  isMain: z.boolean().default(false),
});

const botConfigSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  files: z.array(botFileSchema).optional(),
});

// GET - Get single bot config
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

    const config = await prisma.botConfig.findUnique({
      where: { id: params.id },
      include: {
        files: {
          orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!config || config.userId !== payload.userId) {
      return NextResponse.json(
        { success: false, error: 'Bot config not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Get bot config error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get bot config' },
      { status: 500 }
    );
  }
}

// PUT - Update bot config
export async function PUT(
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

    const config = await prisma.botConfig.findUnique({
      where: { id: params.id },
      include: { files: true },
    });

    if (!config || config.userId !== payload.userId) {
      return NextResponse.json(
        { success: false, error: 'Bot config not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validated = botConfigSchema.parse(body);

    // Validate files if provided
    if (validated.files) {
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
      if (!hasMain && validated.files.length > 0) {
        validated.files[0].isMain = true;
      }

      // Delete files that are not in the update
      const existingFileIds = config.files.map((f) => f.id);
      const newFileIds = validated.files
        .map((f) => f.id)
        .filter((id): id is string => !!id);
      const filesToDelete = existingFileIds.filter((id) => !newFileIds.includes(id));

      if (filesToDelete.length > 0) {
        await prisma.botFile.deleteMany({
          where: {
            id: { in: filesToDelete },
            botConfigId: params.id,
          },
        });
      }

      // Update or create files
      for (const file of validated.files) {
        if (file.id && existingFileIds.includes(file.id)) {
          // Update existing file
          await prisma.botFile.update({
            where: { id: file.id },
            data: {
              fileName: file.fileName,
              fileType: file.fileType,
              content: file.content,
              isMain: file.isMain,
            },
          });
        } else {
          // Create new file
          await prisma.botFile.create({
            data: {
              botConfigId: params.id,
              fileName: file.fileName,
              fileType: file.fileType,
              content: file.content,
              isMain: file.isMain,
            },
          });
        }
      }
    }

    // Update config
    const updateData: any = {};
    if (validated.name) updateData.name = validated.name;
    if (validated.description !== undefined) updateData.description = validated.description;

    const updated = await prisma.botConfig.update({
      where: { id: params.id },
      data: updateData,
      include: {
        files: {
          orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error('Update bot config error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update bot config' },
      { status: 500 }
    );
  }
}

// DELETE - Delete bot config
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

    const config = await prisma.botConfig.findUnique({
      where: { id: params.id },
    });

    if (!config || config.userId !== payload.userId) {
      return NextResponse.json(
        { success: false, error: 'Bot config not found' },
        { status: 404 }
      );
    }

    // Stop bot if running
    if (config.isRunning) {
      await prisma.botConfig.update({
        where: { id: params.id },
        data: {
          isActive: false,
          isRunning: false,
          lastStopped: new Date(),
        },
      });
    }

    // Delete config (files will be deleted via cascade)
    await prisma.botConfig.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Delete bot config error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete bot config' },
      { status: 500 }
    );
  }
}



