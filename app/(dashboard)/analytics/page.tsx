'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { NeonBox } from '@/components/neon/neon-box';
import {
  BarChart3,
  TrendingUp,
  Send,
  Bot,
  Users,
  MessageSquare,
  Download,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

interface ChartData {
  date: string;
  blastSent: number;
  blastDelivered: number;
  blastRead: number;
  botInteractions: number;
  messagesReceived: number;
  newContacts: number;
}

interface Summary {
  totalBlasts: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  botInteractions: number;
  totalContacts: number;
  messagesReceived: number;
}

export default function AnalyticsPage() {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchData();
  }, [days]);

  const fetchData = async () => {
    try {
      const [chartRes, summaryRes] = await Promise.all([
        fetch(`/api/analytics/chart?days=${days}`),
        fetch('/api/analytics/summary'),
      ]);

      const chartJson = await chartRes.json();
      const summaryJson = await summaryRes.json();

      if (chartJson.success) setChartData(chartJson.data);
      if (summaryJson.success) setSummary(summaryJson.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const successRate = summary
    ? ((summary.deliveredCount / Math.max(summary.sentCount, 1)) * 100).toFixed(1)
    : '0';

  return (
    <div className="flex flex-col h-full">
      <Header title="Analytics" subtitle="Track your performance" />

      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Period Selector */}
        <div className="flex items-center gap-2">
          {[7, 14, 30, 90].map((d) => (
            <Button
              key={d}
              variant={days === d ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDays(d)}
            >
              {d} Days
            </Button>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NeonBox variant="card" className="neon-shift">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-[var(--neon-cyan)]/20">
                <Send className="h-6 w-6 text-[var(--neon-cyan)]" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-dim)]">Total Sent</p>
                <p className="text-2xl font-cyber font-bold neon-text">
                  {summary?.sentCount.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </NeonBox>

          <NeonBox variant="card" className="neon-shift">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-[var(--neon-green)]/20">
                <TrendingUp className="h-6 w-6 text-[var(--neon-green)]" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-dim)]">Success Rate</p>
                <p className="text-2xl font-cyber font-bold text-[var(--neon-green)]">
                  {successRate}%
                </p>
              </div>
            </div>
          </NeonBox>

          <NeonBox variant="card" className="neon-shift">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-[var(--neon-purple)]/20">
                <Bot className="h-6 w-6 text-[var(--neon-purple)]" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-dim)]">Bot Interactions</p>
                <p className="text-2xl font-cyber font-bold text-[var(--neon-purple)]">
                  {summary?.botInteractions.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </NeonBox>

          <NeonBox variant="card" className="neon-shift">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-[var(--neon-orange)]/20">
                <Users className="h-6 w-6 text-[var(--neon-orange)]" />
              </div>
              <div>
                <p className="text-sm text-[var(--text-dim)]">Total Contacts</p>
                <p className="text-2xl font-cyber font-bold text-[var(--neon-orange)]">
                  {summary?.totalContacts.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </NeonBox>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Blast Performance Chart */}
          <Card variant="neon">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Blast Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--neon-cyan)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--neon-cyan)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--neon-green)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--neon-green)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorRead" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--neon-purple)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--neon-purple)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--text-dim)" opacity={0.2} />
                    <XAxis dataKey="date" stroke="var(--text-dim)" fontSize={10} />
                    <YAxis stroke="var(--text-dim)" fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--panel)',
                        border: '1px solid var(--neon-color-primary)',
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="blastSent"
                      stroke="var(--neon-cyan)"
                      fill="url(#colorSent)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="blastDelivered"
                      stroke="var(--neon-green)"
                      fill="url(#colorDelivered)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="blastRead"
                      stroke="var(--neon-purple)"
                      fill="url(#colorRead)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Bot & Messages Chart */}
          <Card variant="neon">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Messages & Bot Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--text-dim)" opacity={0.2} />
                    <XAxis dataKey="date" stroke="var(--text-dim)" fontSize={10} />
                    <YAxis stroke="var(--text-dim)" fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--panel)',
                        border: '1px solid var(--neon-color-primary)',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="messagesReceived"
                      stroke="var(--neon-blue)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="botInteractions"
                      stroke="var(--neon-magenta)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="newContacts"
                      stroke="var(--neon-orange)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}



