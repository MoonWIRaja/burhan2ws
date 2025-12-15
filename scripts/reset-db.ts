import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDatabase() {
  try {
    console.log('Starting database reset...');

    // Find admin user
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    if (!adminUser) {
      console.log('No admin user found. Creating admin user...');
      await prisma.user.create({
        data: {
          role: 'ADMIN',
          status: 'ACTIVE',
          name: 'Admin',
        },
      });
      console.log('Admin user created.');
    } else {
      console.log('Admin user found:', adminUser.id);
    }

    // Get all non-admin users
    const nonAdminUsers = await prisma.user.findMany({
      where: {
        role: { not: 'ADMIN' },
      },
      select: { id: true },
    });

    console.log(`Found ${nonAdminUsers.length} non-admin users to delete`);

    // Delete all data for non-admin users (cascade will handle related data)
    for (const user of nonAdminUsers) {
      console.log(`Deleting user ${user.id} and all related data...`);
      
      // Delete user (cascade will delete all related data)
      await prisma.user.delete({
        where: { id: user.id },
      });
    }

    // Also clear WhatsApp sessions directory for deleted users
    const fs = await import('fs');
    const path = await import('path');
    const sessionsDir = path.join(process.cwd(), '.wa-sessions');
    
    if (fs.existsSync(sessionsDir)) {
      const dirs = fs.readdirSync(sessionsDir);
      for (const dir of dirs) {
        // Keep admin session if exists
        if (adminUser && dir === adminUser.id) {
          continue;
        }
        const userDir = path.join(sessionsDir, dir);
        if (fs.statSync(userDir).isDirectory()) {
          console.log(`Removing session directory: ${dir}`);
          fs.rmSync(userDir, { recursive: true, force: true });
        }
      }
    }

    console.log('Database reset completed successfully!');
    console.log('All users except admin have been deleted.');
    console.log('All related data (contacts, chats, messages, blasts, etc.) have been deleted.');
    
  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
