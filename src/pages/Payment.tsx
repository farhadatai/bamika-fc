import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader, CreditCard, ArrowLeft } from 'lucide-react';

interface RegistrationPayment {
  id: string;
  first_name: string;
  last_name: string;
  dob: string;
  photo_url?: string;
}

export default function Payment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const registrationId = searchParams.get('registration_id');
  
  const [player, setPlayer] = useState<RegistrationPayment | null>(null);
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
      } catch (err: unknown) {
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create checkout session');
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
      <div className="mx-auto mt-10 max-w-md rounded-lg border border-red-200 bg-red-50 p-5 text-center sm:mt-20 sm:p-6">
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="bg-white max-w-md w-full rounded-xl shadow-xl overflow-hidden">
        <div className="bg-primary p-6 text-white text-center">
          <h1 className="text-2xl font-bold">Complete Registration</h1>
          <p className="opacity-90">Secure Payment</p>
        </div>
        
        <div className="p-5 sm:p-8">
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
            <div className="mb-2 flex justify-between gap-4">
              <span className="text-gray-600">Membership</span>
              <span className="font-bold">$50/mo promo</span>
            </div>
            <div className="mb-2 flex justify-between gap-4">
              <span className="text-gray-600">Registration Fee</span>
              <span className="font-bold text-green-600">Waived</span>
            </div>
            <div className="mb-2 flex justify-between gap-4">
              <span className="text-gray-600">Uniform Package</span>
              <span className="font-bold">$100.00</span>
            </div>
            <p className="mb-3 text-xs text-gray-500">Includes game jersey, shorts, socks, and practice jersey.</p>
            <div className="flex flex-col gap-2 border-t border-gray-200 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-lg font-bold">Checkout</span>
              <span className="text-2xl font-bold text-primary">$100 + $50/mo</span>
            </div>
            <p className="mt-2 text-xs text-gray-500">Promo applies to signups through June 30. Starting July 1, new signups pay the registration fee and regular monthly rate.</p>
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
