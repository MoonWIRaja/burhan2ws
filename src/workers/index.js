import { initWorkers } from '../services/queueService.js';

// Start workers
console.log('🚀 Starting BullMQ workers...');
await initWorkers();

console.log('✅ Workers are running. Press Ctrl+C to stop.');

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing workers');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing workers');
  process.exit(0);
});
