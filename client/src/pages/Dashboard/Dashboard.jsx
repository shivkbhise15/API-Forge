import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Activity, KeyRound, FolderOpen, AlertCircle, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { analyticsApi } from '../../api/analytics.api.js';
import { useAuthStore } from '../../store/authStore.js';

/* ── Stat Card ─────────────────────────────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, color = '#6366f1', delta }) => (
  <div className="stat-card animate-fade-in">
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} color={color} />
      </div>
      {delta !== undefined && (
        <span style={{ fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, color: delta >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(delta)}%
        </span>
      )}
    </div>
    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1 }}>{value ?? '—'}</div>
    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '0.4rem' }}>{label}</div>
  </div>
);

const SkeletonCard = () => (
  <div className="stat-card">
    <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10, marginBottom: '1rem' }} />
    <div className="skeleton" style={{ width: '60%', height: 28, borderRadius: 6, marginBottom: 8 }} />
    <div className="skeleton" style={{ width: '80%', height: 14, borderRadius: 4 }} />
  </div>
);

export const Dashboard = () => {
  const { user } = useAuthStore();

  const { data: overview, isLoading } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => analyticsApi.getOverview().then(r => r.data.data),
    refetchInterval: 60_000,
  });

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.2 }}>
            {greeting()}, {user?.firstName} 👋
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.35rem' }}>
            Here's what's happening across your projects
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.5rem 1rem' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)', boxShadow: '0 0 8px var(--color-success)' }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>All systems operational</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
        {isLoading ? [1, 2, 3, 4].map(i => <SkeletonCard key={i} />) : (
          <>
            <StatCard icon={Activity}    label="Total Requests (30d)"   value={overview?.totalRequests?.toLocaleString()} color="#6366f1" />
            <StatCard icon={AlertCircle} label="Total Errors (30d)"     value={overview?.totalErrors?.toLocaleString()}   color="#ef4444" />
            <StatCard icon={Zap}         label="Avg Response Time"      value={`${overview?.avgResponseTimeMs ?? 0}ms`}   color="#f59e0b" />
            <StatCard icon={FolderOpen}  label="Active Projects"        value={overview?.activeProjects}                  color="#22c55e" />
          </>
        )}
      </div>

      {/* Error rate alert */}
      {!isLoading && parseFloat(overview?.errorRate) > 5 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={18} color="var(--color-danger)" />
          <span style={{ fontSize: '0.875rem' }}>
            <strong style={{ color: 'var(--color-danger)' }}>High error rate — </strong>
            <span style={{ color: 'var(--color-text-secondary)' }}>{overview.errorRate}% of requests failing in the last 30 days.</span>
          </span>
        </motion.div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
          {[
            { label: 'New Project',    icon: FolderOpen, href: '/projects',  color: '#6366f1' },
            { label: 'Create API Key', icon: KeyRound,   href: '/keys',      color: '#8b5cf6' },
            { label: 'View Analytics', icon: Activity,   href: '/analytics', color: '#3b82f6' },
            { label: 'Inspect Logs',   icon: TrendingUp, href: '/logs',      color: '#22c55e' },
          ].map(a => (
            <a key={a.label} href={a.href} style={{ textDecoration: 'none' }}>
              <div
                style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.15s', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = a.color; e.currentTarget.style.background = `${a.color}0a`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
              >
                <a.icon size={18} color={a.color} />
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>{a.label}</span>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Getting Started */}
      <div className="card" style={{ borderStyle: 'dashed' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Getting Started</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
          1. Create a <a href="/projects" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>Project</a> to group your APIs.<br />
          2. Generate an <a href="/keys" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>API Key</a> and use it with <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--color-bg-elevated)', padding: '1px 6px', borderRadius: 4, fontSize: '0.82rem' }}>X-API-Key</code> header.<br />
          3. Check <a href="/logs" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>Logs</a> and <a href="/analytics" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>Analytics</a> to monitor usage.
        </p>
      </div>
    </div>
  );
};
