import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, KeyRound, Copy, Check, Trash2, Ban, Loader2, X } from 'lucide-react';
import { apiKeyApi } from '../../api/apiKey.api.js';
import { projectApi } from '../../api/project.api.js';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

/* ── Helpers ──────────────────────────────────────────────────────────── */
const ScopeBadge = ({ scope }) => {
  const map = { read: 'badge-info', write: 'badge-warning', admin: 'badge-danger', analytics: 'badge-purple' };
  return <span className={`badge ${map[scope] || 'badge-muted'}`}>{scope}</span>;
};

const CopyBtn = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
      {copied ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
    </button>
  );
};

/* ── Create Key Modal ─────────────────────────────────────────────────── */
const CreateModal = ({ projects, onClose }) => {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', description: '', projectId: '', scopes: ['read'], expiresAt: '' });

  const toggleScope = (s) => setForm(f => ({
    ...f, scopes: f.scopes.includes(s) ? f.scopes.filter(x => x !== s) : [...f.scopes, s],
  }));

  const mutation = useMutation({
    mutationFn: apiKeyApi.create,
    onSuccess: (res) => { qc.invalidateQueries(['apiKeys']); onClose(res.data.data.fullKey); },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create key'),
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} onClick={() => onClose(null)}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="card-elevated" style={{ width: '100%', maxWidth: 480, padding: '1.75rem' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Create API Key</h2>
          <button onClick={() => onClose(null)} className="btn btn-ghost btn-sm"><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="input-label">Key Name *</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Production Backend" />
          </div>
          <div>
            <label className="input-label">Project *</label>
            <select className="input" value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}>
              <option value="">Select a project...</option>
              {projects.map(p => <option key={p._id} value={p._id}>{p.name} · {p.environment}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Description</label>
            <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
          </div>
          <div>
            <label className="input-label">Scopes</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['read', 'write', 'admin', 'analytics'].map(s => (
                <button key={s} type="button" onClick={() => toggleScope(s)}
                  className={`badge ${form.scopes.includes(s) ? 'badge-purple' : 'badge-muted'}`}
                  style={{ cursor: 'pointer', border: form.scopes.includes(s) ? '1px solid rgba(99,102,241,0.4)' : undefined }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="input-label">Expires At (optional)</label>
            <input type="datetime-local" className="input" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} style={{ colorScheme: 'dark' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
          <button onClick={() => onClose(null)} className="btn btn-ghost">Cancel</button>
          <button className="btn btn-primary" disabled={!form.name || !form.projectId || mutation.isPending}
            onClick={() => mutation.mutate({ ...form, expiresAt: form.expiresAt || undefined })}>
            {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> Create Key</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* ── Key Reveal Modal (shown ONCE after creation) ─────────────────────── */
const RevealModal = ({ fullKey, onClose }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: '1rem' }}>
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      className="card-elevated" style={{ maxWidth: 520, width: '100%', padding: '2rem', textAlign: 'center' }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
        <KeyRound size={24} color="var(--color-warning)" />
      </div>
      <h2 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>Save your API key now</h2>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
        This key will <strong style={{ color: 'var(--color-danger)' }}>never be shown again</strong>. Copy it and store it securely.
      </p>
      <div className="code-block" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem', textAlign: 'left' }}>
        <span style={{ flex: 1, wordBreak: 'break-all' }}>{fullKey}</span>
        <CopyBtn text={fullKey} />
      </div>
      <button onClick={onClose} className="btn btn-primary" style={{ margin: '0 auto' }}>
        <Check size={16} /> I've saved my key
      </button>
    </motion.div>
  </div>
);

/* ── Page ─────────────────────────────────────────────────────────────── */
export const ApiKeys = () => {
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [revealKey, setRevealKey]   = useState(null);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.list().then(r => r.data.data.projects),
  });

  const { data: keysData, isLoading } = useQuery({
    queryKey: ['apiKeys', projectId],
    queryFn: () => apiKeyApi.list(projectId).then(r => r.data.data),
    enabled: !!projectId,
  });

  const revokeMutation = useMutation({
    mutationFn: apiKeyApi.revoke,
    onSuccess: () => { qc.invalidateQueries(['apiKeys']); toast.success('Key revoked.'); },
    onError: () => toast.error('Failed to revoke key.'),
  });

  const deleteMutation = useMutation({
    mutationFn: apiKeyApi.delete,
    onSuccess: () => { qc.invalidateQueries(['apiKeys']); toast.success('Key deleted.'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Revoke the key first.'),
  });

  const keys = keysData?.keys || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>API Keys</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: 4 }}>Manage authentication keys for your projects</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)} disabled={!projects.length}>
          <Plus size={16} /> New API Key
        </button>
      </div>

      {/* Project filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', fontWeight: 500, flexShrink: 0 }}>Project:</span>
        <select className="input" style={{ maxWidth: 300 }} value={projectId} onChange={e => setProjectId(e.target.value)}>
          <option value="">Select a project...</option>
          {projects.map(p => <option key={p._id} value={p._id}>{p.name} · {p.environment}</option>)}
        </select>
      </div>

      {/* Keys table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {!projectId ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <KeyRound size={40} color="var(--color-text-muted)" style={{ margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--color-text-muted)' }}>Select a project to view its API keys</p>
          </div>
        ) : isLoading ? (
          <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 6 }} />)}
          </div>
        ) : keys.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--color-text-muted)' }}>No API keys yet. Create one above.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Key Prefix</th>
                <th>Scopes</th>
                <th>Status</th>
                <th>Last Used</th>
                <th>Requests</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k._id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>{k.name}</div>
                    {k.description && <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{k.description}</div>}
                  </td>
                  <td><code className="code-block" style={{ padding: '2px 8px', fontSize: '0.78rem' }}>ak_{k.keyPrefix}...</code></td>
                  <td><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{k.scopes.map(s => <ScopeBadge key={s} scope={s} />)}</div></td>
                  <td><span className={`badge ${k.isActive ? 'badge-success' : 'badge-danger'}`}>{k.isActive ? 'Active' : 'Revoked'}</span></td>
                  <td style={{ fontSize: '0.8rem' }}>{k.lastUsedAt ? format(new Date(k.lastUsedAt), 'MMM d, HH:mm') : 'Never'}</td>
                  <td style={{ fontWeight: 600 }}>{k.totalRequests.toLocaleString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {k.isActive && (
                        <button className="btn btn-ghost btn-sm" title="Revoke"
                          onClick={() => window.confirm('Revoke this key? This cannot be undone.') && revokeMutation.mutate(k._id)}>
                          <Ban size={14} />
                        </button>
                      )}
                      {!k.isActive && (
                        <button className="btn btn-danger btn-sm" title="Delete permanently"
                          onClick={() => window.confirm('Delete this key permanently?') && deleteMutation.mutate(k._id)}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCreate && <CreateModal projects={projects} onClose={(key) => { setShowCreate(false); if (key) setRevealKey(key); }} />}
        {revealKey  && <RevealModal fullKey={revealKey} onClose={() => setRevealKey(null)} />}
      </AnimatePresence>
    </div>
  );
};
