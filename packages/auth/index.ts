import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

// Prisma client will be initialized by the consuming application
// We export a function that accepts the PrismaClient
export function createAuth(prisma: any) {
    return betterAuth({
        database: prismaAdapter(prisma, {
            provider: "postgresql",
        }),
        emailAndPassword: {
            enabled: true,
        },
        // Note: role configuration may vary by better-auth version
        // Adjust based on your better-auth version
    });
}

// Export a default auth instance (will be initialized with Prisma Client)
// For now, export the createAuth function for flexibility
export { createAuth as auth };
