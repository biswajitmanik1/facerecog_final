import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, RefreshCw, BookOpen, CheckCircle2, XCircle, TrendingUp, CalendarClock } from 'lucide-react'
import { apiFetch } from '../lib/api.js'
import AttendanceHeatmap from '../components/AttendanceHeatmap.jsx'

const TABS = ['Overview', 'Heatmap', 'Subject-wise', 'History', 'Monthly']

// SVG donut chart (balanced size)
function DonutChart({ percent }) {
  const r = 58
  const circ = 2 * Math.PI * r
  const dash = (percent / 100) * circ
  const color = percent >= 75 ? '#22c55e' : percent >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <svg width="170" height="170" viewBox="0 0 170 170">
      <circle cx="85" cy="85" r={r} fill="none" stroke="#e5e7eb" strokeWidth="14" />
      <circle
        cx="85" cy="85" r={r} fill="none"
        stroke={color} strokeWidth="14"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 85 85)"
      />
      <text x="85" y="81" textAnchor="middle" fontSize="30" fontWeight="800" fill={color}>{percent}%</text>
      <text x="85" y="104" textAnchor="middle" fontSize="13" fontWeight="600" fill="#6b7280">Attendance</text>
    </svg>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [isLoggedIn, setIsLoggedIn] = useState(null)
  const [username, setUsername] = useState('')
  const [activeTab, setActiveTab] = useState('Overview')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [totalClasses, setTotalClasses] = useState(0)
  const [attended, setAttended] = useState(0)
  const [missed, setMissed] = useState(0)
  const [overallPct, setOverallPct] = useState(0)
  const [todayStatus, setTodayStatus] = useState('No Class')
  const [subjectSummary, setSubjectSummary] = useState([])
  const [historyRecords, setHistoryRecords] = useState([])
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [monthlyData, setMonthlyData] = useState([])

  useEffect(() => {
    const checkStatus = () => {
      try {
        const loggedIn = localStorage.getItem('isLoggedIn')
        const userType = localStorage.getItem('userType')
        const name = localStorage.getItem('username')
        if (!loggedIn || loggedIn !== 'true' || userType !== 'student') {
          setIsLoggedIn(false)
          navigate('/signin')
        } else {
          setIsLoggedIn(true)
          setUsername(name || '')
        }
      } catch {
        setIsLoggedIn(false)
        navigate('/signin')
      }
    }
    const id = setTimeout(checkStatus, 100)
    return () => clearTimeout(id)
  }, [navigate])

  useEffect(() => {
    if (isLoggedIn) fetchStats()
  }, [isLoggedIn])

  const fetchStats = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const studentId = localStorage.getItem('username') || ''
      const params = new URLSearchParams()
      if (studentId) params.set('student_id', studentId)
      const res = await apiFetch(`/api/attendance?${params.toString()}`)
      const data = await res.json()
      if (data && data.success) {
        const records = data.attendance || []
        setAttendanceRecords(records)
        const subjectMap = {}
        records.forEach(r => {
          const subj = r.subject || r.course || 'General'
          if (!subjectMap[subj]) subjectMap[subj] = { present: 0, total: 0 }
          subjectMap[subj].total++
          if ((r.status || 'present') === 'present') subjectMap[subj].present++
        })
        const subjects = Object.entries(subjectMap).map(([name, v]) => ({
          name,
          present: v.present,
          total: v.total,
          pct: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
        }))
        setSubjectSummary(subjects)

        const totalC = records.length
        const presentC = records.filter(r => (r.status || 'present') === 'present').length
        const missedC = totalC - presentC
        const pct = totalC > 0 ? Math.round((presentC / totalC) * 100) : 0
        setTotalClasses(totalC)
        setAttended(presentC)
        setMissed(missedC)
        setOverallPct(pct)

        const today = new Date().toISOString().split('T')[0]
        const todayRecords = records.filter(r => (r.date || '').startsWith(today))
        if (todayRecords.length === 0) setTodayStatus('No Class')
        else if (todayRecords.some(r => (r.status || 'present') === 'present')) setTodayStatus('Present')
        else setTodayStatus('Absent')

        setHistoryRecords(records.slice(-20).reverse())

        const monthMap = {}
        records.forEach(r => {
          const month = (r.date || '').slice(0, 7)
          if (!month) return
          if (!monthMap[month]) monthMap[month] = { present: 0, total: 0 }
          monthMap[month].total++
          if ((r.status || 'present') === 'present') monthMap[month].present++
        })
        setMonthlyData(
          Object.entries(monthMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, v]) => ({
              month,
              pct: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
              present: v.present,
              total: v.total,
            }))
        )
      }
    } catch (err) {
      console.error('Failed to fetch attendance stats', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleLogout = async () => {
    try { await apiFetch('/api/logout', { method: 'POST' }) } catch {}
    localStorage.clear()
    navigate('/')
  }

  if (isLoggedIn === null) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#eef2fb' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-b-4 border-blue-600 mx-auto mb-4" />
          <p className="text-xl text-gray-700 font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }
  if (isLoggedIn === false) return null

  const safeAbove = overallPct >= 75
  const todayColor =
    todayStatus === 'Present' ? 'text-green-600' :
    todayStatus === 'Absent' ? 'text-red-500' :
    'text-purple-600'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#eef2fb' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-blue-600 rounded-xl shadow-sm">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Student Dashboard</h1>
              <p className="text-base text-gray-500">
                Welcome back, <span className="text-blue-600 font-semibold">{username}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchStats(true)}
              className="p-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-200 bg-red-50/50 hover:bg-red-100 rounded-xl transition-colors text-base font-semibold"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Stat Cards (Nicely balanced size) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Card 1: Total Classes */}
          <div className="card-hover bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[135px]">
            <div className="p-2.5 bg-blue-50 rounded-xl w-fit mb-3">
              <BookOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-blue-600 tracking-tight">
                {loading ? '—' : totalClasses}
              </div>
              <div className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wide mt-1">
                Total Classes
              </div>
            </div>
          </div>

          {/* Card 2: Classes Attended */}
          <div className="card-hover bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[135px]">
            <div className="p-2.5 bg-green-50 rounded-xl w-fit mb-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-green-600 tracking-tight">
                {loading ? '—' : attended}
              </div>
              <div className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wide mt-1">
                Classes Attended
              </div>
            </div>
          </div>

          {/* Card 3: Classes Missed */}
          <div className="card-hover bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[135px]">
            <div className="p-2.5 bg-red-50 rounded-xl w-fit mb-3">
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-red-500 tracking-tight">
                {loading ? '—' : missed}
              </div>
              <div className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wide mt-1">
                Classes Missed
              </div>
            </div>
          </div>

          {/* Card 4: Overall % */}
          <div className="card-hover bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[135px]">
            <div className="p-2.5 bg-green-50 rounded-xl w-fit mb-3">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-green-600 tracking-tight">
                {loading ? '—' : `${overallPct}%`}
              </div>
              <div className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wide mt-1">
                Overall %
              </div>
            </div>
          </div>

          {/* Card 5: Today's Status */}
          <div className="card-hover bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[135px] col-span-2 sm:col-span-1">
            <div className="p-2.5 bg-purple-50 rounded-xl w-fit mb-3">
              <CalendarClock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className={`text-xl sm:text-2xl font-extrabold ${todayColor} tracking-tight`}>
                {todayStatus === 'No Class' ? (
                  <span className="flex items-center gap-1.5 text-lg sm:text-xl">
                    <span>📅</span> No Class
                  </span>
                ) : todayStatus}
              </div>
              <div className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wide mt-1">
                Today's Status
              </div>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center gap-1.5 p-1.5">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-base font-semibold transition-all ${
                activeTab === tab
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab === 'Overview' && <span className="text-base">📊</span>}
              {tab === 'Heatmap' && <span className="text-base">🟩</span>}
              {tab === 'Subject-wise' && <span className="text-base">📖</span>}
              {tab === 'History' && <span className="text-base">📅</span>}
              {tab === 'Monthly' && <span className="text-base">📈</span>}
              {tab}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'Overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Box: Overall Attendance */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Overall Attendance</h3>
                <div className="flex justify-center my-3">
                  <DonutChart percent={overallPct} />
                </div>
                <div className="flex justify-center my-3">
                  <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-bold shadow-sm ${safeAbove ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-600'}`}>
                    {safeAbove ? '✅' : '⚠️'} {safeAbove ? 'Safe — Above minimum' : 'Warning — Below minimum'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-green-50/70 border border-green-100 rounded-xl p-4 text-center">
                    <div className="text-2xl sm:text-3xl font-extrabold text-green-600">{attended}</div>
                    <div className="text-xs sm:text-sm font-semibold text-gray-600 mt-0.5">Present Classes</div>
                  </div>
                  <div className="bg-red-50/70 border border-red-100 rounded-xl p-4 text-center">
                    <div className="text-2xl sm:text-3xl font-extrabold text-red-500">{missed}</div>
                    <div className="text-xs sm:text-sm font-semibold text-gray-600 mt-0.5">Absent Classes</div>
                  </div>
                </div>
              </div>

              {/* Right Box: Subject Attendance Summary */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
                <h3 className="text-lg font-bold text-blue-600 mb-4">Subject Attendance Summary</h3>
                {subjectSummary.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 py-12">
                    <div className="text-3xl mb-2">📚</div>
                    <p className="text-base font-medium">No subject data available</p>
                  </div>
                ) : (
                  <div className="space-y-4 flex-1">
                    {subjectSummary.map(subj => (
                      <div key={subj.name} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-base font-bold text-gray-800">{subj.name}</span>
                          <div className="flex items-center gap-2.5">
                            <span className="text-base font-extrabold text-gray-800">{subj.pct}%</span>
                            <span className="text-xs font-semibold text-gray-400">{subj.present}/{subj.total}</span>
                          </div>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${subj.pct}%`,
                              background: subj.pct >= 75 ? '#22c55e' : subj.pct >= 50 ? '#f59e0b' : '#ef4444'
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Semester Activity Heatmap (GitHub-Style) */}
            <AttendanceHeatmap records={attendanceRecords} totalClasses={totalClasses} />
          </div>
        )}

        {/* Heatmap Tab */}
        {activeTab === 'Heatmap' && (
          <div className="space-y-6">
            <AttendanceHeatmap records={attendanceRecords} totalClasses={totalClasses} />
          </div>
        )}

        {/* Subject-wise Tab */}
        {activeTab === 'Subject-wise' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-5">Subject-wise Attendance</h3>
            {subjectSummary.length === 0 ? (
              <div className="text-center text-gray-400 py-12 text-base font-medium">No subject data available</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {subjectSummary.map(subj => (
                  <div key={subj.name} className="card-hover border border-gray-200 rounded-2xl p-5 bg-white shadow-sm">
                    <div className="text-base font-bold text-gray-800 mb-1.5">{subj.name}</div>
                    <div className={`text-2xl sm:text-3xl font-extrabold mb-1 ${subj.pct >= 75 ? 'text-green-600' : subj.pct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                      {subj.pct}%
                    </div>
                    <div className="text-xs font-semibold text-gray-500">{subj.present} present / {subj.total} total</div>
                    <div className="mt-3 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${subj.pct}%`, background: subj.pct >= 75 ? '#22c55e' : subj.pct >= 50 ? '#f59e0b' : '#ef4444' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'History' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-800">Attendance History Logs</h3>
            </div>
            {historyRecords.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-base font-medium">No history records found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50/80 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      {['Date', 'Subject', 'Time', 'Status'].map(h => (
                        <th key={h} className="px-6 py-3.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-base">
                    {historyRecords.map((r, i) => (
                      <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                        <td className="px-6 py-3.5 font-semibold text-gray-800">{new Date(r.date || r.markedAt || '').toLocaleDateString()}</td>
                        <td className="px-6 py-3.5 text-gray-700 font-medium">{r.subject || r.course || '—'}</td>
                        <td className="px-6 py-3.5 text-gray-500 font-mono text-sm">{r.markedAt || r.time || '—'}</td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full ${(r.status || 'present') === 'present' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                            {r.status || 'present'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Monthly Tab */}
        {activeTab === 'Monthly' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-5">Monthly Attendance Trends</h3>
            {monthlyData.length === 0 ? (
              <div className="text-center text-gray-400 py-12 text-base font-medium">No monthly data available</div>
            ) : (
              <div className="space-y-5">
                {monthlyData.map(m => (
                  <div key={m.month} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-gray-800">
                        {new Date(m.month + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}
                      </span>
                      <div className="flex items-center gap-2.5">
                        <span className={`text-base font-extrabold ${m.pct >= 75 ? 'text-green-600' : m.pct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{m.pct}%</span>
                        <span className="text-xs font-semibold text-gray-400">{m.present}/{m.total}</span>
                      </div>
                    </div>
                    <div className="h-3.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${m.pct}%`, background: m.pct >= 75 ? '#22c55e' : m.pct >= 50 ? '#f59e0b' : '#ef4444' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
