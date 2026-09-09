import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Edit3, Camera, BarChart3, LogOut, ArrowRight, GraduationCap, AlertTriangle } from 'lucide-react'
import { apiFetch } from '../../lib/api.js'

export default function TeacherDashboard() {
  const navigate = useNavigate()
  const [isLoggedIn, setIsLoggedIn] = useState(null)
  const [teacherName, setTeacherName] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkStatus = () => {
      try {
        const loggedIn = localStorage.getItem('isLoggedIn')
        const userType = localStorage.getItem('userType')
        const name = localStorage.getItem('username')
        const empId = localStorage.getItem('employeeId')
        if (!loggedIn || loggedIn !== 'true' || userType !== 'teacher') {
          setIsLoggedIn(false)
          navigate('/signin')
        } else {
          setIsLoggedIn(true)
          setTeacherName(name || '')
          setEmployeeId(empId || '')
          setLoading(false)
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

  const teacherMenuItems = [
    {
      title: 'Student Registration',
      description: 'Register new students with complete details and face recognition setup',
      icon: <Users className="w-8 h-8 text-white" />,
      path: '/student/registrationform',
      iconBg: 'bg-blue-500',
      actionColor: 'text-blue-600',
    },
    {
      title: 'Manage Student Details',
      description: 'Modify existing student information, department, division, and settings',
      icon: <Edit3 className="w-8 h-8 text-white" />,
      path: '/student/updatedetails',
      iconBg: 'bg-emerald-500',
      actionColor: 'text-emerald-600',
    },
    {
      title: 'Start Teaching Session',
      description: 'Begin a live attendance session with automated face recognition detection',
      icon: <Camera className="w-8 h-8 text-white" />,
      path: '/teacher/start-session',
      iconBg: 'bg-purple-500',
      actionColor: 'text-purple-600',
    },
    {
      title: 'Attendance Records',
      description: 'View comprehensive attendance statistics, history logs, and exports',
      icon: <BarChart3 className="w-8 h-8 text-white" />,
      path: '/student/view-attendance',
      iconBg: 'bg-sky-500',
      actionColor: 'text-sky-600',
    },
    {
      title: 'Defaulter List (< 75%)',
      description: '1-Click low-attendance detector & official printable notice board PDF generator',
      icon: <AlertTriangle className="w-8 h-8 text-white" />,
      path: '/attendance/defaulters',
      iconBg: 'bg-rose-500',
      actionColor: 'text-rose-600',
      badge: '< 75% Alert',
    },
  ]

  if (isLoggedIn === null || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#eef2fb' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-b-4 border-blue-600 mx-auto mb-4" />
          <p className="text-xl text-gray-700 font-medium">Loading workspace...</p>
        </div>
      </div>
    )
  }
  if (isLoggedIn === false) return null

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#eef2fb' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-blue-600 rounded-xl shadow-sm">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Teacher Workspace</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-base text-gray-600">
                  Welcome back, <span className="text-blue-600 font-semibold">{teacherName}</span>
                </p>
                {employeeId && (
                  <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                    ID: {employeeId}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 text-red-600 border border-red-200 bg-red-50/50 hover:bg-red-100 rounded-xl transition-colors text-base font-medium"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Teacher Management Hub</h2>
          <p className="text-base sm:text-lg text-gray-600">
            Select a module below to register students, conduct live sessions, or review attendance records.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {teacherMenuItems.map((item, idx) => (
            <div
              key={idx}
              onClick={() => navigate(item.path)}
              className="card-hover bg-white rounded-2xl p-6 cursor-pointer relative overflow-hidden shadow-sm border border-gray-100 flex flex-col justify-between"
            >
              {/* Decorative background circle */}
              <div className="absolute -bottom-8 -right-8 w-28 h-28 rounded-full opacity-10 bg-gray-400 pointer-events-none" />

              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className={`card-icon p-3.5 rounded-xl ${item.iconBg} w-fit shadow-sm`}>
                    {item.icon}
                  </div>
                  {item.badge && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                      {item.badge}
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-bold text-gray-800 mb-2.5">{item.title}</h3>
                <p className="text-base text-gray-500 mb-6 leading-relaxed">{item.description}</p>
              </div>

              <div className={`flex items-center gap-1.5 ${item.actionColor} text-base font-semibold mt-auto`}>
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
