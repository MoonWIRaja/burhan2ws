import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// Clear all users except admin
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
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    console.log('[Admin] Starting database cleanup...');

    // Find admin user
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    if (!adminUser) {
      return NextResponse.json(
        { success: false, error: 'Admin user not found' },
        { status: 404 }
      );
    }

    // Get all non-admin users
    const nonAdminUsers = await prisma.user.findMany({
      where: {
        role: { not: 'ADMIN' },
      },
      select: { id: true },
    });

    console.log(`[Admin] Found ${nonAdminUsers.length} non-admin users to delete`);

    // Delete all data for non-admin users (cascade will handle related data)
    let deletedCount = 0;
    for (const user of nonAdminUsers) {
      try {
        // Delete user (cascade will delete all related data)
        await prisma.user.delete({
          where: { id: user.id },
        });
        deletedCount++;
        
        // Delete session directory
        const sessionDir = path.join(process.cwd(), '.wa-sessions', user.id);
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        }
      } catch (error) {
        console.error(`[Admin] Error deleting user ${user.id}:`, error);
      }
    }

    // Clear all session directories except admin
    const sessionsDir = path.join(process.cwd(), '.wa-sessions');
    if (fs.existsSync(sessionsDir)) {
      const dirs = fs.readdirSync(sessionsDir);
      for (const dir of dirs) {
        if (dir !== adminUser.id) {
          const dirPath = path.join(sessionsDir, dir);
          try {
            fs.rmSync(dirPath, { recursive: true, force: true });
          } catch (error) {
            console.error(`[Admin] Error deleting session dir ${dir}:`, error);
          }
        }
      }
    }

    console.log(`[Admin] Database cleanup completed! Deleted ${deletedCount} users`);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deletedCount} users and cleared their sessions`,
      deletedCount,
    });
  } catch (error) {
    console.error('[Admin] Clear users error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clear users' },
      { status: 500 }
    );
  }
}



import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// Clear all users except admin
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
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    console.log('[Admin] Starting database cleanup...');

    // Find admin user
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    if (!adminUser) {
      return NextResponse.json(
        { success: false, error: 'Admin user not found' },
        { status: 404 }
      );
    }

    // Get all non-admin users
    const nonAdminUsers = await prisma.user.findMany({
      where: {
        role: { not: 'ADMIN' },
      },
      select: { id: true },
    });

    console.log(`[Admin] Found ${nonAdminUsers.length} non-admin users to delete`);

    // Delete all data for non-admin users (cascade will handle related data)
    let deletedCount = 0;
    for (const user of nonAdminUsers) {
      try {
        // Delete user (cascade will delete all related data)
        await prisma.user.delete({
          where: { id: user.id },
        });
        deletedCount++;
        
        // Delete session directory
        const sessionDir = path.join(process.cwd(), '.wa-sessions', user.id);
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        }
      } catch (error) {
        console.error(`[Admin] Error deleting user ${user.id}:`, error);
      }
    }

    // Clear all session directories except admin
    const sessionsDir = path.join(process.cwd(), '.wa-sessions');
    if (fs.existsSync(sessionsDir)) {
      const dirs = fs.readdirSync(sessionsDir);
      for (const dir of dirs) {
        if (dir !== adminUser.id) {
          const dirPath = path.join(sessionsDir, dir);
          try {
            fs.rmSync(dirPath, { recursive: true, force: true });
          } catch (error) {
            console.error(`[Admin] Error deleting session dir ${dir}:`, error);
          }
        }
      }
    }

    console.log(`[Admin] Database cleanup completed! Deleted ${deletedCount} users`);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deletedCount} users and cleared their sessions`,
      deletedCount,
    });
  } catch (error) {
    console.error('[Admin] Clear users error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clear users' },
      { status: 500 }
    );
  }
}





