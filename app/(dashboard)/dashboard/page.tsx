'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NeonBox } from '@/components/neon/neon-box';
import {
  Send,
  CheckCircle,
  Eye,
  XCircle,
  Bot,
  Users,
  MessageSquare,
  TrendingUp,
} from 'lucide-react';

interface DashboardStats {
  totalBlasts: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  botInteractions: number;
  totalContacts: number;
  messagesReceived: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalBlasts: 0,
    sentCount: 0,
    deliveredCount: 0,
    readCount: 0,
    failedCount: 0,
    botInteractions: 0,
    totalContacts: 0,
    messagesReceived: 0,
  });
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'qr_pending'>('connected');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/analytics/summary');
        const data = await res.json();
        if (data.success) {
          setStats(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/whatsapp/status');
        const data = await res.json();
        setConnectionStatus(data.status || 'disconnected');
      } catch (error) {
        console.error('Failed to fetch status:', error);
      }
    };

    fetchStats();
    fetchStatus();

    const interval = setInterval(() => {
      fetchStats();
      fetchStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const statCards = [
    {
      title: 'Total Blasts',
      value: stats.totalBlasts,
      icon: Send,
      color: 'var(--neon-cyan)',
    },
    {
      title: 'Sent',
      value: stats.sentCount,
      icon: CheckCircle,
      color: 'var(--neon-blue)',
    },
    {
      title: 'Delivered',
      value: stats.deliveredCount,
      icon: CheckCircle,
      color: 'var(--neon-green)',
    },
    {
      title: 'Read',
      value: stats.readCount,
      icon: Eye,
      color: 'var(--neon-purple)',
    },
    {
      title: 'Failed',
      value: stats.failedCount,
      icon: XCircle,
      color: 'var(--neon-red)',
    },
    {
      title: 'Bot Interactions',
      value: stats.botInteractions,
      icon: Bot,
      color: 'var(--neon-magenta)',
    },
    {
      title: 'Total Contacts',
      value: stats.totalContacts,
      icon: Users,
      color: 'var(--neon-orange)',
    },
    {
      title: 'Messages Received',
      value: stats.messagesReceived,
      icon: MessageSquare,
      color: 'var(--neon-yellow)',
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Dashboard"
        subtitle="Welcome to BurHan2Ws"
        connectionStatus={connectionStatus}
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <NeonBox key={index} variant="card" className="neon-shift">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[var(--text-dim)] font-mono">
                      {stat.title}
                    </p>
                    <p
                      className="text-3xl font-cyber font-bold mt-1"
                      style={{
                        color: stat.color,
                        textShadow: `0 0 10px ${stat.color}`,
                      }}
                    >
                      {stat.value.toLocaleString()}
                    </p>
                  </div>
                  <div
                    className="p-3 rounded-lg"
                    style={{
                      background: `${stat.color}20`,
                      boxShadow: `0 0 15px ${stat.color}40`,
                    }}
                  >
                    <Icon
                      className="h-6 w-6"
                      style={{ color: stat.color }}
                    />
                  </div>
                </div>
              </NeonBox>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card variant="neon">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Quick Blast
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[var(--text-dim)] font-mono text-sm mb-4">
                Send a quick message blast to your contacts
              </p>
              <a
                href="/blast"
                className="neon-button inline-block"
              >
                Create Blast
              </a>
            </CardContent>
          </Card>

          <Card variant="neon">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Bot Automation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[var(--text-dim)] font-mono text-sm mb-4">
                Configure auto-reply rules and chatbot flows
              </p>
              <a
                href="/bot"
                className="neon-button inline-block"
              >
                Configure Bot
              </a>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card variant="neon">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-[var(--text-dim)] font-mono text-sm text-center py-8">
                Activity data will appear here once you start using the platform
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
