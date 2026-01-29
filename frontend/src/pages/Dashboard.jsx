import { useQuery } from '@tanstack/react-query';
import { statsApi } from '../services/api';
import { LoadingSpinner } from '../components/UI';
import {
  Smartphone,
  MessageSquare,
  FileText,
  Activity,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Zap,
  Users,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

export default function Dashboard() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: () => statsApi.getOverview().then((res) => res.data),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stats-card text-center py-12">
        <XCircle className="text-red-400 mx-auto mb-4" size={48} />
        <p className="text-red-400 font-semibold">Failed to load statistics</p>
      </div>
    );
  }

  const data = stats?.data;

  const statsData = [
    {
      title: 'Total Sessions',
      value: data?.sessions?.total || 0,
      subtitle: `${data?.sessions?.connected || 0} connected`,
      icon: Smartphone,
      gradient: 'from-indigo-500 to-purple-500',
      trend: 'up',
      trendValue: '+12%',
      color: 'indigo'
    },
    {
      title: 'Total Messages',
      value: data?.messages?.total || 0,
      subtitle: `+${data?.messages?.today || 0} today`,
      icon: MessageSquare,
      gradient: 'from-purple-500 to-pink-500',
      trend: 'up',
      trendValue: '+8%',
      color: 'purple'
    },
    {
      title: 'Total Files',
      value: data?.files?.total || 0,
      subtitle: `+${data?.files?.today || 0} today`,
      icon: FileText,
      gradient: 'from-cyan-500 to-blue-500',
      trend: 'up',
      trendValue: '+23%',
      color: 'cyan'
    },
    {
      title: 'Active Jobs',
      value: (data?.queue?.messages?.active || 0) + (data?.queue?.files?.active || 0),
      subtitle: `${data?.queue?.messages?.waiting || 0} waiting`,
      icon: Activity,
      gradient: 'from-emerald-500 to-teal-500',
      trend: 'down',
      trendValue: '-5%',
      color: 'emerald'
    },
  ];

  return (
    <div className="space-y-4">
      {/* Welcome Section - Compact */}
      <div className="card-modern p-4 animate-scale-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold gradient-text">
              Welcome Back! 👋
            </h1>
          </div>
          <div className="hidden md:block">
            <div className="iso-icon p-3">
              <Zap className="text-white" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid - Compact */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statsData.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              className={`stats-card p-3 animate-slide-up stagger-${Math.min(index + 1, 5)}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className={`iso-icon p-2 bg-gradient-to-br ${stat.gradient}`}>
                  <Icon className="text-white" size={18} />
                </div>
              </div>

              <div className="text-2xl font-bold bg-gradient-to-br from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1">
                {stat.value.toLocaleString()}
              </div>

              <div className="text-xs text-slate-400 font-medium">
                {stat.title}
              </div>
            </div>
          );
        })}
      </div>

      {/* Session Status & Quick Actions - Compact */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Session Status */}
        <div className="lg:col-span-2 card-modern p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <div className="iso-icon p-2 bg-gradient-to-br from-indigo-500 to-purple-500">
                <Smartphone className="text-white" size={16} />
              </div>
              Session Status
            </h2>
            <div className="badge badge-success text-xs">Live</div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="stats-card p-3 text-center">
              <div className="text-xl font-bold text-emerald-400 mb-1">
                {data?.sessions?.connected || 0}
              </div>
              <div className="text-xs text-slate-400">Connected</div>
            </div>

            <div className="stats-card p-3 text-center">
              <div className="text-xl font-bold text-yellow-400 mb-1">
                {data?.sessions?.qr || 0}
              </div>
              <div className="text-xs text-slate-400">QR</div>
            </div>

            <div className="stats-card p-3 text-center">
              <div className="text-xl font-bold text-red-400 mb-1">
                {data?.sessions?.disconnected || 0}
              </div>
              <div className="text-xs text-slate-400">Offline</div>
            </div>

            <div className="stats-card p-3 text-center">
              <div className="text-xl font-bold text-purple-400 mb-1">
                {data?.sessions?.connecting || 0}
              </div>
              <div className="text-xs text-slate-400">Connecting</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card-modern p-4">
          <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <div className="iso-icon p-2 bg-gradient-to-br from-emerald-500 to-teal-500">
              <Zap className="text-white" size={16} />
            </div>
            Quick Actions
          </h2>

          <div className="space-y-2">
            <button className="w-full nav-item py-2 px-3 text-sm">
              <Smartphone size={16} />
              <div className="flex-1 text-left font-medium">New Session</div>
            </button>

            <button className="w-full nav-item py-2 px-3 text-sm">
              <MessageSquare size={16} />
              <div className="flex-1 text-left font-medium">Send Message</div>
            </button>

            <button className="w-full nav-item py-2 px-3 text-sm">
              <FileText size={16} />
              <div className="flex-1 text-left font-medium">Upload File</div>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity - Compact */}
      <div className="card-modern p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp size={18} className="text-purple-400" />
            Recent Activity
          </h2>
        </div>

        <div className="space-y-2">
          {[1, 2, 3].map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-slate-700/50"
            >
              <div className={`iso-icon p-2 bg-gradient-to-br ${
                index % 3 === 0 ? 'from-indigo-500 to-purple-500' :
                index % 3 === 1 ? 'from-purple-500 to-pink-500' :
                'from-cyan-500 to-blue-500'
              }`}>
                {index % 3 === 0 ? (
                  <Smartphone className="text-white" size={16} />
                ) : index % 3 === 1 ? (
                  <MessageSquare className="text-white" size={16} />
                ) : (
                  <FileText className="text-white" size={16} />
                )}
              </div>

              <div className="flex-1">
                <div className="text-sm font-semibold text-white">
                  {index % 3 === 0 ? 'Session Connected' :
                   index % 3 === 1 ? 'Messages Sent' :
                   'File Uploaded'}
                </div>
              </div>

              <div className="text-xs text-slate-400">
                {index === 0 ? 'Just now' :
                 index === 1 ? '2m ago' :
                 '5m ago'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
