import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LogIn, Menu, X, Facebook, Instagram, Shield, Award, Users, Star, Calendar, MapPin, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Handle scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 20;
      setScrolled(isScrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch upcoming events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .gte('date', new Date().toISOString().split('T')[0]) // Only future events
          .order('date', { ascending: true })
          .limit(3);

        if (error) throw error;
        setEvents(data || []);
      } catch (error) {
        console.error('Error fetching events:', error);
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchEvents();
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      
      {/* MODERN NAVBAR */}
      <nav 
        className={`fixed w-full z-50 transition-all duration-300 ${
          scrolled ? 'bg-black/95 backdrop-blur-md shadow-lg py-3' : 'bg-transparent py-5'
        }`}
      >
        <div className="container mx-auto px-6 flex justify-between items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <img src="/logo.png" alt="Bamika FC" className="h-10 w-auto" />
            <span className="text-2xl font-bold tracking-tighter uppercase text-white">
              Bamika <span className="text-[#EF4444]">FC</span>
            </span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-8 font-medium text-white">
            <Link to="/" className="hover:text-[#EF4444] transition-colors">Home</Link>
            <a href="#programs" className="hover:text-[#EF4444] transition-colors">Programs</a>
            <a href="#contact" className="hover:text-[#EF4444] transition-colors">Contact</a>
          </div>

          {/* Login Button */}
          <div className="hidden md:block">
            <Link 
              to="/login" 
              className="border-2 border-white text-white px-6 py-2 rounded-full font-bold hover:bg-white hover:text-black transition-all flex items-center gap-2"
            >
              <LogIn size={18} /> Login
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-black border-t border-white/10 py-4 px-6 space-y-4 absolute w-full">
            <Link to="/" className="block text-lg font-medium text-white hover:text-[#EF4444]" onClick={() => setMobileMenuOpen(false)}>Home</Link>
            <a href="#programs" className="block text-lg font-medium text-white hover:text-[#EF4444]" onClick={() => setMobileMenuOpen(false)}>Programs</a>
            <a href="#contact" className="block text-lg font-medium text-white hover:text-[#EF4444]" onClick={() => setMobileMenuOpen(false)}>Contact</a>
            <Link 
              to="/login" 
              className="block w-full text-center bg-white text-black px-6 py-3 rounded-full font-bold hover:bg-gray-200 transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Coach Login
            </Link>
          </div>
        )}
      </nav>

      {/* FULL-SCREEN HERO SECTION */}
      <section className="relative h-screen flex items-center justify-center">
        {/* Background Image with Overlay */}
        <div 
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: 'url("https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1920&q=80")',
            backgroundPosition: 'center',
            backgroundSize: 'cover'
          }}
        >
          {/* Dark Overlay (gradient) */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/70"></div>
        </div>

        <div className="relative z-10 container mx-auto px-6 text-center text-white space-y-8 max-w-5xl">
          <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight uppercase leading-none drop-shadow-2xl">
            BAMIKA <span className="text-[#EF4444]">FC</span>
          </h1>
          <p className="text-xl md:text-3xl text-gray-200 font-medium max-w-3xl mx-auto">
            Elk Grove’s Premier Youth Soccer Academy.
          </p>
          
          <div className="pt-8 flex flex-col md:flex-row items-center justify-center gap-6">
            <Link 
              to="/register" 
              className="w-full md:w-auto inline-flex items-center justify-center gap-3 bg-[#EF4444] hover:bg-red-700 text-white px-10 py-4 rounded-full font-bold text-lg transition-all transform hover:scale-105 shadow-xl hover:shadow-red-900/40"
            >
              Register Player <ArrowRight size={24} />
            </Link>
            <Link 
              to="/login" 
              className="w-full md:w-auto inline-flex items-center justify-center gap-3 border-2 border-white/80 hover:bg-white hover:text-black text-white px-10 py-4 rounded-full font-bold text-lg transition-all"
            >
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* OUR PROGRAMS SECTION (Grid Layout) */}
      <section id="programs" className="py-24 bg-black">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white uppercase tracking-tight mb-4">
              Training for <span className="text-[#EF4444]">Every Level</span>
            </h2>
            <div className="h-1 w-24 bg-[#EF4444] mx-auto"></div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1: Junior Academy */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden hover:-translate-y-2 transition-transform duration-300 group">
              <div className="h-48 overflow-hidden">
                <img 
                  src="/Junior Academy.jpg" 
                  alt="Junior Academy" 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-2 text-gray-900">Junior Academy</h3>
                <p className="text-[#EF4444] font-bold mb-4">U6 - U10</p>
                <p className="text-gray-600 leading-relaxed">
                  Fun, fundamentals, and love for the game. We focus on basic skills, coordination, and building confidence in our youngest players.
                </p>
              </div>
            </div>

            {/* Card 2: Competitive */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden hover:-translate-y-2 transition-transform duration-300 group relative">
              <div className="absolute top-4 right-4 z-10 bg-[#EF4444] text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">POPULAR</div>
              <div className="h-48 overflow-hidden">
                <img 
                  src="/Competitive.jpg" 
                  alt="Competitive Team" 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-2 text-gray-900">Competitive</h3>
                <p className="text-[#EF4444] font-bold mb-4">U12 - U16</p>
                <p className="text-gray-600 leading-relaxed">
                  Tactical training, league play, and tournaments. Players develop game intelligence, teamwork, and competitive spirit in a structured environment.
                </p>
              </div>
            </div>

            {/* Card 3: Elite Performance */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden hover:-translate-y-2 transition-transform duration-300 group">
              <div className="h-48 overflow-hidden">
                <img 
                  src="/Elite Performance.jpg" 
                  alt="Elite Performance" 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-2 text-gray-900">Elite Performance</h3>
                <p className="text-[#EF4444] font-bold mb-4">Advanced</p>
                <p className="text-gray-600 leading-relaxed">
                  Advanced coaching for top-tier talent. Intensive training focused on high-performance conditioning, strategy, and preparing for collegiate or professional levels.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COACHING STAFF SECTION */}
      <section id="coaches" className="py-24 bg-neutral-900">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white uppercase tracking-tight mb-4">
              Meet Our <span className="text-[#EF4444]">Coaches</span>
            </h2>
            <div className="h-1 w-24 bg-[#EF4444] mx-auto"></div>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {/* Coach 1 */}
            <div className="bg-black border border-gray-800 rounded-2xl p-8 text-center hover:border-[#EF4444] transition-all group">
              <div className="relative w-32 h-32 mx-auto mb-6">
                <div className="absolute inset-0 bg-[#EF4444] rounded-full blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <img 
                  src="https://images.unsplash.com/photo-1519315901367-f34ff9154487?auto=format&fit=crop&q=80&w=400" 
                  alt="Ahmad Zai" 
                  className="relative w-full h-full object-cover rounded-full border-4 border-gray-800 group-hover:border-[#EF4444] transition-colors"
                />
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">Ahmad Zai</h3>
              <p className="text-[#EF4444] font-bold uppercase text-sm tracking-wider mb-4">Technical Director</p>
              <p className="text-gray-400 leading-relaxed">
                Former national team player with over 15 years of coaching experience. Specializes in youth development and tactical strategy.
              </p>
            </div>

            {/* Coach 2 */}
            <div className="bg-black border border-gray-800 rounded-2xl p-8 text-center hover:border-[#EF4444] transition-all group">
              <div className="relative w-32 h-32 mx-auto mb-6">
                <div className="absolute inset-0 bg-[#EF4444] rounded-full blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <img 
                  src="https://images.unsplash.com/photo-1519315901367-f34ff9154487?auto=format&fit=crop&q=80&w=400" 
                  alt="Sarah Karim" 
                  className="relative w-full h-full object-cover rounded-full border-4 border-gray-800 group-hover:border-[#EF4444] transition-colors"
                />
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">Sarah Karim</h3>
              <p className="text-[#EF4444] font-bold uppercase text-sm tracking-wider mb-4">Head Coach (U12-U16)</p>
              <p className="text-gray-400 leading-relaxed">
                Licensed UEFA B coach dedicated to building competitive spirit and technical excellence in our developing athletes.
              </p>
            </div>

            {/* Coach 3 */}
            <div className="bg-black border border-gray-800 rounded-2xl p-8 text-center hover:border-[#EF4444] transition-all group">
              <div className="relative w-32 h-32 mx-auto mb-6">
                <div className="absolute inset-0 bg-[#EF4444] rounded-full blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <img 
                  src="https://images.unsplash.com/photo-1519315901367-f34ff9154487?auto=format&fit=crop&q=80&w=400" 
                  alt="Omar Khan" 
                  className="relative w-full h-full object-cover rounded-full border-4 border-gray-800 group-hover:border-[#EF4444] transition-colors"
                />
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">Omar Khan</h3>
              <p className="text-[#EF4444] font-bold uppercase text-sm tracking-wider mb-4">Junior Academy Lead</p>
              <p className="text-gray-400 leading-relaxed">
                Expert in early childhood development. Focuses on making soccer fun while instilling strong fundamentals in our youngest stars.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* UPCOMING EVENTS SECTION */}
      <section id="events" className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold text-black uppercase tracking-tight mb-4">
              Upcoming <span className="text-[#EF4444]">Events</span>
            </h2>
            <div className="h-1 w-24 bg-[#EF4444] mx-auto"></div>
          </div>

          <div className="max-w-4xl mx-auto">
            {loadingEvents ? (
              <div className="text-center text-gray-500">Loading events...</div>
            ) : events.length > 0 ? (
              <div className="grid gap-6">
                {events.map((event) => (
                  <div key={event.id} className="bg-gray-50 border border-gray-100 rounded-xl p-6 hover:shadow-lg transition-shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-6 group">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-[#EF4444] transition-colors mb-2">{event.title}</h3>
                      <div className="flex flex-wrap gap-4 text-gray-600 text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-[#EF4444]" />
                          <span>{new Date(event.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-[#EF4444]" />
                          <span>{event.time.slice(0, 5)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-gray-500 bg-white px-4 py-2 rounded-lg border border-gray-200">
                      <MapPin className="h-5 w-5 text-[#EF4444]" />
                      <span className="font-medium">{event.location}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
                <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-xl font-medium text-gray-900 mb-2">No upcoming events</p>
                <p className="text-gray-500">Check back soon for our latest schedule.</p>
              </div>
            )}
            
            <div className="mt-10 text-center">
              <Link to="/login" className="inline-flex items-center gap-2 text-[#EF4444] font-bold hover:text-red-700 transition-colors">
                View Full Calendar <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="contact" className="bg-black text-white py-12 border-t border-gray-800">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            
            {/* Logo & Copyright */}
            <div className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                <img src="/logo.png" alt="Bamika FC" className="h-8 w-auto" />
                <span className="text-xl font-bold tracking-tighter uppercase">
                  Bamika <span className="text-[#EF4444]">FC</span>
                </span>
              </div>
              <p className="text-gray-500 text-sm">
                &copy; 2026 Bamika FC. All rights reserved.
              </p>
            </div>

            {/* Social Links */}
            <div className="flex gap-6">
              <a href="#" className="text-gray-400 hover:text-[#EF4444] transition-colors">
                <Facebook size={24} />
                <span className="sr-only">Facebook</span>
              </a>
              <a href="#" className="text-gray-400 hover:text-[#EF4444] transition-colors">
                <Instagram size={24} />
                <span className="sr-only">Instagram</span>
              </a>
            </div>

            {/* Quick Links */}
            <div className="flex gap-6 text-sm font-medium text-gray-400">
              <Link to="/login" className="hover:text-white transition-colors">Login</Link>
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
