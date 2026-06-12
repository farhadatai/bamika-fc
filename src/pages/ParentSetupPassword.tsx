import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ParentSetupPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      setEmail(data.session?.user.email || '');
      setCheckingSession(false);
    };

    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email || '');
      setCheckingSession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
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
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setLoading(false);
      setError(updateError.message);
      return;
    }

    if (user) {
      const meta = user.user_metadata || {};
      const firstName = typeof meta.first_name === 'string' ? meta.first_name : '';
      const lastName = typeof meta.last_name === 'string' ? meta.last_name : '';
      const fullName = typeof meta.full_name === 'string' ? meta.full_name : `${firstName} ${lastName}`.trim();
      const phone = typeof meta.phone === 'string' ? meta.phone : '';

      await supabase.from('profiles').upsert({
        id: user.id,
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        email: user.email,
        phone,
        role: 'user',
      }, { onConflict: 'id' });
    }

    setLoading(false);
    setMessage('Password created. Opening your family dashboard...');
    window.setTimeout(() => navigate('/dashboard'), 900);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-4 text-white">
      <div className="w-full max-w-lg rounded-2xl border border-gray-800 bg-neutral-900 p-6 shadow-2xl shadow-black/40 sm:p-8">
        <div className="mb-8 text-center">
          <img src="/logo.png" alt="Bamika FC Logo" className="mx-auto mb-6 h-20 w-auto" />
          <h1 className="text-4xl font-black uppercase italic leading-tight">
            Parent Account <span className="text-[#D4AF37]">Setup</span>
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-400">
            Create your password to view your player, messages, and payment status.
          </p>
        </div>

        {checkingSession ? (
          <div className="rounded-xl border border-gray-800 bg-black p-6 text-center text-sm font-black uppercase tracking-widest text-gray-500">
            Checking invite...
          </div>
        ) : !email ? (
          <div className="rounded-xl border border-[#EF4444]/50 bg-[#EF4444]/10 p-5">
            <h2 className="font-black uppercase italic text-white">Invite link needed</h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">
              Please open this page from the parent invite email. If the link expired, ask your coach or club admin to send a new invite.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="rounded-xl border border-red-700 bg-red-950/60 p-4 text-sm text-red-200">{error}</div>}
            {message && <div className="rounded-xl border border-green-700 bg-green-950/60 p-4 text-sm text-green-200">{message}</div>}

            <div className="rounded-xl border border-gray-800 bg-black p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Parent email</div>
              <div className="mt-1 font-bold text-white">{email}</div>
            </div>

            <input
              type="password"
              placeholder="Create password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-primary w-full"
              required
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-primary w-full"
              required
            />

            <button type="submit" disabled={loading} className="btn-primary w-full py-4">
              {loading ? 'Saving Password...' : 'Finish Parent Setup'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
