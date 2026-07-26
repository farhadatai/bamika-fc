import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// Handles both halves of the flow:
// - No session: ask for an email and send the Supabase recovery link.
// - Session present (arrived from the recovery email, or already logged in):
//   let the user set a new password.
export default function ResetPassword() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
      setEmail(data.session?.user.email || '');
      setCheckingSession(false);
    };

    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
      setEmail((current) => session?.user.email || current);
      setCheckingSession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setMessage('Check your email for a password reset link. It may take a minute and could land in spam.');
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage('Password updated. Opening your dashboard...');
    window.setTimeout(() => navigate('/dashboard'), 900);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4 text-white">
      <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-neutral-900 p-6 shadow-2xl shadow-black/40 sm:p-8">
        <div className="mb-8 text-center">
          <img src="/logo.png" alt="Bamika FC Logo" className="mx-auto mb-6 h-20 w-auto" />
          <h1 className="text-4xl font-black uppercase italic leading-tight">
            Reset <span className="text-[#D4AF37]">Password</span>
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-400">
            {hasSession
              ? 'Choose a new password for your account.'
              : 'Enter your email and we will send you a reset link.'}
          </p>
        </div>

        {checkingSession ? (
          <div className="rounded-xl border border-gray-800 bg-black p-6 text-center text-sm font-black uppercase tracking-widest text-gray-500">
            Loading...
          </div>
        ) : hasSession ? (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            {error && <div className="rounded-xl border border-red-700 bg-red-950/60 p-4 text-sm text-red-200">{error}</div>}
            {message && <div className="rounded-xl border border-green-700 bg-green-950/60 p-4 text-sm text-green-200">{message}</div>}

            {email && (
              <div className="rounded-xl border border-gray-800 bg-black p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Account</div>
                <div className="mt-1 font-bold text-white">{email}</div>
              </div>
            )}

            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-primary w-full"
              required
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-primary w-full"
              required
            />

            <button type="submit" disabled={loading} className="btn-primary w-full py-4">
              {loading ? 'Saving...' : 'Save New Password'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSendResetEmail} className="space-y-4">
            {error && <div className="rounded-xl border border-red-700 bg-red-950/60 p-4 text-sm text-red-200">{error}</div>}
            {message && <div className="rounded-xl border border-green-700 bg-green-950/60 p-4 text-sm text-green-200">{message}</div>}

            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-primary w-full"
              required
            />

            <button type="submit" disabled={loading} className="btn-primary w-full py-4">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <p className="text-center text-sm text-gray-500">
              Remembered it?{' '}
              <a href="/login" className="font-bold text-[#EF4444] hover:underline">Back to login</a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
