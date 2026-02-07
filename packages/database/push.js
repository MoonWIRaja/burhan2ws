import { execSync } from 'child_process';
import * as path from 'path';
import * as url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

console.log('Running drizzle-kit push with auto-confirm...');

try {
  // Run drizzle-kit push with stdin input
  const result = execSync('echo y | npx drizzle-kit push', {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
  });

  console.log('✅ Database push completed!');
} catch (error) {
  console.error('❌ Push failed:', error.message);
  process.exit(1);
}
