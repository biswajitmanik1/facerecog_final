import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, User, Lock, Shield, GraduationCap, BookOpen } from 'lucide-react'
import { apiFetch } from '../lib/api.js'

const ROLES = ['student', 'teacher', 'admin']

export default function SignInPage() {
  const navigate = useNavigate()
  const [role, setRole] = useState('student')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const roleIcon = {
    student: <GraduationCap className="w-5 h-5" />,
    teacher: <BookOpen className="w-5 h-5" />,
    admin: <Shield className="w-5 h-5" />,
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatus('')
    try {
      const res = await apiFetch('/api/signin', {
        method: 'POST',
        body: JSON.stringify({
          email: username.trim(),
          username: username.trim(),
          employeeId: username.trim(),
          password,
          userType: role,
          role
        }),
      })
      const data = await res.json()
      if (data.success) {
        const user = data.user || {}
        // Clear all previous session keys to prevent cross-account contamination
        localStorage.clear()
        localStorage.setItem('isLoggedIn', 'true')
        localStorage.setItem('username', user.username || user.email || username)
        localStorage.setItem('userType', data.userType || user.userType || role)
        localStorage.setItem('authToken', data.token || '')
        localStorage.setItem('userId', user._id || '')
        localStorage.setItem('userEmail', user.email || username)
        localStorage.setItem('hasStudentRecord', user.hasStudentRecord ? 'true' : 'false')
        if (user.studentId) localStorage.setItem('studentId', user.studentId)
        if (user.employeeId) localStorage.setItem('employeeId', user.employeeId)
        if (user.department) localStorage.setItem('department', user.department)

        const resolvedType = data.userType || user.userType || role
        if (resolvedType === 'admin') navigate('/admin/dashboard')
        else if (resolvedType === 'teacher') navigate('/teacher/dashboard')
        else navigate('/dashboard')
      } else {
        setStatus(data.error || 'Sign in failed')
      }
    } catch {
      setStatus('Error connecting to server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4 relative overflow-hidden">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 z-0 opacity-50 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/campus-hero.png')" }}
      />
      <div className="absolute inset-0 z-0 bg-slate-900/70" />

      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-40 -right-32 w-96 h-96 bg-blue-500/10 rounded-full filter blur-3xl animate-float" />
        <div className="absolute -bottom-40 -left-32 w-96 h-96 bg-purple-500/10 rounded-full filter blur-3xl animate-float animation-delay-2000" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-2xl mb-4">
            <Camera className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white">Sign In</h1>
          <p className="text-gray-400 mt-1">Smart College Attendance</p>
        </div>

        <div className="bg-gray-800/60 backdrop-blur-xl border border-gray-700 rounded-3xl p-8 shadow-2xl">
          {/* Role selector */}
          <div className="flex gap-2 mb-6 bg-gray-900/50 p-1 rounded-2xl">
            {ROLES.map(r => (
              <button key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all capitalize ${
                  role === r
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-gray-200'
                }`}>
                {roleIcon[r]}
                {r}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder={
                  role === 'teacher'
                    ? 'Email, Username or Employee ID'
                    : role === 'student'
                    ? 'Email or Username'
                    : 'Admin Email or Username'
                }
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                className="w-full bg-gray-900/50 border border-gray-600 hover:border-blue-400 hover:bg-gray-800 hover:shadow-lg hover:shadow-blue-500/20 text-white placeholder-gray-500 rounded-2xl pl-11 pr-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-gray-900/50 border border-gray-600 hover:border-blue-400 hover:bg-gray-800 hover:shadow-lg hover:shadow-blue-500/20 text-white placeholder-gray-500 rounded-2xl pl-11 pr-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {status && (
              <div className="p-3 bg-red-900/30 border border-red-700 text-red-300 rounded-2xl text-sm text-center">
                {status}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold rounded-2xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            Don't have an account?{' '}
            <button onClick={() => navigate('/signup')} className="text-blue-400 hover:text-blue-300 font-semibold">
              Sign Up
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
