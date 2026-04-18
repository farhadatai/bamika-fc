import React from 'react';
import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';

export const Navbar = () => {
  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 bg-black/95 backdrop-blur-md shadow-lg py-3`}>
      <div className="container mx-auto px-6 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 group">
          <img src="/logo.png" alt="Bamika FC" className="h-10 w-auto" />
          <span className="text-2xl font-bold tracking-tighter uppercase text-white">
            Bamika <span className="text-[#EF4444]">FC</span>
          </span>
        </Link>
        <div className="hidden md:flex items-center gap-8 font-medium text-white">
          <Link to="/" className="hover:text-[#EF4444] transition-colors">Home</Link>
          <Link to="/training-lab" className="hover:text-[#EF4444] transition-colors">Training Lab</Link>
          <a href="#programs" className="hover:text-[#EF4444] transition-colors">Programs</a>
          <a href="#contact" className="hover:text-[#EF4444] transition-colors">Contact</a>
        </div>
        <div className="hidden md:block">
          <Link to="/login" className="border-2 border-white text-white px-6 py-2 rounded-full font-bold hover:bg-white hover:text-black transition-all flex items-center gap-2">
            <LogIn size={18} /> Login
          </Link>
        </div>
      </div>
    </nav>
  );
};