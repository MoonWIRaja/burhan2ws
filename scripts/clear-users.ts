import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearAllUsersExceptAdmin() {
  try {
    console.log('Starting database cleanup...');

    // Find admin user
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    if (!adminUser) {
      console.log('No admin user found. Creating one...');
      const newAdmin = await prisma.user.create({
        data: {
          role: 'ADMIN',
          status: 'ACTIVE',
          name: 'Admin',
        },
      });
      console.log('Admin user created:', newAdmin.id);
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
      console.log(`Deleting user: ${user.id}`);
      
      // Delete user (cascade will delete all related data)
      await prisma.user.delete({
        where: { id: user.id },
      });
    }

    console.log('Database cleanup completed!');
    console.log(`Deleted ${nonAdminUsers.length} users and all their data`);
    
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearAllUsersExceptAdmin();



import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearAllUsersExceptAdmin() {
  try {
    console.log('Starting database cleanup...');

    // Find admin user
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    if (!adminUser) {
      console.log('No admin user found. Creating one...');
      const newAdmin = await prisma.user.create({
        data: {
          role: 'ADMIN',
          status: 'ACTIVE',
          name: 'Admin',
        },
      });
      console.log('Admin user created:', newAdmin.id);
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
      console.log(`Deleting user: ${user.id}`);
      
      // Delete user (cascade will delete all related data)
      await prisma.user.delete({
        where: { id: user.id },
      });
    }

    console.log('Database cleanup completed!');
    console.log(`Deleted ${nonAdminUsers.length} users and all their data`);
    
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearAllUsersExceptAdmin();





