import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';

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

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    // Get date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get analytics data
    const analytics = await prisma.analytics.findMany({
      where: {
        userId: payload.userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });

    // Fill in missing days with zeros
    const dataMap = new Map(
      analytics.map((a) => [a.date.toISOString().split('T')[0], a])
    );

    const chartData = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const data = dataMap.get(dateKey);

      chartData.push({
        date: dateKey,
        blastSent: data?.blastSent || 0,
        blastDelivered: data?.blastDelivered || 0,
        blastRead: data?.blastRead || 0,
        botInteractions: data?.botInteractions || 0,
        messagesReceived: data?.messagesReceived || 0,
        newContacts: data?.newContacts || 0,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return NextResponse.json({
      success: true,
      data: chartData,
    });
  } catch (error) {
    console.error('Get analytics chart error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get chart data' },
      { status: 500 }
    );
  }
}



