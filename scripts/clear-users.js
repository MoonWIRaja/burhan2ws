const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function clearAllUsersExceptAdmin() {
  try {
    console.log('Starting database cleanup...');

    // Find admin user
    let adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    if (!adminUser) {
      console.log('No admin user found. Creating one...');
      adminUser = await prisma.user.create({
        data: {
          role: 'ADMIN',
          status: 'ACTIVE',
          name: 'Admin',
        },
      });
      console.log('Admin user created:', adminUser.id);
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
    let deletedCount = 0;
    for (const user of nonAdminUsers) {
      try {
        console.log(`Deleting user: ${user.id}`);
        
        // Delete user (cascade will delete all related data)
        await prisma.user.delete({
          where: { id: user.id },
        });
        deletedCount++;
        
        // Delete session directory
        const sessionDir = path.join(process.cwd(), '.wa-sessions', user.id);
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
          console.log(`Deleted session directory: ${sessionDir}`);
        }
      } catch (error) {
        console.error(`Error deleting user ${user.id}:`, error.message);
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
            if (fs.statSync(dirPath).isDirectory()) {
              fs.rmSync(dirPath, { recursive: true, force: true });
              console.log(`Deleted session directory: ${dirPath}`);
            }
          } catch (error) {
            console.error(`Error deleting session dir ${dir}:`, error.message);
          }
        }
      }
    }

    console.log('\n✅ Database cleanup completed!');
    console.log(`✅ Deleted ${deletedCount} users and all their data`);
    console.log(`✅ Admin user preserved: ${adminUser.id}`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearAllUsersExceptAdmin()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });



const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function clearAllUsersExceptAdmin() {
  try {
    console.log('Starting database cleanup...');

    // Find admin user
    let adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    if (!adminUser) {
      console.log('No admin user found. Creating one...');
      adminUser = await prisma.user.create({
        data: {
          role: 'ADMIN',
          status: 'ACTIVE',
          name: 'Admin',
        },
      });
      console.log('Admin user created:', adminUser.id);
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
    let deletedCount = 0;
    for (const user of nonAdminUsers) {
      try {
        console.log(`Deleting user: ${user.id}`);
        
        // Delete user (cascade will delete all related data)
        await prisma.user.delete({
          where: { id: user.id },
        });
        deletedCount++;
        
        // Delete session directory
        const sessionDir = path.join(process.cwd(), '.wa-sessions', user.id);
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
          console.log(`Deleted session directory: ${sessionDir}`);
        }
      } catch (error) {
        console.error(`Error deleting user ${user.id}:`, error.message);
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
            if (fs.statSync(dirPath).isDirectory()) {
              fs.rmSync(dirPath, { recursive: true, force: true });
              console.log(`Deleted session directory: ${dirPath}`);
            }
          } catch (error) {
            console.error(`Error deleting session dir ${dir}:`, error.message);
          }
        }
      }
    }

    console.log('\n✅ Database cleanup completed!');
    console.log(`✅ Deleted ${deletedCount} users and all their data`);
    console.log(`✅ Admin user preserved: ${adminUser.id}`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearAllUsersExceptAdmin()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });





