import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, FolderOpen, Trash2, Zap, Loader2, X } from 'lucide-react';
import { projectApi } from '../../api/project.api.js';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const ENV_BADGE = { development: 'badge-info', staging: 'badge-warning', production: 'badge-success' };
const ENV_BAR   = {
  development: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
  staging:     'linear-gradient(90deg, #f59e0b, #d97706)',
  production:  'linear-gradient(90deg, #22c55e, #16a34a)',
};

/* ── Create Modal ─────────────────────────────────────────────────────── */
const CreateModal = ({ onClose }) => {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', description: '', environment: 'development', settings: { rateLimitPerMin: 60 } });

  const mutation = useMutation({
    mutationFn: projectApi.create,
    onSuccess: () => { qc.invalidateQueries(['projects']); toast.success('Project created!'); onClose(); },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create project'),
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="card-elevated" style={{ width: '100%', maxWidth: 460, padding: '1.75rem' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>New Project</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm"><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="input-label">Project Name *</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My Awesome API" />
          </div>
          <div>
            <label className="input-label">Description</label>
            <textarea className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description..." rows={3} />
          </div>
          <div>
            <label className="input-label">Environment</label>
            <select className="input" value={form.environment} onChange={e => setForm(f => ({ ...f, environment: e.target.value }))}>
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </div>
          <div>
            <label className="input-label">Rate Limit (requests / min)</label>
            <input type="number" className="input" min={1} max={10000} value={form.settings.rateLimitPerMin}
              onChange={e => setForm(f => ({ ...f, settings: { ...f.settings, rateLimitPerMin: Number(e.target.value) } }))} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button className="btn btn-primary" disabled={!form.name || mutation.isPending} onClick={() => mutation.mutate(form)}>
            {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> Create</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* ── Project Card ─────────────────────────────────────────────────────── */
const ProjectCard = ({ project, onDelete }) => (
  <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
    whileHover={{ y: -2 }} transition={{ duration: 0.15 }}
    className="card" style={{ position: 'relative', overflow: 'hidden', cursor: 'default' }}>
    {/* Env color bar */}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: ENV_BAR[project.environment] }} />
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FolderOpen size={18} color="var(--color-primary)" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>{project.name}</div>
          <span className={`badge ${ENV_BADGE[project.environment]}`} style={{ marginTop: 2 }}>{project.environment}</span>
        </div>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={() => onDelete(project._id)}><Trash2 size={14} /></button>
    </div>
    {project.description && <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>{project.description}</p>}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
      {[
        { label: 'Total Requests', value: (project.stats?.totalRequests || 0).toLocaleString() },
        { label: 'API Keys',       value: project.stats?.totalApiKeys || 0 },
      ].map(s => (
        <div key={s.label} style={{ background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{s.label}</div>
          <div style={{ fontSize: '1rem', fontWeight: 700 }}>{s.value}</div>
        </div>
      ))}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
        <Zap size={12} /> {project.settings?.rateLimitPerMin}/min
      </span>
      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
        {format(new Date(project.createdAt), 'MMM d, yyyy')}
      </span>
    </div>
  </motion.div>
);

/* ── Page ─────────────────────────────────────────────────────────────── */
export const Projects = () => {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.list().then(r => r.data.data.projects),
  });

  const deleteMutation = useMutation({
    mutationFn: projectApi.delete,
    onSuccess: () => { qc.invalidateQueries(['projects']); toast.success('Project deleted.'); },
    onError: () => toast.error('Failed to delete project.'),
  });

  const handleDelete = (id) => {
    if (window.confirm('Delete this project? API keys remain but the project will be deactivated.')) deleteMutation.mutate(id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Projects</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: 4 }}>Organize your APIs into projects</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Project
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 200, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      ) : projects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <FolderOpen size={48} color="var(--color-text-muted)" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>No projects yet</h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>Create your first project to start generating API keys.</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Create First Project</button>
        </div>
      ) : (
        <motion.div layout style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          <AnimatePresence>
            {projects.map(p => <ProjectCard key={p._id} project={p} onDelete={handleDelete} />)}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence>
        {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>
    </div>
  );
};
