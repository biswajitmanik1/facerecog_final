import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, User, Lock, Mail, Building, IdCard } from 'lucide-react'
import { apiFetch } from '../lib/api.js'

export default function SignUpPage() {
  const navigate = useNavigate()
  const [role, setRole] = useState('student')
  const [form, setForm] = useState({
    username: '', email: '', password: '', employeeId: '', department: ''
  })
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Purge any stale login session when creating a new account
    localStorage.clear()
  }, [])

  const departments = [
    'Computer Science', 'Information Technology', 'Electronics',
    'Mechanical', 'Civil', 'Electrical', 'Chemical', 'Biotechnology'
  ]

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatus('')
    try {
      const res = await apiFetch('/api/signup', {
        method: 'POST',
        body: JSON.stringify({ ...form, role, userType: role }),
      })
      const data = await res.json()
      if (data.success) {
        localStorage.clear()
        setStatus('✅ Account created! Redirecting to sign in…')
        setTimeout(() => navigate('/signin'), 1500)
      } else {
        setStatus(data.error || 'Sign up failed')
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
        <div className="absolute -top-40 -right-32 w-96 h-96 bg-purple-500/10 rounded-full filter blur-3xl animate-float" />
        <div className="absolute -bottom-40 -left-32 w-96 h-96 bg-blue-500/10 rounded-full filter blur-3xl animate-float animation-delay-2000" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex p-4 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl shadow-2xl mb-4">
            <Camera className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white">Create Account</h1>
          <p className="text-gray-400 mt-1">Join Smart College Attendance</p>
        </div>

        <div className="bg-gray-800/60 backdrop-blur-xl border border-gray-700 rounded-3xl p-8 shadow-2xl">
          {/* Role selector */}
          <div className="flex gap-2 mb-6 bg-gray-900/50 p-1 rounded-2xl">
            {['student', 'teacher'].map(r => (
              <button key={r} type="button" onClick={() => setRole(r)}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold capitalize transition-all ${
                  role === r
                    ? 'bg-gradient-to-r from-purple-500 to-blue-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-gray-200'
                }`}>
                {r}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input name="username" placeholder="Username" required value={form.username} onChange={handleChange}
                className="w-full bg-gray-900/50 border border-gray-600 hover:border-purple-400 hover:bg-gray-800 hover:shadow-lg hover:shadow-purple-500/20 text-white placeholder-gray-500 rounded-2xl pl-11 pr-4 py-3 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all" />
            </div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input name="email" type="email" placeholder="Email" required value={form.email} onChange={handleChange}
                className="w-full bg-gray-900/50 border border-gray-600 hover:border-purple-400 hover:bg-gray-800 hover:shadow-lg hover:shadow-purple-500/20 text-white placeholder-gray-500 rounded-2xl pl-11 pr-4 py-3 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all" />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input name="password" type="password" placeholder="Password" required value={form.password} onChange={handleChange}
                className="w-full bg-gray-900/50 border border-gray-600 hover:border-purple-400 hover:bg-gray-800 hover:shadow-lg hover:shadow-purple-500/20 text-white placeholder-gray-500 rounded-2xl pl-11 pr-4 py-3 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all" />
            </div>

            {role === 'teacher' && (
              <>
                <div className="relative">
                  <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input name="employeeId" placeholder="Employee ID" required value={form.employeeId} onChange={handleChange}
                    className="w-full bg-gray-900/50 border border-gray-600 hover:border-purple-400 hover:bg-gray-800 hover:shadow-lg hover:shadow-purple-500/20 text-white placeholder-gray-500 rounded-2xl pl-11 pr-4 py-3 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all" />
                </div>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select name="department" value={form.department} onChange={handleChange}
                    className="w-full bg-gray-900/50 border border-gray-600 hover:border-purple-400 hover:bg-gray-800 hover:shadow-lg hover:shadow-purple-500/20 text-white rounded-2xl pl-11 pr-4 py-3 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all">
                    <option value="">Select Department</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </>
            )}

            {status && (
              <div className={`p-3 rounded-2xl text-sm text-center border ${
                status.includes('✅')
                  ? 'bg-emerald-900/30 border-emerald-700 text-emerald-300'
                  : 'bg-red-900/30 border-red-700 text-red-300'
              }`}>
                {status}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white font-bold rounded-2xl transition-all duration-300 hover:scale-105 disabled:opacity-50 shadow-lg">
              {loading ? 'Creating account…' : 'Sign Up'}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            Already have an account?{' '}
            <button onClick={() => navigate('/signin')} className="text-purple-400 hover:text-purple-300 font-semibold">
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
