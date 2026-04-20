import React from 'react';

export default function Home() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
      <h1 className="text-5xl font-black uppercase italic text-center mb-4">
        Welcome to <span className="text-[#EF4444]">Bamika FC</span>
      </h1>
      <p className="text-xl text-gray-400 mb-8 text-center">
        The future of youth soccer development.
      </p>
      <div className="flex space-x-4">
        <a href="/login" className="bg-[#EF4444] text-white px-6 py-3 rounded-md font-bold uppercase hover:bg-red-700">
          Login
        </a>
        <a href="/register" className="bg-gray-800 text-white px-6 py-3 rounded-md font-bold uppercase hover:bg-gray-700">
          Register
        </a>
      </div>
    </div>
  );
}
