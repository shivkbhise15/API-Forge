import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Eye, EyeOff, ArrowRight, Loader2, CheckCircle2, Mail } from 'lucide-react';
import { authApi } from '../../api/auth.api.js';
import toast from 'react-hot-toast';

export const Register = () => {
  const [form, setForm]       = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [errors, setErrors]   = useState({});
  const navigate              = useNavigate();

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setErrors(er => ({ ...er, [e.target.name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authApi.register(form);
      const autoVerified = data?.data?.user?.isEmailVerified === true;

      if (autoVerified) {
        // Dev mode: account is ready — go straight to login
        toast.success('Account created! You can sign in now.');
        navigate('/login');
      } else {
        // Production: show "check your inbox" screen
        setDone(true);
      }
    } catch (err) {
      const fieldErrors = err.response?.data?.errors || [];
      if (fieldErrors.length) {
        const erMap = {};
        fieldErrors.forEach(e => { erMap[e.field] = e.message; });
        setErrors(erMap);
      } else {
        toast.error(err.response?.data?.message || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const pwChecks = [
    { label: '8+ characters',    ok: form.password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(form.password) },
    { label: 'Lowercase letter', ok: /[a-z]/.test(form.password) },
    { label: 'Number',           ok: /\d/.test(form.password) },
  ];

  if (done) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-base)', padding: '1.5rem' }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="card-elevated" style={{ maxWidth: 420, width: '100%', textAlign: 'center', padding: '3rem 2rem' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
          <Mail size={32} color="var(--color-primary)" />
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem' }}>Verify your email</h2>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '2rem' }}>
          We sent a verification link to{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>{form.email}</strong>.<br />
          Click the link to activate your account, then sign in.
        </p>
        <button onClick={() => navigate('/login')} className="btn btn-primary" style={{ margin: '0 auto' }}>
          Go to Login <ArrowRight size={16} />
        </button>
      </motion.div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-base)', padding: '1.5rem' }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle at 80% 10%, rgba(99,102,241,0.08) 0%, transparent 50%)' }} />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        style={{ width: '100%', maxWidth: 440, position: 'relative' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '2rem', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={20} color="#fff" />
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: 800, background: 'linear-gradient(135deg, #f1f5f9, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            APIForge
          </span>
        </div>

        <div className="card-elevated" style={{ padding: '2rem' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.25rem' }}>Create your account</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.75rem' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {[['firstName', 'First name', 'John'], ['lastName', 'Last name', 'Doe']].map(([name, label, ph]) => (
                <div key={name}>
                  <label className="input-label">{label}</label>
                  <input name={name} className={`input${errors[name] ? ' error' : ''}`} value={form[name]} onChange={handleChange} placeholder={ph} required />
                  {errors[name] && <p style={{ color: 'var(--color-danger)', fontSize: '0.72rem', marginTop: 3 }}>{errors[name]}</p>}
                </div>
              ))}
            </div>

            <div>
              <label className="input-label">Email address</label>
              <input name="email" type="email" className={`input${errors.email ? ' error' : ''}`} value={form.email} onChange={handleChange} placeholder="you@company.com" required />
              {errors.email && <p style={{ color: 'var(--color-danger)', fontSize: '0.75rem', marginTop: 4 }}>{errors.email}</p>}
            </div>

            <div>
              <label className="input-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input name="password" type={showPw ? 'text' : 'password'} className={`input${errors.password ? ' error' : ''}`} value={form.password} onChange={handleChange} placeholder="••••••••" required style={{ paddingRight: '2.75rem' }} />
                <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Password strength */}
              {form.password && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 8 }}>
                  {pwChecks.map(c => (
                    <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: c.ok ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                      <CheckCircle2 size={11} style={{ opacity: c.ok ? 1 : 0.3 }} />
                      {c.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: '0.25rem' }}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : <>Create account <ArrowRight size={16} /></>}
            </button>

            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
              By creating an account you agree to our Terms of Service.
            </p>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
