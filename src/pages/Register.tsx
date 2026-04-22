import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });

    if (e.target.name === 'password') {
      const password = e.target.value;
      if (password.length < 8) {
        setPasswordError('Password must be at least 8 characters long.');
      } else if (!/[A-Z]/.test(password)) {
        setPasswordError('Password must contain at least one uppercase letter.');
      } else if (!/[a-z]/.test(password)) {
        setPasswordError('Password must contain at least one lowercase letter.');
      } else if (!/[0-9]/.test(password)) {
        setPasswordError('Password must contain at least one number.');
      } else if (!/[^A-Za-z0-9]/.test(password)) {
        setPasswordError('Password must contain at least one special character.');
      } else {
        setPasswordError(null);
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Z]/.test(formData.password)) {
      setError('Password must contain at least one uppercase letter.');
      return;
    }
    if (!/[a-z]/.test(formData.password)) {
      setError('Password must contain at least one lowercase letter.');
      return;
    }
    if (!/[0-9]/.test(formData.password)) {
      setError('Password must contain at least one number.');
      return;
    }
    if (!/[^A-Za-z0-9]/.test(formData.password)) {
      setError('Password must contain at least one special character.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phone,
          },
        },
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phone,
          });

        if (profileError) {
          throw new Error(profileError.message);
        }

        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-neutral-900/50 border border-gray-800 rounded-2xl p-8">
        <div className="text-center mb-8">
          <img src="/logo.jpg" alt="Bamika FC Logo" className="h-24 w-auto mx-auto mb-8" />
          <h1 className="text-4xl font-black uppercase italic text-white">Join <span className="text-[#EF4444]">Bamika FC</span></h1>
          <p className="text-gray-400 mt-2">Create your parent account to get started.</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {passwordError && (
            <div className="bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded-md">
              {passwordError}
            </div>
          )}

          <input
            type="text"
            name="firstName"
            placeholder="First Name"
            onChange={handleInputChange}
            className="input-primary w-full"
            required
          />
          <input
            type="text"
            name="lastName"
            placeholder="Last Name"
            onChange={handleInputChange}
            className="input-primary w-full"
            required
          />

          <input
            type="email"
            name="email"
            placeholder="Email Address"
            onChange={handleInputChange}
            className="input-primary w-full"
            required
          />
          <input
            type="tel"
            name="phone"
            placeholder="Phone Number"
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
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            onChange={handleInputChange}
            className="input-primary"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full pt-4 pb-4"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="text-center mt-6">
          <p className="text-gray-400">
            Already have an account?{' '}
            <a href="/login" className="font-bold text-[#EF4444] hover:underline">
              Log In
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
