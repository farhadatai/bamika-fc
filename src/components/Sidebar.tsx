import React from 'react';
import { Link } from 'react-router-dom';

export const Sidebar = () => {
  return (
    <div className="w-64 bg-gray-900 text-white p-4">
      <h2 className="text-2xl font-bold mb-4">Dashboard</h2>
      <nav>
        <ul>
          <li><Link to="/dashboard" className="block py-2 px-4 rounded hover:bg-gray-700">Home</Link></li>
          <li><Link to="/admin" className="block py-2 px-4 rounded hover:bg-gray-700">Admin</Link></li>
          <li><Link to="/coach" className="block py-2 px-4 rounded hover:bg-gray-700">Coach</Link></li>
        </ul>
      </nav>
    </div>
  );
};