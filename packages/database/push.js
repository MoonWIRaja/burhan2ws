import { execSync } from 'child_process';
import * as path from 'path';
import * as url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

console.log('Running drizzle-kit push with auto-confirm...');

try {
  // Run drizzle-kit push with stdin input
  const result = execSync('printf "Yes, I want to execute all statements\\n" | npx drizzle-kit push --config=drizzle.config.cjs', {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
  });

  console.log('✅ Database push completed!');
} catch (error) {
  console.error('❌ Push failed:', error.message);
  process.exit(1);
}
