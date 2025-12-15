import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';

// GET - Get single bot file
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const file = await prisma.botFile.findUnique({
      where: { id },
      include: {
        botConfig: true,
      },
    });

    if (!file || file.botConfig.userId !== payload.userId) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: file,
    });
  } catch (error) {
    console.error('Get bot file error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get bot file' },
      { status: 500 }
    );
  }
}

// PUT - Update bot file
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const file = await prisma.botFile.findUnique({
      where: { id },
      include: {
        botConfig: true,
      },
    });

    if (!file || file.botConfig.userId !== payload.userId) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updateData: any = {};

    if (body.fileName) updateData.fileName = body.fileName;
    if (body.fileType) updateData.fileType = body.fileType;
    if (body.content !== undefined) {
      updateData.content = body.content;
      
      // Validate content
      if (body.fileType || file.fileType) {
        const fileType = body.fileType || file.fileType;
        const stripImports = (code: string) => {
          const patterns = [
            /import\s*\{[^}]+\}\s*from\s*['"][^'"]+['"];?/g,
            /import\s+\w+\s+from\s*['"][^'"]+['"];?/g,
            /import\s*\*\s*as\s+\w+\s*from\s*['"][^'"]+['"];?/g,
          ];
          let out = code;
          patterns.forEach((p) => {
            out = out.replace(p, '');
          });
          return out;
        };

        if (fileType === 'json') {
          try {
            JSON.parse(body.content);
          } catch {
            return NextResponse.json(
              { success: false, error: 'Invalid JSON format' },
              { status: 400 }
            );
          }
        } else if (fileType === 'javascript' || fileType === 'typescript') {
          // Skip strict validation to allow imports and runtime-injected modules
          // Syntax/runtime errors will be caught when starting the bot
        }
      }
    }
    if (body.isMain !== undefined) {
      updateData.isMain = body.isMain;
      if (body.isMain) {
        // Unset other main files
        await prisma.botFile.updateMany({
          where: {
            botConfigId: file.botConfigId,
            id: { not: id },
            isMain: true,
          },
          data: { isMain: false },
        });
      }
    }

    const updated = await prisma.botFile.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Update bot file error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update bot file' },
      { status: 500 }
    );
  }
}

// DELETE - Delete bot file
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const file = await prisma.botFile.findUnique({
      where: { id },
      include: {
        botConfig: true,
      },
    });

    if (!file || file.botConfig.userId !== payload.userId) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    await prisma.botFile.delete({
      where: { id },
    });

    // If deleted file was main, set another file as main
    if (file.isMain) {
      const nextFile = await prisma.botFile.findFirst({
        where: { botConfigId: file.botConfigId },
      });
      if (nextFile) {
        await prisma.botFile.update({
          where: { id: nextFile.id },
          data: { isMain: true },
        });
      }
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Delete bot file error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete bot file' },
      { status: 500 }
    );
  }
}



