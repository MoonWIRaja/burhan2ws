#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

function log(message, color = colors.cyan) {
  console.log(`${color}[BurHan2Ws]${colors.reset} ${message}`);
}

function exec(command, options = {}) {
  try {
    execSync(command, { stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    return false;
  }
}

async function setup() {
  console.log(`
${colors.magenta}╔══════════════════════════════════════════════════════════╗
║                                                              ║
║   ██████╗ ██╗   ██╗██████╗ ██╗  ██╗ █████╗ ███╗   ██╗        ║
║   ██╔══██╗██║   ██║██╔══██╗██║  ██║██╔══██╗████╗  ██║        ║
║   ██████╔╝██║   ██║██████╔╝███████║███████║██╔██╗ ██║        ║
║   ██╔══██╗██║   ██║██╔══██╗██╔══██║██╔══██║██║╚██╗██║        ║
║   ██████╔╝╚██████╔╝██║  ██║██║  ██║██║  ██║██║ ╚████║        ║
║   ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝        ║
║                                                              ║
║              WhatsApp Automation Platform                    ║
║                   Setup & Installation                       ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝${colors.reset}
`);

  // Step 1: Check dependencies
  log('Checking system dependencies...', colors.yellow);
  
  // Step 2: Install npm packages
  log('Installing npm packages...', colors.cyan);
  if (!exec('npm install')) {
    log('Failed to install packages. Please run: npm install', colors.red);
    process.exit(1);
  }
  log('Packages installed successfully!', colors.green);

  // Step 3: Generate Prisma client
  log('Generating Prisma client...', colors.cyan);
  if (!exec('npx prisma generate')) {
    log('Failed to generate Prisma client.', colors.red);
    process.exit(1);
  }
  log('Prisma client generated!', colors.green);

  // Step 4: Push database schema
  log('Pushing database schema to MySQL...', colors.cyan);
  if (!exec('npx prisma db push')) {
    log('Failed to push database schema. Make sure MySQL is running.', colors.red);
    log('Database: dev, User: dev, Password: coderoom', colors.yellow);
    process.exit(1);
  }
  log('Database schema pushed successfully!', colors.green);

  // Step 5: Create .wa-sessions directory
  const sessionsDir = path.join(process.cwd(), '.wa-sessions');
  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
    log('Created WhatsApp sessions directory', colors.green);
  }

  console.log(`
${colors.green}╔══════════════════════════════════════════════════════════╗
║                                                              ║
║                    Setup Complete!                           ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  To start the server:                                        ║
║  ${colors.cyan}npm run dev${colors.green}                                              ║
║                                                              ║
║  Then open:                                                  ║
║  ${colors.cyan}http://localhost:3000${colors.green}                                    ║
║                                                              ║
║  Admin login:                                                ║
║  ${colors.cyan}http://localhost:3000/login/admin:admin${colors.green}                  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝${colors.reset}
`);
}

setup().catch(console.error);



