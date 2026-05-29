import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { authApi } from '../../api/auth.api.js';
import { useAuthStore } from '../../store/authStore.js';
import toast from 'react-hot-toast';

export const Login = () => {
  const [form, setForm]       = useState({ email: '', password: '' });
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState({});
  const { setAuth }           = useAuthStore();
  const navigate              = useNavigate();

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setErrors(er => ({ ...er, [e.target.name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authApi.login(form);
      setAuth({ user: data.data.user, accessToken: data.data.accessToken });
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      const status = err.response?.status;
      const fieldErrors = err.response?.data?.errors || [];

      if (fieldErrors.length) {
        const erMap = {};
        fieldErrors.forEach(e => { erMap[e.field] = e.message; });
        setErrors(erMap);
      } else if (status === 403) {
        toast.error('Please verify your email before signing in. Check your inbox.');
      } else {
        toast.error(err.response?.data?.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--color-bg-base)', padding: '1.5rem',
    }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(99,102,241,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(139,92,246,0.06) 0%, transparent 50%)' }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        style={{ width: '100%', maxWidth: 420, position: 'relative' }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '2rem', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={20} color="#fff" />
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #f1f5f9, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            APIForge
          </span>
        </div>

        <div className="card-elevated" style={{ padding: '2rem' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.25rem' }}>Sign in</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.75rem' }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>Create one</Link>
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label className="input-label">Email address</label>
              <input
                name="email" type="email"
                className={`input${errors.email ? ' error' : ''}`}
                value={form.email} onChange={handleChange}
                placeholder="you@company.com" autoComplete="email" required
              />
              {errors.email && <p style={{ color: 'var(--color-danger)', fontSize: '0.75rem', marginTop: 4 }}>{errors.email}</p>}
            </div>

            <div>
              <label className="input-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  name="password" type={showPw ? 'text' : 'password'}
                  className={`input${errors.password ? ' error' : ''}`}
                  value={form.password} onChange={handleChange}
                  placeholder="••••••••" autoComplete="current-password" required
                  style={{ paddingRight: '2.75rem' }}
                />
                <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p style={{ color: 'var(--color-danger)', fontSize: '0.75rem', marginTop: 4 }}>{errors.password}</p>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Link to="/forgot-password" style={{ fontSize: '0.8rem', color: 'var(--color-primary)', textDecoration: 'none' }}>
                Forgot password?
              </Link>
            </div>

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: '0.25rem' }}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : <>Sign in <ArrowRight size={16} /></>}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
