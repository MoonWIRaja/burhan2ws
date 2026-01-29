import { PrismaClient } from '@prisma/client';

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

export async function initPrisma() {
  try {
    await prisma.$connect();
    return prisma;
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }
}

export async function disconnectPrisma() {
  await prisma.$disconnect();
}

export function getPrisma() {
  return prisma;
}

export default prisma;
