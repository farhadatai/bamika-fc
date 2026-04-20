import React from 'react';
import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="bg-black border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="text-2xl font-black uppercase italic text-white">
              Bamika <span className="text-[#EF4444]">FC</span>
            </Link>
          </div>
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <Link to="/login" className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">Login</Link>
              <Link to="/register" className="bg-[#EF4444] text-white px-3 py-2 rounded-md text-sm font-medium">Register</Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
