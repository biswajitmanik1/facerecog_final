import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, LogOut, Menu, X, BookOpen, GraduationCap, BarChart2, UserCheck } from 'lucide-react'
import { apiFetch } from '../lib/api.js'

export default function Navbar() {
  const navigate = useNavigate()
  const [userType, setUserType] = useState(null)
  const [username, setUsername] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    try {
      const loggedIn = localStorage.getItem('isLoggedIn')
      const utype = localStorage.getItem('userType')
      const name = localStorage.getItem('username')
      if (loggedIn === 'true') {
        setUserType(utype)
        setUsername(name || '')
      }
    } catch {
      // ignore
    }
  }, [])

  const handleLogout = async () => {
    try {
      await apiFetch('/api/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    localStorage.clear()
    navigate('/')
  }

  const getDashboardPath = () => {
    if (userType === 'admin') return '/admin/dashboard'
    if (userType === 'teacher') return '/teacher/dashboard'
    return '/dashboard'
  }

  const navLinks = userType === 'student' ? [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'View Attendance', path: '/student/view-attendance' },
    { label: 'Update Details', path: '/student/updatedetails' },
    { label: 'Demo', path: '/student/demo-session' },
  ] : userType === 'teacher' ? [
    { label: 'Dashboard', path: '/teacher/dashboard' },
    { label: 'Start Session', path: '/teacher/start-session' },
    { label: 'Register Student', path: '/student/registrationform' },
    { label: 'Attendance Records', path: '/student/view-attendance' },
  ] : userType === 'admin' ? [
    { label: 'Dashboard', path: '/admin/dashboard' },
    { label: 'Teachers', path: '/admin/teachers' },
    { label: 'Reports', path: '/admin/reports' },
  ] : []

  return (
    <nav className="bg-gray-900/95 backdrop-blur-lg border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <button onClick={() => navigate(userType ? getDashboardPath() : '/')} className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-white text-lg">Smart College</span>
        </button>

        {/* Desktop Nav */}
        {userType && (
          <div className="hidden lg:flex items-center gap-6">
            {navLinks.map(link => (
              <button key={link.path} onClick={() => navigate(link.path)}
                className="text-gray-300 hover:text-white transition-colors text-sm font-medium">
                {link.label}
              </button>
            ))}
            <span className="text-gray-500 text-sm">{username}</span>
            <button onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 bg-red-900/50 hover:bg-red-900 text-red-300 hover:text-red-200 rounded-lg transition-colors border border-red-800">
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        )}

        {!userType && (
          <div className="hidden lg:flex items-center gap-4">
            <button onClick={() => navigate('/signin')}
              className="text-gray-300 hover:text-white transition-colors text-sm font-medium">Sign In</button>
            <button onClick={() => navigate('/signup')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors">
              Sign Up
            </button>
          </div>
        )}

        {/* Mobile Toggle */}
        <button className="lg:hidden p-2 text-gray-400 hover:text-white" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-gray-900 border-t border-gray-800 px-4 py-4 space-y-2">
          {userType
            ? navLinks.map(link => (
                <button key={link.path} onClick={() => { navigate(link.path); setMobileOpen(false) }}
                  className="block w-full text-left px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors text-sm">
                  {link.label}
                </button>
              ))
            : (
              <>
                <button onClick={() => { navigate('/signin'); setMobileOpen(false) }}
                  className="block w-full text-left px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg text-sm">Sign In</button>
                <button onClick={() => { navigate('/signup'); setMobileOpen(false) }}
                  className="block w-full text-left px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">Sign Up</button>
              </>
            )
          }
          {userType && (
            <button onClick={handleLogout}
              className="block w-full text-left px-3 py-2 text-red-400 hover:bg-gray-800 rounded-lg text-sm">
              Logout
            </button>
          )}
        </div>
      )}
    </nav>
  )
}
