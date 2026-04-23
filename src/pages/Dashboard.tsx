import React from 'react';
import { useAuthStore } from '../store/auth';
import { Shield, User, Play } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user, userRole } = useAuthStore();

  return (
    <div className="p-8 bg-black min-h-screen text-white flex flex-col items-center">
      <div className="w-full max-w-5xl text-center">
        <h1 className="text-4xl font-black uppercase italic mb-4">
          Welcome, <span className="text-[#EF4444]">{user?.user_metadata.first_name}</span>
        </h1>
        <p className="text-lg text-gray-400 mb-8">Here is your central hub for all things Bamika FC.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userRole === 'admin' && (
            <Link to="/admin" className="bg-neutral-900/50 border border-gray-800 p-6 rounded-lg hover:border-[#EF4444] hover:-translate-y-1 transition-all">
              <h2 className="text-2xl font-black uppercase italic text-white mb-2 flex items-center gap-2"><Shield />Admin Dashboard</h2>
              <p className="text-gray-400">Manage all club operations.</p>
            </Link>
          )}

          {userRole === 'coach' && (
            <Link to="/coach" className="bg-neutral-900/50 border border-gray-800 p-6 rounded-lg hover:border-[#EF4444] hover:-translate-y-1 transition-all">
              <h2 className="text-2xl font-black uppercase italic text-white mb-2 flex items-center gap-2"><Shield />Coach Dashboard</h2>
              <p className="text-gray-400">Access your team roster and schedule.</p>
            </Link>
          )}

          <Link to="/register-new-athlete" className="bg-neutral-900/50 border border-gray-800 p-6 rounded-lg hover:border-[#EF4444] hover:-translate-y-1 transition-all">
            <h2 className="text-2xl font-black uppercase italic text-white mb-2 flex items-center gap-2"><User />Register a New Athlete</h2>
            <p className="text-gray-400">Add a new player to your family's account.</p>
          </Link>

          <Link to="/training-lab" className="bg-neutral-900/50 border border-gray-800 p-6 rounded-lg hover:border-[#EF4444] hover:-translate-y-1 transition-all">
            <h2 className="text-2xl font-black uppercase italic text-white mb-2 flex items-center gap-2"><Play />Training Lab</h2>
            <p className="text-gray-400">Access drills and training videos.</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
