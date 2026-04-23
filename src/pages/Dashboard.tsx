import React from 'react';
import { useAuthStore } from '../store/auth';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user, userRole } = useAuthStore();

  return (
    <div className="p-8 bg-black min-h-screen text-white flex flex-col items-center">
      <div className="text-center">
        <h1 className="text-4xl font-black uppercase italic mb-4">
          Welcome, <span className="text-[#EF4444]">{user?.user_metadata.first_name}</span>
        </h1>
        <p className="text-lg text-gray-400 mb-8">Here is your central hub for all things Bamika FC.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {userRole === 'admin' && (
          <Link to="/admin" className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition-colors">
            <h2 className="text-2xl font-black uppercase italic text-white mb-2">Admin Dashboard</h2>
            <p className="text-gray-400">Manage all club operations.</p>
          </Link>
        )}

        {userRole === 'coach' && (
          <Link to="/coach" className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition-colors">
            <h2 class="text-2xl font-black uppercase italic text-white mb-2">Coach Dashboard</h2>
            <p className="text-gray-400">Access your team roster and schedule.</p>
          </Link>
        )}

        <Link to="/register/new-athlete" className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition-colors">
          <h2 class="text-2xl font-black uppercase italic text-white mb-2">Register a New Athlete</h2>
          <p className="text-gray-400">Add a new player to your family's account.</p>
        </Link>

        <Link to="/training-lab" className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition-colors">
          <h2 class="text-2xl font-black uppercase italic text-white mb-2">Training Lab</h2>
          <p className="text-gray-400">Access drills and training videos.</p>
        </Link>
      </div>
    </div>
  );
}
