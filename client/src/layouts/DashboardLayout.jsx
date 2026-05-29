import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, KeyRound, Activity, ScrollText,
  FolderOpen, LogOut, Zap, Bell, ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';
import { authApi } from '../api/auth.api.js';
import toast from 'react-hot-toast';

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/projects',  icon: FolderOpen,       label: 'Projects'   },
  { to: '/keys',      icon: KeyRound,          label: 'API Keys'   },
  { to: '/logs',      icon: ScrollText,        label: 'Logs'       },
  { to: '/analytics', icon: Activity,          label: 'Analytics'  },
];

export const DashboardLayout = () => {
  const [open, setOpen] = useState(true);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await authApi.logout(); } finally {
      logout();
      navigate('/login');
      toast.success('Logged out');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--color-bg-base)' }}>

      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <motion.aside
        animate={{ width: open ? 240 : 64 }}
        transition={{ duration: 0.22, ease: 'easeInOut' }}
        style={{
          background: 'var(--color-bg-surface)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', flexShrink: 0, position: 'relative', zIndex: 10,
        }}
      >
        {/* Logo */}
        <div style={{
          padding: '1.25rem 1rem', display: 'flex', alignItems: 'center',
          gap: 10, borderBottom: '1px solid var(--color-border)', minHeight: 64, flexShrink: 0,
        }}>
          <div style={{
            width: 32, height: 32, flexShrink: 0,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={16} color="#fff" />
          </div>
          <AnimatePresence>
            {open && (
              <motion.span
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--color-text-primary)', whiteSpace: 'nowrap' }}
              >
                APIForge
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '0.75rem 0.5rem', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
              title={!open ? label : undefined}
              style={{ justifyContent: open ? 'flex-start' : 'center' }}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              <AnimatePresence>
                {open && (
                  <motion.span
                    initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
            </NavLink>
          ))}
        </nav>

        {/* User + Logout */}
        <div style={{ padding: '0.75rem 0.5rem', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
          {open && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.5rem 0.5rem', marginBottom: 4 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, color: '#fff',
              }}>
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.firstName} {user?.lastName}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.email}
                </div>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="sidebar-link"
            style={{
              width: '100%', border: 'none', background: 'transparent',
              justifyContent: open ? 'flex-start' : 'center',
              color: 'var(--color-danger)',
            }}
          >
            <LogOut size={16} style={{ flexShrink: 0 }} />
            <AnimatePresence>
              {open && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Log Out</motion.span>}
            </AnimatePresence>
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            position: 'absolute', top: '50%',
            left: open ? 228 : 52,
            transform: 'translateY(-50%)',
            width: 22, height: 22, borderRadius: '50%',
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 11, color: 'var(--color-text-muted)',
            transition: 'left 0.22s',
          }}
        >
          <ChevronRight size={12} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.22s' }} />
        </button>
      </motion.aside>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <header style={{
          height: 64, borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          padding: '0 1.5rem', gap: 12, background: 'var(--color-bg-surface)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)', boxShadow: '0 0 6px var(--color-success)' }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>All systems operational</span>
          </div>
          <button className="btn btn-ghost btn-sm" title="Notifications">
            <Bell size={16} />
          </button>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: '2rem', overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
