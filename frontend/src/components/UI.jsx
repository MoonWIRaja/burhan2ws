import { cn } from '../utils';

export function Card({ children, className, ...props }) {
  return (
    <div className={cn('iso-card p-6', className)} {...props}>
      {children}
    </div>
  );
}

export function StatsCard({ icon: Icon, title, value, trend, className, ...props }) {
  return (
    <div className={cn('iso-stats-card', className)} {...props}>
      <div className="relative z-10">
        {Icon && (
          <div className="iso-icon inline-flex mb-4">
            <Icon className="text-purple-400" size={32} />
          </div>
        )}
        <h3 className="text-slate-400 text-sm font-medium mb-1">{title}</h3>
        <p className="text-3xl font-bold text-white mb-2">{value}</p>
        {trend && (
          <p className={cn('text-sm', trend.positive ? 'text-green-400' : 'text-red-400')}>
            {trend.value} {trend.label}
          </p>
        )}
      </div>
    </div>
  );
}

export function Button({ children, className, icon: Icon, ...props }) {
  return (
    <button className={cn('iso-button flex items-center gap-2', className)} {...props}>
      {Icon && <Icon size={20} />}
      {children}
    </button>
  );
}

export function Input({ className, ...props }) {
  return (
    <input className={cn('iso-input w-full', className)} {...props} />
  );
}

export function Badge({ children, variant = 'default', className }) {
  const variants = {
    default: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <span
      className={cn(
        'px-3 py-1 rounded-full text-xs font-medium border',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function LoadingSpinner({ size = 'md' }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex items-center justify-center">
      <div
        className={cn(
          'border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin',
          sizes[size]
        )}
      />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, ...props }) {
  return (
    <div className="text-center py-12" {...props}>
      {Icon && (
        <div className="iso-icon inline-flex mb-4 mx-auto">
          <Icon className="text-purple-400" size={48} />
        </div>
      )}
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 mb-4">{description}</p>
      {action}
    </div>
  );
}
