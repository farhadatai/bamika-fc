import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader, CreditCard, ArrowLeft } from 'lucide-react';

export default function Payment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const registrationId = searchParams.get('registration_id');
  
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!registrationId) {
      setError('No registration ID provided');
      setLoading(false);
      return;
    }

    const fetchPlayer = async () => {
      try {
        const { data, error } = await supabase
          .from('registrations')
          .select('*')
          .eq('id', registrationId)
          .single();
          
        if (error) throw error;
        setPlayer(data);
      } catch (err: any) {
        console.error('Error fetching player:', err);
        setError('Failed to load player details');
      } finally {
        setLoading(false);
      }
    };

    fetchPlayer();
  }, [registrationId]);

  const handlePayment = async () => {
    if (!player) return;
    setLoading(true);

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          registrationId: player.id,
          successUrl: `${window.location.origin}/admin?success=true`
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <Loader className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-xl font-bold">Loading Payment Details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-20 p-6 bg-red-50 border border-red-200 rounded-lg text-center">
        <h2 className="text-red-700 font-bold text-xl mb-2">Error</h2>
        <p className="text-red-600 mb-4">{error}</p>
        <button 
          onClick={() => navigate('/admin')}
          className="text-gray-700 underline hover:text-black"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-xl shadow-xl overflow-hidden">
        <div className="bg-primary p-6 text-white text-center">
          <h1 className="text-2xl font-bold">Complete Registration</h1>
          <p className="opacity-90">Secure Payment</p>
        </div>
        
        <div className="p-8">
          <div className="flex justify-center mb-6">
            {player.photo_url ? (
              <img src={player.photo_url} alt="Player" className="w-24 h-24 rounded-full object-cover border-4 border-gray-100 shadow-md" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-3xl font-bold text-gray-500">
                {player.first_name[0]}{player.last_name[0]}
              </div>
            )}
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">{player.first_name} {player.last_name}</h2>
            <p className="text-gray-500">DOB: {new Date(player.dob).toLocaleDateString()}</p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Membership</span>
              <span className="font-bold">Monthly</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="text-lg font-bold">Total Due</span>
              <span className="text-2xl font-bold text-primary">$50.00</span>
            </div>
          </div>

          <button
            onClick={handlePayment}
            className="w-full bg-primary text-white py-4 rounded-lg font-bold text-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 shadow-lg transform active:scale-95"
          >
            <CreditCard size={24} /> Pay Now
          </button>
          
          <button
            onClick={() => navigate('/admin')}
            className="w-full mt-4 text-gray-500 font-medium hover:text-black flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} /> Cancel & Return to Admin
          </button>
        </div>
      </div>
    </div>
  );
}
