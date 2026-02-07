#!/usr/bin/env node

/**
 * Kill processes using backend and frontend ports
 * Backend port: from .env PORT (default 3001)
 * Frontend port: from .env FRONTEND_PORT or default 3000
 */

import { exec } from "child_process";
import { promisify } from "util";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read .env file
function readEnv() {
  try {
    const envPath = join(__dirname, "../../.env");
    const envContent = readFileSync(envPath, "utf-8");
    const env = {};
    for (const line of envContent.split("\n")) {
      const [key, ...valueParts] = line.split("=");
      const value = valueParts.join("=").trim();
      if (key && value) {
        env[key.trim()] = value;
      }
    }
    return env;
  } catch {
    return {};
  }
}

const env = readEnv();
const backendPort = env.PORT || "3001";
const frontendPort = env.FRONTEND_PORT || "3000";

const ports = [
  { name: "Backend", port: backendPort },
  { name: "Frontend", port: frontendPort },
];

console.log(`[Kill Port] Checking ports: ${backendPort} (backend), ${frontendPort} (frontend)...`);

// Platform-specific commands
const isWindows = process.platform === "win32";

async function killPort(port) {
  try {
    if (isWindows) {
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      if (!stdout.trim()) return;

      const lines = stdout.split("\n").filter(line => line.includes("LISTENING"));
      const pids = new Set();

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== "0") {
          pids.add(pid);
        }
      }

      for (const pid of pids) {
        console.log(`[Kill Port] Killing PID ${pid} (port ${port})...`);
        await execAsync(`taskkill /F /PID ${pid}`);
      }
    } else {
      try {
        const { stdout } = await execAsync(`lsof -ti:${port}`);
        const pids = stdout.trim().split("\n").filter(Boolean);

        for (const pid of pids) {
          console.log(`[Kill Port] Killing PID ${pid} (port ${port})...`);
          await execAsync(`kill -9 ${pid}`);
        }
      } catch {
        // Port is free
      }
    }
  } catch {
    // Port is free
  }
}

async function killAll() {
  for (const { name, port } of ports) {
    await killPort(port);
  }
  console.log(`[Kill Port] ✅ Ports cleared`);
}

killAll().catch(console.error);
