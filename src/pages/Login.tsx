import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        throw new Error(error.message);
      }

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-neutral-900/50 border border-gray-800 rounded-2xl p-8">
        <div className="text-center mb-8">
          <img src="/logo.jpg" alt="Bamika FC Logo" className="h-24 w-auto mx-auto mb-8" />
          <h1 className="text-4xl font-black uppercase italic text-white">Welcome <span className="text-[#D4AF37]">Back</span></h1>
          <p className="text-gray-400 mt-2">Sign in to access the Bamika FC portal.</p>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded-md mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            name="email"
            placeholder="Email Address"
            onChange={handleInputChange}
            className="input-primary"
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            onChange={handleInputChange}
            className="input-primary"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full pt-4 pb-4"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="text-center mt-6">
          <p className="text-gray-400">
            Don't have an account?{' '}
            <Link to="/register" className="font-bold text-[#EF4444] hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </div>
    </div>
  );
}
