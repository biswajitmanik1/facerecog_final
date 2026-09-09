import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Camera } from 'lucide-react'

const features = [
  'Face Recognition',
  'Smart Attendance',
  'Real-time Analytics',
  'Secure Login',
  'Multi-role Access',
  'Excel Reports',
]

export default function HeroSection() {
  const [currentFeature, setCurrentFeature] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
    const interval = setInterval(() => {
      setCurrentFeature(prev => (prev + 1) % features.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gray-900">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 z-0 opacity-50 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/campus-hero.png')" }}
      />
      <div className="absolute inset-0 z-0 bg-slate-900/70" />

      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full filter blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full filter blur-3xl animate-float animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-cyan-500/10 rounded-full filter blur-3xl animate-float animation-delay-4000" />
      </div>

      <div className={`relative z-10 text-center px-4 max-w-4xl mx-auto transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-2xl animate-bounce-gentle">
            <Camera className="w-12 h-12 text-white" />
          </div>
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white mb-4 tracking-tight">
          Smart{' '}
          <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Attendance
          </span>
        </h1>

        <div className="h-12 flex items-center justify-center mb-6">
          <div className="px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-300 font-semibold text-lg transition-all duration-500">
            {features[currentFeature]}
          </div>
        </div>

        <p className="text-gray-400 text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          Face-recognition powered attendance management for the modern college. Fast, accurate, and effortless.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/signin"
            className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300 hover:scale-105 shadow-xl hover:shadow-blue-500/25">
            Get Started
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link to="/signup"
            className="flex items-center gap-2 px-8 py-4 border-2 border-gray-600 text-gray-300 font-bold rounded-xl hover:border-gray-400 hover:text-white transition-all duration-300 hover:scale-105">
            Create Account
          </Link>
        </div>
      </div>
    </section>
  )
}
