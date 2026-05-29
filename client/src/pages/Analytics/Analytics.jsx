import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { analyticsApi } from '../../api/analytics.api.js';
import { projectApi } from '../../api/project.api.js';
import { format } from 'date-fns';
import { TrendingUp, Clock, AlertTriangle } from 'lucide-react';

const PIE_COLORS = { '2xx': '#22c55e', '3xx': '#3b82f6', '4xx': '#f59e0b', '5xx': '#ef4444' };

const Tooltip_ = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-light)', borderRadius: 8, padding: '10px 14px' }}>
      <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 6 }}>{label}</p>
      {payload.map(p => <p key={p.name} style={{ fontSize: '0.82rem', fontWeight: 600, color: p.color }}>{p.name}: {p.value?.toLocaleString()}</p>)}
    </div>
  );
};

export const Analytics = () => {
  const [projectId, setProjectId] = useState('');
  const [days, setDays]           = useState(30);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.list().then(r => r.data.data.projects),
  });

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['analytics', 'dashboard', projectId, days],
    queryFn: () => analyticsApi.getDashboard(projectId, days).then(r => r.data.data),
    enabled: !!projectId,
  });

  const dailyData = (analytics?.dailyVolume || []).map(d => ({
    date:    format(new Date(d.date), 'MMM d'),
    Total:   d.totalRequests,
    Success: d.successCount,
    Errors:  d.errorCount,
  }));

  const pieData = (analytics?.statusDistribution || []).map(s => ({
    name:  s.category,
    value: s.count,
    color: PIE_COLORS[s.category] || '#94a3b8',
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

      {/* Header + Controls */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Analytics</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: 4 }}>Deep metrics for your API infrastructure</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <select className="input" style={{ maxWidth: 240 }} value={projectId} onChange={e => setProjectId(e.target.value)}>
            <option value="">Select a project...</option>
            {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          <select className="input" style={{ width: 'auto' }} value={days} onChange={e => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {!projectId ? (
        <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
          <TrendingUp size={48} color="var(--color-text-muted)" style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--color-text-muted)' }}>Select a project to view its analytics</p>
        </div>
      ) : isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: 280, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      ) : (
        <>
          {/* Summary row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Total Requests',    value: analytics?.responseTime?.count?.toLocaleString() || '0', icon: TrendingUp,   color: '#6366f1' },
              { label: 'Avg Response Time', value: `${analytics?.responseTime?.avgResponseTimeMs || 0}ms`,  icon: Clock,        color: '#f59e0b' },
              { label: 'Max Response Time', value: `${analytics?.responseTime?.maxResponseTimeMs || 0}ms`,  icon: AlertTriangle, color: '#ef4444' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
                  <s.icon size={16} color={s.color} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{s.label}</span>
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Volume Chart */}
          <div className="card">
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>Request Volume · Last {days} Days</h2>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gError" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<Tooltip_ />} />
                <Area type="monotone" dataKey="Total"  stroke="#6366f1" fill="url(#gTotal)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="Errors" stroke="#ef4444" fill="url(#gError)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Status Pie + Top Endpoints */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="card">
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Status Distribution</h2>
              {pieData.length === 0 ? (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No data yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                      {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={v => v.toLocaleString()} />
                    <Legend formatter={v => <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="card">
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Top Endpoints</h2>
              {!(analytics?.topEndpoints?.length) ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No endpoint data yet</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {analytics.topEndpoints.slice(0, 6).map((ep, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', width: 16 }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className={`badge ${ep.method === 'GET' ? 'badge-info' : ep.method === 'POST' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem', padding: '1px 6px' }}>{ep.method}</span>
                          <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.endpoint}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: 3 }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{ep.count?.toLocaleString()} reqs</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{ep.avgResponseTimeMs}ms avg</span>
                          {ep.errorRate > 0 && <span style={{ fontSize: '0.72rem', color: 'var(--color-danger)' }}>{ep.errorRate}% errors</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
