import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/prisma/client';
import { z } from 'zod';

// Basic import transformer so user bot code with `import` doesn't fail validation
function transformImports(code: string): string {
  const patterns = [
    /import\s+(\w+)\s*,\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g, // default + named
    /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g,
    /import\s+(\w+)\s+from\s*['"]([^'"]+)['"];?/g,
    /import\s*\*\s*as\s+(\w+)\s*from\s*['"]([^'"]+)['"];?/g,
  ];
  let transformed = code;
  const injected: string[] = [];

  const normalize = (mod: string) => mod?.replace(/[@/.-]/g, '_') || 'mod';

  transformed = transformed.replace(patterns[0], (match, defaultName, imports, module) => {
    const mod = normalize(module);
    if (module === 'node-fetch') {
      injected.push(`const ${defaultName} = bot.modules?.fetch;`);
      injected.push(`const { ${imports.trim()} } = { fetch: bot.modules?.fetch };`);
      return '';
    }
    injected.push(`const ${defaultName} = (bot.modules?.${mod} || {}).default || bot.modules?.${mod};`);
    injected.push(`const { ${imports.trim()} } = bot.modules?.${mod} || {};`);
    return '';
  });
  transformed = transformed.replace(patterns[1], (match, imports, module) => {
    const mod = normalize(module);
    if (module === 'node-fetch') {
      injected.push(`const { ${imports.trim()} } = { fetch: bot.modules?.fetch };`);
      return '';
    }
    injected.push(`const { ${imports.trim()} } = bot.modules?.${mod} || {};`);
    return '';
  });
  transformed = transformed.replace(patterns[2], (match, name, module) => {
    const mod = normalize(module);
    if (module === 'node-fetch') {
      injected.push(`const ${name} = bot.modules?.fetch;`);
      return '';
    }
    injected.push(`const ${name} = (bot.modules?.${mod} || {}).default || bot.modules?.${mod};`);
    return '';
  });
  transformed = transformed.replace(patterns[3], (match, name, module) => {
    const mod = normalize(module);
    if (module === 'node-fetch') {
      injected.push(`const ${name} = bot.modules?.fetch;`);
      return '';
    }
    injected.push(`const ${name} = bot.modules?.${mod};`);
    return '';
  });

  if (injected.length > 0) {
    transformed = `${injected.join('\n')}\n${transformed}`;
  }
  return transformed;
}

const controlSchema = z.object({
  action: z.enum(['start', 'stop', 'restart']),
});

// POST - Control bot (start/stop/restart)
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
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = controlSchema.parse(body);

    // Get or create bot config for user
    let botConfig = await prisma.botConfig.findUnique({
      where: { userId: payload.userId },
      include: {
        files: {
          orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!botConfig) {
      botConfig = await prisma.botConfig.create({
        data: {
          userId: payload.userId,
        },
        include: {
          files: {
            where: { isMain: true },
            take: 1,
          },
        },
      });
    }

    // Validate configuration before starting
    if (validated.action === 'start' || validated.action === 'restart') {
      if (botConfig.files.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No main file found. Please create at least one file and set it as main.' },
          { status: 400 }
        );
      }

      const mainFile = botConfig.files.find((f) => f.isMain) || botConfig.files[0];
      if (mainFile.fileType === 'json') {
        try {
          JSON.parse(mainFile.content);
        } catch {
          return NextResponse.json(
            { success: false, error: 'Invalid JSON configuration. Please fix the JSON before starting the bot.' },
            { status: 400 }
          );
        }
      } else if (mainFile.fileType === 'javascript' || mainFile.fileType === 'typescript') {
        // Skip strict validation to allow imports; runtime errors will be surfaced while running
      } else {
        return NextResponse.json(
          { success: false, error: 'Unsupported file type. Please use JavaScript, TypeScript, or JSON.' },
          { status: 400 }
        );
      }
    }

    let updateData: any = {};

    if (validated.action === 'start') {
      updateData = {
        isActive: true,
        isRunning: true,
        lastStarted: new Date(),
        activeFileId: botConfig.files[0]?.id || null,
      };
    } else if (validated.action === 'stop') {
      updateData = {
        isActive: false,
        isRunning: false,
        lastStopped: new Date(),
      };
    } else if (validated.action === 'restart') {
      // Stop first, then start
      updateData = {
        isActive: true,
        isRunning: true,
        lastStopped: new Date(),
        lastStarted: new Date(),
        activeFileId: botConfig.files[0]?.id || null,
      };
    }

    const updated = await prisma.botConfig.update({
      where: { id: botConfig.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Bot ${validated.action}ped successfully`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error('Bot control error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to control bot' },
      { status: 500 }
    );
  }
}
