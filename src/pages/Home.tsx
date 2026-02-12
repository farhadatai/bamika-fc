import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="bg-zinc-950 text-white py-20 lg:py-32 relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10 text-center">
          <img src="/logo.png" alt="Bamika FC Logo" className="h-32 w-auto mx-auto mb-8 drop-shadow-2xl hover:scale-105 transition-transform bg-transparent" />
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-6">
            Welcome to <span className="text-primary">Bamika FC</span>
          </h1>
          <p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto">
            Developing the next generation of football talent. Join our academy today and start your journey to greatness.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="bg-primary hover:bg-red-700 text-white font-bold py-3 px-8 rounded-md transition-all transform hover:scale-105 inline-flex items-center justify-center gap-2"
            >
              Register Now <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/login"
              className="bg-transparent border-2 border-white hover:bg-white hover:text-black text-white font-bold py-3 px-8 rounded-md transition-all"
            >
              Parent Login
            </Link>
          </div>
        </div>
        
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#CE1126_1px,transparent_1px)] [background-size:16px_16px]"></div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 uppercase tracking-tight">Why Choose Us?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: 'Professional Coaching', desc: 'UEFA licensed coaches dedicated to player development.' },
              { title: 'Elite Facilities', desc: 'Train on top-quality pitches with modern equipment.' },
              { title: 'Pathway to Pro', desc: 'Structured development plans from U6 to U18.' },
            ].map((feature, i) => (
              <div key={i} className="bg-white p-10 rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-200 hover:-translate-y-1 transition-all duration-300">
                <CheckCircle className="h-6 w-6 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-zinc-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
