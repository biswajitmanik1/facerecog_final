import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Home, Users, CheckCircle2, XCircle } from 'lucide-react'
import { apiFetch } from '../../lib/api.js'

export default function InstitutionReports() {
  const navigate = useNavigate()
  const [isAuthed, setIsAuthed] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  useEffect(() => {
    try {
      const loggedIn = localStorage.getItem('isLoggedIn') === 'true'
      const userType = localStorage.getItem('userType')
      if (!loggedIn || (userType !== 'admin' && userType !== 'teacher')) {
        setIsAuthed(false)
        navigate('/signin')
        return
      }
      setIsAuthed(true)
      fetchSummary()
    } catch {
      setIsAuthed(false)
      navigate('/signin')
    }
  }, [navigate])

  const fetchSummary = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/admin/attendance/summary')
      const data = await res.json()
      if (data.success) {
        setSummary(data.summary)
      } else {
        setStatus(`❌ ${data.error || 'Failed to load report'}`)
      }
    } catch {
      setStatus('❌ Error connecting to server')
    } finally {
      setLoading(false)
    }
  }

  const dashboardPath = () => {
    const userType = localStorage.getItem('userType')
    return userType === 'admin' ? '/admin/dashboard' : '/teacher/dashboard'
  }

  if (isAuthed === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-amber-500 mx-auto mb-4" />
          <p className="text-xl text-slate-700 font-medium">Checking access...</p>
        </div>
      </div>
    )
  }
  if (isAuthed === false) return null

  const rate = summary && summary.total_present + summary.total_absent > 0
    ? Math.round((summary.total_present / (summary.total_present + summary.total_absent)) * 100)
    : 0

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg">
              <PieChart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Institution Reports</h1>
              <p className="text-slate-600">Attendance totals across every department and session</p>
            </div>
          </div>
          <button onClick={() => navigate(dashboardPath())}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl transition-all shadow-lg">
            <Home className="w-5 h-5" />
            Dashboard
          </button>
        </div>

        {status && (
          <div className="mb-6 p-4 rounded-xl text-center border-2 bg-red-50 text-red-700 border-red-200">{status}</div>
        )}

        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4" />
            <p className="text-slate-600">Loading report...</p>
          </div>
        ) : summary ? (
          <>
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-2xl shadow-md text-center border-2 border-slate-200">
                <div className="text-3xl font-bold text-slate-800">{summary.total_sessions}</div>
                <div className="text-sm text-slate-600 mt-1">Total Sessions</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-md text-center border-2 border-emerald-200">
                <div className="text-3xl font-bold text-emerald-600">{summary.total_present}</div>
                <div className="text-sm text-slate-600 mt-1">Present (all-time)</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-md text-center border-2 border-red-200">
                <div className="text-3xl font-bold text-red-600">{summary.total_absent}</div>
                <div className="text-sm text-slate-600 mt-1">Absent (all-time)</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-md text-center border-2 border-amber-200">
                <div className="text-3xl font-bold text-amber-600">{rate}%</div>
                <div className="text-sm text-slate-600 mt-1">Attendance Rate</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md border-2 border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-600" />
                  By Department
                </h3>
              </div>
              {summary.by_department.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No attendance sessions recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Department</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sessions</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Present</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Absent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {summary.by_department.map(dept => (
                        <tr key={dept.department} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-sm font-medium text-slate-900">{dept.department}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{dept.sessions}</td>
                          <td className="px-6 py-4 text-sm text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> {dept.present}
                          </td>
                          <td className="px-6 py-4 text-sm text-red-600 flex items-center gap-1">
                            <XCircle className="w-4 h-4" /> {dept.absent}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </main>
  )
}
