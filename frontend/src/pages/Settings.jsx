import { Card, Button, Badge } from '../components/UI';
import {
  Settings as SettingsIcon,
  Server,
  Database,
  Shield,
  Bell,
  Palette,
  User,
  Info,
  Zap
} from 'lucide-react';

export default function Settings() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-slate-400">Configure your burhan2ws system</p>
      </div>

      {/* System Information */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <Info className="text-purple-400" size={24} />
          <h2 className="text-xl font-semibold text-white">System Information</h2>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-slate-700">
            <span className="text-slate-400">Version</span>
            <span className="text-white">1.0.0</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-700">
            <span className="text-slate-400">Environment</span>
            <Badge variant="success">Development</Badge>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-700">
            <span className="text-slate-400">Backend</span>
            <span className="text-white">http://localhost:3000</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-slate-400">Frontend</span>
            <span className="text-white">http://localhost:5173</span>
          </div>
        </div>
      </Card>

      {/* Server Settings */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <Server className="text-purple-400" size={24} />
          <h2 className="text-xl font-semibold text-white">Server Settings</h2>
        </div>
        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h3 className="font-medium text-white mb-2">Server Port</h3>
            <p className="text-slate-400 text-sm mb-2">Port on which the backend server listens</p>
            <p className="text-white font-mono bg-slate-900/50 px-3 py-2 rounded">3000</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h3 className="font-medium text-white mb-2">WebSocket Port</h3>
            <p className="text-slate-400 text-sm mb-2">Port for real-time WebSocket connections</p>
            <p className="text-white font-mono bg-slate-900/50 px-3 py-2 rounded">3000 (shared)</p>
          </div>
        </div>
      </Card>

      {/* Database Settings */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <Database className="text-cyan-400" size={24} />
          <h2 className="text-xl font-semibold text-white">Database</h2>
        </div>
        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h3 className="font-medium text-white mb-2">Database Type</h3>
            <p className="text-slate-400 text-sm mb-2">Type of database in use</p>
            <p className="text-white font-mono bg-slate-900/50 px-3 py-2 rounded">PostgreSQL</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h3 className="font-medium text-white mb-2">Connection String</h3>
            <p className="text-slate-400 text-sm mb-2">Database connection URL</p>
            <p className="text-white font-mono text-xs bg-slate-900/50 px-3 py-2 rounded break-all">
              postgresql://***:***@localhost:5432/burhan2ws_db
            </p>
          </div>
        </div>
      </Card>

      {/* Features */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <Zap className="text-yellow-400" size={24} />
          <h2 className="text-xl font-semibold text-white">Features</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <h3 className="font-medium text-white mb-2">Multi-Session</h3>
            <p className="text-sm text-slate-400">Manage multiple WhatsApp sessions simultaneously</p>
          </div>
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <h3 className="font-medium text-white mb-2">Real-Time Updates</h3>
            <p className="text-sm text-slate-400">WebSocket for instant message delivery</p>
          </div>
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <h3 className="font-medium text-white mb-2">File Processing</h3>
            <p className="text-sm text-slate-400">Upload and process PDF, Excel, CSV files</p>
          </div>
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <h3 className="font-medium text-white mb-2">Queue System</h3>
            <p className="text-sm text-slate-400">BullMQ for efficient job processing</p>
          </div>
        </div>
      </Card>

      {/* Upcoming Features */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <Bell className="text-orange-400" size={24} />
          <h2 className="text-xl font-semibold text-white">Coming Soon</h2>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-3 py-2">
            <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
            <span className="text-slate-300">User authentication with JWT</span>
          </div>
          <div className="flex items-center gap-3 py-2">
            <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
            <span className="text-slate-300">Media file management (images, videos, audio)</span>
          </div>
          <div className="flex items-center gap-3 py-2">
            <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
            <span className="text-slate-300">Contact management</span>
          </div>
          <div className="flex items-center gap-3 py-2">
            <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
            <span className="text-slate-300">Message templates</span>
          </div>
          <div className="flex items-center gap-3 py-2">
            <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
            <span className="text-slate-300">Analytics and reporting</span>
          </div>
          <div className="flex items-center gap-3 py-2">
            <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
            <span className="text-slate-300">Webhooks for external integrations</span>
          </div>
        </div>
      </Card>

      {/* About */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <Shield className="text-green-400" size={24} />
          <h2 className="text-xl font-semibold text-white">About</h2>
        </div>
        <div className="space-y-3 text-sm">
          <p className="text-slate-300">
            <strong className="text-white">burhan2ws</strong> is a WhatsApp Web Gateway system with ISO Matrix 3D theme,
            built with modern web technologies.
          </p>
          <p className="text-slate-300">
            Powered by <strong className="text-white">@whiskeysockets/baileys</strong> for WhatsApp integration,
            <strong className="text-white"> Socket.IO</strong> for real-time communication, and
            <strong className="text-white"> BullMQ</strong> for job queuing.
          </p>
          <p className="text-slate-400 mt-4">
            Made with ❤️ by MoonWiraja
          </p>
        </div>
      </Card>
    </div>
  );
}
