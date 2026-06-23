import React, { useState } from 'react';
import { BarChart2, Tv, ArrowRight, Sparkles, MessageSquare, Cloud, Sliders, Play, X, Lock } from 'lucide-react';
import { getApiUrl } from '../App';

function LandingPage({ onJoinStudent, onEnterDashboard, savedAdminPassword }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Admin Modal States
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminInputPw, setAdminInputPw] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');

  const handleJoin = async (e) => {
    e.preventDefault();
    const cleanCode = code.trim().replace(/\s/g, '');
    if (cleanCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(getApiUrl(`/api/presentations/code/${cleanCode}`));
      if (response.ok) {
        onJoinStudent(cleanCode);
      } else {
        const data = await response.json();
        setError(data.error || 'Invalid session code. Try again!');
      }
    } catch (err) {
      setError('Connection error. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length <= 6) {
      setCode(val);
      setError('');
    }
  };

  const handlePresenterPortalClick = async () => {
    if (savedAdminPassword) {
      setAdminLoading(true);
      try {
        const res = await fetch(getApiUrl('/api/admin/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: savedAdminPassword })
        });
        if (res.ok) {
          onEnterDashboard(savedAdminPassword);
          return;
        }
      } catch (err) {
        console.error(err);
      } finally {
        setAdminLoading(false);
      }
    }
    setShowAdminModal(true);
  };

  const handleAdminLoginSubmit = async (e) => {
    e.preventDefault();
    if (!adminInputPw.trim()) return;

    setAdminLoading(true);
    setAdminError('');

    try {
      const res = await fetch(getApiUrl('/api/admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminInputPw.trim() })
      });
      if (res.ok) {
        onEnterDashboard(adminInputPw.trim());
        setShowAdminModal(false);
      } else {
        setAdminError('Invalid password. Access denied.');
      }
    } catch (err) {
      setAdminError('Server connection error.');
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Decorative Grid Lines */}
      <div style={styles.gridOverlay}></div>

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logoContainer}>
          <div style={styles.logoIcon}>
            <BarChart2 size={24} color="#fff" />
          </div>
          <span style={styles.logoText}>VibeVote</span>
        </div>
        <button onClick={handlePresenterPortalClick} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
          <Tv size={16} /> Presenter Portal
        </button>
      </header>

      {/* Hero Section */}
      <div style={styles.heroSection}>
        <div className="animate-slide-up" style={styles.taglineCard}>
          <Sparkles size={14} color="var(--secondary)" />
          <span>Real-time classroom interaction</span>
        </div>

        <h1 className="animate-slide-up" style={styles.title}>
          Connect with your <br />
          <span className="text-gradient-purple">Audience</span> in Real Time
        </h1>

        <p className="animate-slide-up" style={styles.subtitle}>
          Create engaging live polls, dynamic word clouds, slider scales, and open-ended Q&As. Zero-friction joining for students.
        </p>

        {/* Code entry box */}
        <div className="glass-panel animate-scale-in" style={styles.joinCard}>
          <h2 style={styles.joinTitle}>Join a Presentation</h2>
          <p style={styles.joinSubtitle}>Enter the 6-digit code displayed on the screen</p>
          
          <form onSubmit={handleJoin} style={styles.form}>
            <div style={styles.inputContainer}>
              <input
                type="text"
                placeholder="123 456"
                value={code}
                onChange={handleCodeChange}
                className="input-field"
                style={styles.codeInput}
                disabled={loading}
              />
              <button
                type="submit"
                className="btn-primary"
                style={styles.joinBtn}
                disabled={loading || code.length !== 6}
              >
                {loading ? 'Joining...' : <ArrowRight size={20} />}
              </button>
            </div>
            {error && <div style={styles.errorMsg}>{error}</div>}
          </form>
        </div>
      </div>

      {/* Features Grid */}
      <div style={styles.featuresSection}>
        <div className="glass-panel" style={styles.featureCard}>
          <div style={{ ...styles.featureIcon, background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)' }}>
            <BarChart2 size={20} />
          </div>
          <h3 style={styles.featureTitle}>Live Polling</h3>
          <p style={styles.featureDesc}>Multiple-choice voting with smooth, animated bar charts updating live.</p>
        </div>

        <div className="glass-panel" style={styles.featureCard}>
          <div style={{ ...styles.featureIcon, background: 'rgba(6, 182, 212, 0.15)', color: 'var(--secondary)' }}>
            <Cloud size={20} />
          </div>
          <h3 style={styles.featureTitle}>Word Clouds</h3>
          <p style={styles.featureDesc}>Watch popular ideas grow larger in an interactive text collage.</p>
        </div>

        <div className="glass-panel" style={styles.featureCard}>
          <div style={{ ...styles.featureIcon, background: 'rgba(217, 70, 239, 0.15)', color: 'var(--accent)' }}>
            <Sliders size={20} />
          </div>
          <h3 style={styles.featureTitle}>Rating Scales</h3>
          <p style={styles.featureDesc}>Students slide gauges to submit averages for multiple topics simultaneously.</p>
        </div>

        <div className="glass-panel" style={styles.featureCard}>
          <div style={{ ...styles.featureIcon, background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
            <MessageSquare size={20} />
          </div>
          <h3 style={styles.featureTitle}>Open Q&A</h3>
          <p style={styles.featureDesc}>Collect direct feedback, questions, or comments in a clean dashboard grid.</p>
        </div>
      </div>

      {/* Admin Password Modal */}
      {showAdminModal && (
        <div style={styles.modalBackdrop} onClick={() => setShowAdminModal(false)}>
          <div className="glass-panel" style={styles.adminModal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={16} color="var(--primary)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold' }}>Presenter Security</h3>
              </div>
              <button onClick={() => setShowAdminModal(false)} style={styles.modalCloseBtn}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAdminLoginSubmit}>
              <p style={styles.modalInstruction}>Enter the admin password to access the Dashboard:</p>
              <input
                type="password"
                placeholder="Admin Password"
                value={adminInputPw}
                onChange={e => setAdminInputPw(e.target.value)}
                className="input-field"
                style={{ marginBottom: '16px', letterSpacing: '0.05em' }}
                disabled={adminLoading}
                autoFocus
              />
              {adminError && <div style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: '12px', fontWeight: 500 }}>{adminError}</div>}
              <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={adminLoading}>
                {adminLoading ? 'Authenticating...' : 'Enter Dashboard'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 24px 60px 24px',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    position: 'relative',
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 0)',
    backgroundSize: '24px 24px',
    zIndex: -1,
  },
  header: {
    height: '80px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border-dark)',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
  },
  logoText: {
    fontFamily: 'var(--font-heading)',
    fontSize: '1.4rem',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #fff 50%, var(--text-dark-secondary) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  heroSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '80px 0 60px 0',
    flex: 1,
  },
  taglineCard: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border-dark)',
    padding: '6px 16px',
    borderRadius: '100px',
    fontSize: '0.85rem',
    color: 'var(--text-dark-secondary)',
    marginBottom: '24px',
    fontWeight: 500,
  },
  title: {
    fontSize: '3.5rem',
    lineHeight: 1.15,
    marginBottom: '24px',
    fontWeight: '800',
  },
  subtitle: {
    fontSize: '1.15rem',
    color: 'var(--text-dark-secondary)',
    maxWidth: '650px',
    lineHeight: '1.6',
    marginBottom: '48px',
  },
  joinCard: {
    width: '100%',
    maxWidth: '450px',
    padding: '32px',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  joinTitle: {
    fontSize: '1.5rem',
    fontWeight: '700',
  },
  joinSubtitle: {
    fontSize: '0.9rem',
    color: 'var(--text-dark-secondary)',
    marginBottom: '10px',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    display: 'flex',
    gap: '12px',
    position: 'relative',
  },
  codeInput: {
    fontSize: '1.8rem',
    fontWeight: '700',
    letterSpacing: '0.2em',
    textAlign: 'center',
    padding: '12px',
    height: '60px',
    textTransform: 'uppercase',
  },
  joinBtn: {
    width: '60px',
    height: '60px',
    padding: 0,
    borderRadius: '12px',
    flexShrink: 0,
  },
  errorMsg: {
    color: 'var(--error)',
    fontSize: '0.85rem',
    marginTop: '10px',
    fontWeight: 500,
  },
  featuresSection: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '24px',
    paddingTop: '40px',
    borderTop: '1px solid var(--border-dark)',
  },
  featureCard: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  featureIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: '1.1rem',
    fontWeight: '600',
  },
  featureDesc: {
    fontSize: '0.85rem',
    color: 'var(--text-dark-secondary)',
    lineHeight: '1.5',
  },
  modalBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  adminModal: {
    width: '100%',
    maxWidth: '360px',
    padding: '24px',
    borderRadius: '16px',
    boxShadow: 'var(--shadow-lg)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-dark-muted)',
  },
  modalInstruction: {
    fontSize: '0.9rem',
    color: 'var(--text-dark-secondary)',
    lineHeight: '1.5',
    marginBottom: '16px',
  }
};

export default LandingPage;
