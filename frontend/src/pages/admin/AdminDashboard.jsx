import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserCog, PieChart, Users, Edit3, BarChart3, LogOut, ShieldCheck, ArrowRight, AlertTriangle } from 'lucide-react'
import { apiFetch } from '../../lib/api.js'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [isLoggedIn, setIsLoggedIn] = useState(null)
  const [adminName, setAdminName] = useState('')

  useEffect(() => {
    const checkStatus = () => {
      try {
        const loggedIn = localStorage.getItem('isLoggedIn')
        const userType = localStorage.getItem('userType')
        const name = localStorage.getItem('username')
        if (!loggedIn || loggedIn !== 'true' || userType !== 'admin') {
          setIsLoggedIn(false)
          navigate('/signin')
        } else {
          setIsLoggedIn(true)
          setAdminName(name || '')
        }
      } catch {
        setIsLoggedIn(false)
        navigate('/signin')
      }
    }
    const id = setTimeout(checkStatus, 100)
    return () => clearTimeout(id)
  }, [navigate])

  const handleLogout = async () => {
    try { await apiFetch('/api/logout', { method: 'POST' }) } catch {}
    localStorage.clear()
    navigate('/')
  }

  const adminMenuItems = [
    {
      title: 'Manage Teachers',
      description: 'Create, update, deactivate, or remove teacher accounts',
      icon: <UserCog className="w-7 h-7 text-white" />,
      path: '/admin/teachers',
      iconBg: 'bg-purple-500',
    },
    {
      title: 'Institution Reports',
      description: 'Attendance totals across every department and session',
      icon: <PieChart className="w-7 h-7 text-white" />,
      path: '/admin/reports',
      iconBg: 'bg-amber-500',
    },
    {
      title: 'Student Registration',
      description: 'Register new students with face recognition setup',
      icon: <Users className="w-7 h-7 text-white" />,
      path: '/student/registrationform',
      iconBg: 'bg-blue-500',
    },
    {
      title: 'Manage Student Details',
      description: 'View and update any student\'s information',
      icon: <Edit3 className="w-7 h-7 text-white" />,
      path: '/student/updatedetails',
      iconBg: 'bg-emerald-500',
    },
    {
      title: 'Attendance Records',
      description: 'View attendance statistics and export reports',
      icon: <BarChart3 className="w-7 h-7 text-white" />,
      path: '/student/view-attendance',
      iconBg: 'bg-sky-500',
    },
    {
      title: 'Defaulter List (< 75%)',
      description: 'Audit attendance shortages, recovery targets, and export notice board PDFs',
      icon: <AlertTriangle className="w-7 h-7 text-white" />,
      path: '/attendance/defaulters',
      iconBg: 'bg-rose-500',
    },
  ]

  if (isLoggedIn === null) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'linear-gradient(135deg, #9ca3af 0%, #4b5563 100%)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4" />
          <p className="text-xl text-white font-medium">Loading...</p>
        </div>
      </div>
    )
  }
  if (isLoggedIn === false) return null

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #9ca3af 0%, #4b5563 100%)' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-xl">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Admin Workspace</h1>
              <p className="text-sm text-gray-500">
                Welcome back, <span className="text-purple-600 font-semibold">{adminName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-red-500 border border-red-300 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="px-6 py-10 max-w-6xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-1">Platform Administration</h2>
          <p className="text-gray-200 text-sm">Select a module below to manage the system</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminMenuItems.map((item, idx) => (
            <div
              key={idx}
              onClick={() => navigate(item.path)}
              className="card-hover bg-white rounded-2xl p-6 cursor-pointer relative overflow-hidden"
            >
              {/* Decorative circle */}
              <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full opacity-10 bg-gray-400" />

              <div className={`card-icon p-3 rounded-xl ${item.iconBg} w-fit mb-4`}>
                {item.icon}
              </div>

              <h3 className="text-lg font-bold text-gray-800 mb-2">{item.title}</h3>
              <p className="text-gray-500 text-sm mb-5 leading-relaxed">{item.description}</p>

              <div className="flex items-center gap-1 text-purple-600 text-sm font-semibold">
                Access Module
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

