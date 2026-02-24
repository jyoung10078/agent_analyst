import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

type AuthMode = 'login' | 'register' | 'confirm';

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  card: {
    background: 'white',
    borderRadius: '12px',
    padding: '40px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: '8px',
    color: '#1a1a2e',
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    marginBottom: '32px',
    fontSize: '14px',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    border: '1.5px solid #e0e0e0',
    borderRadius: '8px',
    fontSize: '15px',
    marginBottom: '16px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  button: {
    width: '100%',
    padding: '13px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '16px',
  },
  link: {
    textAlign: 'center',
    color: '#667eea',
    cursor: 'pointer',
    fontSize: '14px',
    textDecoration: 'underline',
  },
  error: {
    background: '#fee2e2',
    color: '#dc2626',
    padding: '10px 14px',
    borderRadius: '6px',
    marginBottom: '16px',
    fontSize: '14px',
  },
};

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, register, confirm, isLoading, error } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    try {
      if (mode === 'login') {
        await login(email, password);
        navigate('/');
      } else if (mode === 'register') {
        await register(email, password);
        setMode('confirm');
      } else if (mode === 'confirm') {
        await confirm(email, code);
        await login(email, password);
        navigate('/');
      }
    } catch (err) {
      setLocalError((err as Error).message);
    }
  };

  const displayError = localError || error;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Agent Analyst</h1>
        <p style={styles.subtitle}>
          {mode === 'login' ? 'Sign in to your account' : mode === 'register' ? 'Create an account' : 'Confirm your email'}
        </p>

        {displayError && <div style={styles.error}>{displayError}</div>}

        <form onSubmit={handleSubmit}>
          {mode !== 'confirm' && (
            <>
              <input
                style={styles.input}
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                style={styles.input}
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </>
          )}

          {mode === 'confirm' && (
            <input
              style={styles.input}
              type="text"
              placeholder="Confirmation code (check email)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          )}

          <button style={styles.button} type="submit" disabled={isLoading}>
            {isLoading ? 'Loading...' : mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Confirm'}
          </button>
        </form>

        {mode === 'login' && (
          <p style={styles.link} onClick={() => setMode('register')}>
            Don't have an account? Sign up
          </p>
        )}
        {mode === 'register' && (
          <p style={styles.link} onClick={() => setMode('login')}>
            Already have an account? Sign in
          </p>
        )}
        {mode === 'confirm' && (
          <p style={styles.link} onClick={() => setMode('register')}>
            Back to sign up
          </p>
        )}
      </div>
    </div>
  );
}
