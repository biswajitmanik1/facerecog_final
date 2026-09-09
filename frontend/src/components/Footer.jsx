import { Camera } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-gray-950 border-t border-gray-800 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-lg">Smart College</span>
          </div>

          <div className="flex items-center gap-6 text-gray-500 text-sm">
            <Link to="/signin" className="hover:text-gray-300 transition-colors">Sign In</Link>
            <Link to="/signup" className="hover:text-gray-300 transition-colors">Sign Up</Link>
            <a href="#about" className="hover:text-gray-300 transition-colors">About</a>
          </div>

          <p className="text-gray-600 text-sm">
            &copy; {new Date().getFullYear()} Smart College. AI-Powered Attendance.
          </p>
        </div>
      </div>
    </footer>
  )
}
