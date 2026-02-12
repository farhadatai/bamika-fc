import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { CheckCircle } from 'lucide-react';

interface Registration {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  dob: string;
}

export default function Dashboard() {
  const { user, userRole } = useAuthStore();
  const navigate = useNavigate();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleChecking, setRoleChecking] = useState(true);
  const [searchParams] = useSearchParams();
  const showSuccess = searchParams.get('success') === 'true';

  useEffect(() => {
    // Immediate Store Check
    if (userRole === 'admin') {
      navigate('/admin');
      return;
    }
    if (userRole === 'coach') {
      navigate('/coach');
      return;
    }
  }, [userRole, navigate]);

  useEffect(() => {
    let mounted = true;

    async function checkRoleAndFetchData() {
      if (!user) return;

      try {
        // If store already has role, skip fetch (handled by effect above)
        // But if store is null (first load), we double check DB
        
        let currentRole = userRole;

        if (!currentRole) {
           const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
            
           currentRole = profile?.role;
        }

        if (!mounted) return;

        // Fallback: Check email if role is missing
        const isAdminEmail = user.email?.toLowerCase().includes('admin');
        
        if (currentRole === 'admin' || isAdminEmail) {
          navigate('/admin');
          return;
        } 
        
        if (currentRole === 'coach') {
          navigate('/coach');
          return;
        }

        // If we are here, we are a parent
        if (mounted) setRoleChecking(false);
        
        const { data } = await supabase
          .from('registrations')
          .select('*')
          .eq('parent_id', user.id);

        if (data && mounted) {
          setRegistrations(data);
        }
      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        if (mounted) {
          setLoading(false);
          setRoleChecking(false);
        }
      }
    }

    checkRoleAndFetchData();

    return () => {
      mounted = false;
    };
  }, [user, navigate]);

  if (roleChecking || loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="flex flex-col items-center gap-2">
          {/* Replaced Icon with Text to prevent crashes */}
          <span className="text-4xl animate-spin">⟳</span>
          <span className="text-lg font-bold text-gray-600">Loading Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-6 rounded-lg shadow-sm flex flex-col items-center text-center animate-fade-in">
          <CheckCircle className="h-16 w-16 text-green-600 mb-3" />
          <h2 className="text-2xl font-bold mb-2">Registration Successful!</h2>
          <p>Welcome to the team! Your player registration is complete.</p>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Parent Dashboard</h1>
        <Link 
          to="/register/new" 
          className="bg-primary text-white px-4 py-2 rounded-md font-bold hover:bg-red-700 transition-colors flex items-center gap-2"
        >
          + Add New Player
        </Link>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold mb-4">My Children</h2>
        
        {loading ? (
          <p>Loading...</p>
        ) : registrations.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <p className="mb-4">No players registered yet.</p>
            <Link 
              to="/register/new" 
              className="text-primary font-bold hover:underline"
            >
              Register your first child now
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {registrations.map((reg) => (
              <div key={reg.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg">{reg.first_name} {reg.last_name}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                    reg.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {reg.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600">DOB: {new Date(reg.dob).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
