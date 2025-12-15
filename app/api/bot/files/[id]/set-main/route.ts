import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';

// POST - Set file as main
export async function POST(
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

    const file = await prisma.botFile.findUnique({
      where: { id: params.id },
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

    // Unset other main files
    await prisma.botFile.updateMany({
      where: {
        botConfigId: file.botConfigId,
        id: { not: params.id },
        isMain: true,
      },
      data: { isMain: false },
    });

    // Set this file as main
    const updated = await prisma.botFile.update({
      where: { id: params.id },
      data: { isMain: true },
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Set main file error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to set main file' },
      { status: 500 }
    );
  }
}
