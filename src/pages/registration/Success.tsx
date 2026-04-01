import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, ArrowRight } from 'lucide-react';
import Confetti from 'react-confetti';
import { supabase } from '../../lib/supabase';

export default function RegistrationSuccess() {
  const [searchParams] = useSearchParams();
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(true);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const fetchPlayerName = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }

      try {
        // This is a placeholder for fetching the player name based on the session_id
        // You would typically have an API route that can look up the session and get the associated player.
        setPlayerName('Player'); // Placeholder
      } catch (error) {
        console.error('Error fetching player name:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerName();
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center p-4">
      <Confetti recycle={false} />
      <div className="bg-white p-8 md:p-12 rounded-2xl shadow-2xl max-w-lg w-full transform transition-all animate-fade-in-up">
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 bg-green-100 rounded-full animate-ping-slow"></div>
          <CheckCircle className="relative w-full h-full text-green-500" />
        </div>

        <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Registration Successful!</h1>
        <p className="text-xl text-gray-600 mb-6">
          Welcome to the Bamika FC family, <span className="font-bold text-primary">{loading ? '...' : playerName}</span>!
        </p>

        <p className="text-gray-500 mb-8">
          Your registration is now complete. You can now view your player status and team assignments in your dashboard.
        </p>

        <Link 
          to="/dashboard"
          className="inline-flex items-center gap-2 bg-primary text-white font-bold text-lg px-8 py-4 rounded-xl hover:bg-red-700 transition-transform transform hover:scale-105 shadow-lg"
        >
          Go to Dashboard <ArrowRight size={22} />
        </Link>
      </div>
    </div>
  );
}
