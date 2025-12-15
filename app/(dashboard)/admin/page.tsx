'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { NeonBox } from '@/components/neon/neon-box';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield,
  Users,
  Activity,
  Trash2,
  Power,
  PowerOff,
  RefreshCw,
  Phone,
} from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';
import { format } from 'date-fns';

interface User {
  id: string;
  phone?: string;
  name?: string;
  role: string;
  status: string;
  createdAt: string;
  lastLoginAt?: string;
  whatsappSession?: {
    status: string;
    phone?: string;
  };
}

interface Log {
  id: string;
  action: string;
  details?: string;
  createdAt: string;
  user?: {
    phone?: string;
    name?: string;
  };
}

export default function AdminPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    connectedSessions: 0,
  });

  useEffect(() => {
    fetchUsers();
    fetchLogs();
    fetchStats();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/admin/logs');
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleUserAction = async (userId: string, action: 'enable' | 'disable' | 'reset') => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: `User ${action}d successfully`,
          variant: 'success',
        });
        fetchUsers();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to ${action} user`,
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'var(--neon-green)';
      case 'DISABLED': return 'var(--neon-red)';
      case 'CONNECTED': return 'var(--neon-green)';
      case 'DISCONNECTED': return 'var(--neon-red)';
      default: return 'var(--neon-yellow)';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Admin Panel" subtitle="Manage users and system" />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NeonBox variant="card" className="neon-shift">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-[var(--neon-cyan)]/20">
                <Users className="h-6 w-6 text-[var(--neon-cyan)]" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-dim)]">Total Users</p>
                <p className="text-2xl font-cyber font-bold neon-text">
                  {stats.totalUsers}
                </p>
              </div>
            </div>
          </NeonBox>

          <NeonBox variant="card" className="neon-shift">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-[var(--neon-green)]/20">
                <Activity className="h-6 w-6 text-[var(--neon-green)]" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-dim)]">Active Users</p>
                <p className="text-2xl font-cyber font-bold text-[var(--neon-green)]">
                  {stats.activeUsers}
                </p>
              </div>
            </div>
          </NeonBox>

          <NeonBox variant="card" className="neon-shift">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-[var(--neon-purple)]/20">
                <Phone className="h-6 w-6 text-[var(--neon-purple)]" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-dim)]">Connected Sessions</p>
                <p className="text-2xl font-cyber font-bold text-[var(--neon-purple)]">
                  {stats.connectedSessions}
                </p>
              </div>
            </div>
          </NeonBox>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="logs">Activity Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <ScrollArea className="h-[calc(100vh-400px)]">
              <div className="space-y-4">
                {users.map((user) => (
                  <NeonBox key={user.id} variant="card" className="neon-shift">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-mono font-bold">
                            {user.name || user.phone || 'Unknown User'}
                          </h3>
                          <span
                            className="text-xs px-2 py-0.5 rounded"
                            style={{
                              background: `${getStatusColor(user.status)}20`,
                              color: getStatusColor(user.status),
                            }}
                          >
                            {user.status}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-[var(--neon-blue)]/20 text-[var(--neon-blue)]">
                            {user.role}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-[var(--text-dim)] font-mono">
                          <span>Phone: {user.phone || 'N/A'}</span>
                          <span>Created: {format(new Date(user.createdAt), 'dd/MM/yyyy')}</span>
                          {user.lastLoginAt && (
                            <span>Last Login: {format(new Date(user.lastLoginAt), 'dd/MM/yyyy HH:mm')}</span>
                          )}
                        </div>
                        {user.whatsappSession && (
                          <div className="flex items-center gap-2 text-xs">
                            <span
                              className="flex items-center gap-1"
                              style={{ color: getStatusColor(user.whatsappSession.status) }}
                            >
                              <Phone className="h-3 w-3" />
                              WA: {user.whatsappSession.status}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {user.role !== 'ADMIN' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleUserAction(user.id, user.status === 'ACTIVE' ? 'disable' : 'enable')}
                              title={user.status === 'ACTIVE' ? 'Disable User' : 'Enable User'}
                            >
                              {user.status === 'ACTIVE' ? (
                                <PowerOff className="h-4 w-4 text-[var(--neon-red)]" />
                              ) : (
                                <Power className="h-4 w-4 text-[var(--neon-green)]" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleUserAction(user.id, 'reset')}
                              title="Reset WA Session"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </NeonBox>
                ))}
                {users.length === 0 && (
                  <p className="text-center text-[var(--text-dim)] py-8">
                    No users found
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="logs">
            <ScrollArea className="h-[calc(100vh-400px)]">
              <div className="space-y-2">
                {logs.map((log) => (
                  <NeonBox key={log.id} variant="panel" className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm neon-text">{log.action}</span>
                          {log.user && (
                            <span className="text-xs text-[var(--text-dim)]">
                              by {log.user.name || log.user.phone}
                            </span>
                          )}
                        </div>
                        {log.details && (
                          <p className="text-xs text-[var(--text-dim)] font-mono truncate max-w-lg">
                            {log.details}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-[var(--text-dim)]">
                        {format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss')}
                      </span>
                    </div>
                  </NeonBox>
                ))}
                {logs.length === 0 && (
                  <p className="text-center text-[var(--text-dim)] py-8">
                    No activity logs yet
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}



