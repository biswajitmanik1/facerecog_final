import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LogOut,
  RefreshCw,
  BookOpen,
  CheckCircle2,
  XCircle,
  TrendingUp,
  CalendarClock,
  Camera,
  UserPlus,
  X,
  Search,
  Filter,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Grid3x3,
  Clock,
  AlertTriangle,
  ShieldCheck,
  ChevronRight,
  Calendar,
} from 'lucide-react'
import { apiFetch } from '../lib/api.js'
import AttendanceHeatmap from '../components/AttendanceHeatmap.jsx'

const TABS = [
  { id: 'Overview', label: 'Overview', icon: BarChart3 },
  { id: 'Heatmap', label: 'Heatmap', icon: Grid3x3 },
  { id: 'Subject-wise', label: 'Subject-wise', icon: BookOpen },
  { id: 'History', label: 'History', icon: Clock },
  { id: 'Monthly', label: 'Monthly', icon: TrendingUp },
]

// SVG donut chart (modern SaaS style)
function DonutChart({ percent, total = 0 }) {
  const r = 62
  const circ = 2 * Math.PI * r
  const dash = total > 0 ? (Math.min(100, Math.max(0, percent)) / 100) * circ : 0
  const color =
    total === 0 ? '#94a3b8' : percent >= 75 ? '#16a34a' : percent >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="170" height="170" viewBox="0 0 170 170" className="transform -rotate-90">
        {/* Background track */}
        <circle cx="85" cy="85" r={r} fill="none" stroke="#f1f5f9" strokeWidth="14" />
        {/* Progress track */}
        {total > 0 && (
          <circle
            cx="85"
            cy="85"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        )}
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <span className="text-3xl sm:text-4xl font-black tracking-tight" style={{ color }}>
          {total === 0 ? '—' : `${percent}%`}
        </span>
        <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mt-0.5">
          Attendance
        </span>
      </div>
    </div>
  )
}

function formatSessionDate(dateStr) {
  if (!dateStr) return 'Scheduled Date'
  try {
    const str = String(dateStr).trim()
    const cleanDate = str.split('T')[0]
    const parts = cleanDate.split('-')
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1
      const day = parseInt(parts[2], 10)
      const d = new Date(year, month, day)
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    }
    const d = new Date(str)
    if (isNaN(d.getTime())) return str
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return String(dateStr)
  }
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  const [isLoggedIn, setIsLoggedIn] = useState(null)
  const [username, setUsername] = useState('')
  const [activeTab, setActiveTab] = useState('Overview')
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [totalClasses, setTotalClasses] = useState(0)
  const [attended, setAttended] = useState(0)
  const [missed, setMissed] = useState(0)
  const [overallPct, setOverallPct] = useState(0)
  const [todayStatus, setTodayStatus] = useState({
    title: 'No Class',
    subtext: 'No sessions today',
    statusColor: 'text-purple-600',
    badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-50',
  })
  const [subjectSummary, setSubjectSummary] = useState([])
  const [historyRecords, setHistoryRecords] = useState([])
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [monthlyData, setMonthlyData] = useState([])

  // Modal State for inspecting attended/missed classes in detail
  const [classDetailModal, setClassDetailModal] = useState({
    isOpen: false,
    filter: 'all', // 'all' | 'present' | 'absent'
    subject: 'all',
    searchQuery: '',
  })

  const openClassModal = (filter = 'all', subject = 'all') => {
    setClassDetailModal({
      isOpen: true,
      filter,
      subject,
      searchQuery: '',
    })
  }

  const closeClassModal = () => {
    setClassDetailModal(prev => ({ ...prev, isOpen: false }))
  }

  // Run auth check ONCE on mount only — avoid re-running when navigate ref changes
  useEffect(() => {
    try {
      const loggedIn = localStorage.getItem('isLoggedIn')
      const userType = localStorage.getItem('userType')
      const name = localStorage.getItem('username')

      if (!loggedIn || loggedIn !== 'true') {
        navigateRef.current('/signin', { replace: true })
        return
      }
      if (userType === 'admin') {
        navigateRef.current('/admin/dashboard', { replace: true })
        return
      }
      if (userType === 'teacher') {
        navigateRef.current('/teacher/dashboard', { replace: true })
        return
      }
      if (userType !== 'student') {
        navigateRef.current('/signin', { replace: true })
        return
      }
      setIsLoggedIn(true)
      setUsername(name || '')
    } catch {
      navigateRef.current('/signin', { replace: true })
    }
  }, []) // empty deps = runs only once on mount

  useEffect(() => {
    if (isLoggedIn) fetchStats()
  }, [isLoggedIn])

  const fetchStats = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const studentId = localStorage.getItem('studentId') || localStorage.getItem('userEmail') || localStorage.getItem('username') || ''
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

        const today = new Date().toLocaleDateString('en-CA')
        const todayRecords = records.filter(r => (r.date || '').startsWith(today))
        const todayAttended = todayRecords.filter(r => (r.status || 'present') === 'present').length
        const todayMissed = todayRecords.filter(r => (r.status || 'present') === 'absent').length

        if (todayRecords.length === 0) {
          setTodayStatus({
            title: 'No Class',
            subtext: 'No sessions today',
            statusColor: 'text-purple-600',
            badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
            iconColor: 'text-purple-600',
            iconBg: 'bg-purple-50',
          })
        } else if (todayMissed > 0) {
          setTodayStatus({
            title: 'Class Missed',
            subtext: `${todayMissed} missed today`,
            statusColor: 'text-rose-600',
            badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
            iconColor: 'text-rose-600',
            iconBg: 'bg-rose-50',
          })
        } else if (todayAttended === todayRecords.length) {
          setTodayStatus({
            title: 'All Completed',
            subtext: `All ${todayAttended} attended`,
            statusColor: 'text-emerald-600',
            badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            iconColor: 'text-emerald-600',
            iconBg: 'bg-emerald-50',
          })
        } else if (todayAttended > 0) {
          setTodayStatus({
            title: 'Classes Remaining',
            subtext: `${todayAttended}/${todayRecords.length} completed`,
            statusColor: 'text-blue-600',
            badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
            iconColor: 'text-blue-600',
            iconBg: 'bg-blue-50',
          })
        } else {
          setTodayStatus({
            title: 'Classes Today',
            subtext: `${todayRecords.length} scheduled`,
            statusColor: 'text-indigo-600',
            badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
            iconColor: 'text-indigo-600',
            iconBg: 'bg-indigo-50',
          })
        }

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

  // ─── HOOKS must be called BEFORE any conditional returns ───────────────────
  const safeAbove = overallPct >= 75

  const distinctSubjects = useMemo(() => {
    return Array.from(
      new Set(attendanceRecords.map(r => (r.subject || r.course || 'General').trim()).filter(Boolean))
    )
  }, [attendanceRecords])

  const modalFilteredRecords = useMemo(() => {
    if (!classDetailModal.isOpen) return []
    return attendanceRecords.filter(r => {
      const isPres = (r.status || 'present') === 'present'
      if (classDetailModal.filter === 'present' && !isPres) return false
      if (classDetailModal.filter === 'absent' && isPres) return false

      const subj = (r.subject || r.course || 'General').trim().toLowerCase()
      if (classDetailModal.subject !== 'all' && subj !== classDetailModal.subject.trim().toLowerCase()) return false

      if (classDetailModal.searchQuery.trim()) {
        const q = classDetailModal.searchQuery.trim().toLowerCase()
        const dateStr = (r.date || '').toLowerCase()
        const timeStr = (r.markedAt || r.time || '').toLowerCase()
        if (!subj.includes(q) && !dateStr.includes(q) && !timeStr.includes(q)) return false
      }

      return true
    })
  }, [classDetailModal, attendanceRecords])
  // ───────────────────────────────────────────────────────────────────────────

  // Guard: show spinner while auth check runs (isLoggedIn starts null)
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
  // isLoggedIn===false should not happen (we navigate away), but guard anyway
  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#eef2fb' }}>
        <div className="text-center">
          <p className="text-lg text-gray-500">Redirecting to sign in...</p>
        </div>
      </div>
    )
  }

  const renderClassModal = () => {
    if (!classDetailModal.isOpen) return null
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-200"
        onClick={closeClassModal}
      >
        <div
          className="bg-white rounded-3xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200"
          onClick={e => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className={`p-5 sm:p-6 border-b flex items-start justify-between ${
            classDetailModal.filter === 'absent'
              ? 'bg-red-50/80 border-red-100'
              : classDetailModal.filter === 'present'
              ? 'bg-emerald-50/80 border-emerald-100'
              : 'bg-blue-50/80 border-blue-100'
          }`}>
            <div className="flex items-center gap-3.5">
              <div className={`p-3 rounded-2xl shadow-xs ${
                classDetailModal.filter === 'absent'
                  ? 'bg-red-500 text-white'
                  : classDetailModal.filter === 'present'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 text-white'
              }`}>
                {classDetailModal.filter === 'absent' ? (
                  <XCircle className="w-6 h-6" />
                ) : classDetailModal.filter === 'present' ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <BookOpen className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  {classDetailModal.filter === 'absent'
                    ? 'Missed Lectures Breakdown'
                    : classDetailModal.filter === 'present'
                    ? 'Attended Lectures Breakdown'
                    : 'All Conducted Sessions'}
                </h3>
                <p className="text-xs sm:text-sm font-medium text-slate-600 mt-0.5">
                  {classDetailModal.filter === 'absent'
                    ? `Showing ${modalFilteredRecords.length} missed ${modalFilteredRecords.length === 1 ? 'class' : 'classes'} across your semester`
                    : classDetailModal.filter === 'present'
                    ? `Showing ${modalFilteredRecords.length} verified attended ${modalFilteredRecords.length === 1 ? 'class' : 'classes'}`
                    : `Showing all ${modalFilteredRecords.length} lectures held this semester`}
                </p>
              </div>
            </div>

            <button
              onClick={closeClassModal}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-xl transition-all"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Filter Controls Bar */}
          <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Status Tabs */}
            <div className="flex items-center gap-1 w-full sm:w-auto bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
              <button
                onClick={() => setClassDetailModal(prev => ({ ...prev, filter: 'all' }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  classDetailModal.filter === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({totalClasses})
              </button>
              <button
                onClick={() => setClassDetailModal(prev => ({ ...prev, filter: 'present' }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  classDetailModal.filter === 'present'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Attended ({attended})
              </button>
              <button
                onClick={() => setClassDetailModal(prev => ({ ...prev, filter: 'absent' }))}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  classDetailModal.filter === 'absent'
                    ? 'bg-red-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Missed ({missed})
              </button>
            </div>

            {/* Subject Dropdown & Search */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {distinctSubjects.length > 1 && (
                <select
                  value={classDetailModal.subject}
                  onChange={e => setClassDetailModal(prev => ({ ...prev, subject: e.target.value }))}
                  className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                >
                  <option value="all">All Subjects</option>
                  {distinctSubjects.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}

              <div className="relative flex-1 sm:w-48">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter sessions..."
                  value={classDetailModal.searchQuery}
                  onChange={e => setClassDetailModal(prev => ({ ...prev, searchQuery: e.target.value }))}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* Session List */}
          <div className="p-4 sm:p-6 overflow-y-auto max-h-[55vh] space-y-2.5 divide-y divide-slate-100">
            {modalFilteredRecords.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <Filter className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-slate-800 mb-1">No Matching Lectures Found</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Try adjusting your filter or search query to find specific sessions.
                </p>
              </div>
            ) : (
              modalFilteredRecords.map((rec, i) => {
                const isPres = (rec.status || 'present') === 'present'
                const formattedDate = formatSessionDate(rec.date || rec.markedAt)

                return (
                  <div
                    key={i}
                    className="pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl hover:bg-slate-50/80 transition-colors border border-transparent hover:border-slate-200/80"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl mt-0.5 ${
                        isPres ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                      }`}>
                        {isPres ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900">
                            {rec.subject || rec.course || 'General Lecture'}
                          </h4>
                          {rec.department && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200/80 text-slate-700 rounded-md">
                              {rec.department}
                            </span>
                          )}
                          {rec.division && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200/80 text-slate-700 rounded-md">
                              Div {rec.division}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-1 flex-wrap">
                          <span>📅 {formattedDate}</span>
                          <span>•</span>
                          <span>
                            {isPres
                              ? rec.markedAt || rec.time
                                ? `⏰ Marked at ${rec.markedAt || rec.time}`
                                : '⏰ Verified'
                              : '⏰ Session ended (unrecorded)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center sm:self-center self-end">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-2xs ${
                        isPres
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-red-100 text-red-700 border border-red-300'
                      }`}>
                        {isPres ? '✓ Attended' : '✗ Absent'}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>
              Showing {modalFilteredRecords.length} of {attendanceRecords.length} total sessions
            </span>
            <button
              onClick={closeClassModal}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors shadow-sm cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

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
              onClick={() => navigate('/student/mark-attendance')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors text-base font-semibold shadow-sm"
            >
              <Camera className="w-4 h-4" />
              Mark Attendance
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
        {/* Contextual Status Banner */}
        {localStorage.getItem('hasStudentRecord') !== 'true' && !loading ? (
          <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-blue-50/90 border border-blue-200/90 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-blue-600 text-white rounded-xl shadow-xs flex-shrink-0">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Student Profile & Face Registration Required</h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Register your academic details and enroll 5 biometric face samples to enable automated classroom attendance.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/student/registrationform')}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-xs hover:shadow-sm whitespace-nowrap flex-shrink-0 cursor-pointer"
            >
              Complete Registration →
            </button>
          </div>
        ) : totalClasses > 0 && !safeAbove ? (
          <div className="bg-rose-50/80 border border-rose-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-xs flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-950">Attendance Alert: Below Required 75%</h3>
                <p className="text-xs text-rose-700 mt-0.5">
                  Your overall attendance is currently at <span className="font-bold">{overallPct}%</span>. Attend consecutive upcoming classes to restore your good standing.
                </p>
              </div>
            </div>
            <button
              onClick={() => openClassModal('absent')}
              className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold rounded-xl text-xs transition-colors whitespace-nowrap flex-shrink-0 cursor-pointer border border-rose-200"
            >
              Review Missed ({missed}) →
            </button>
          </div>
        ) : totalClasses > 0 && safeAbove ? (
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs flex-shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-950">Good Academic Standing</h3>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Your attendance is comfortably above the 75% requirement at <span className="font-bold">{overallPct}%</span>. Keep up the consistent streak!
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-200 px-3 py-1.5 rounded-xl whitespace-nowrap">
              {attended} / {totalClasses} Attended
            </span>
          </div>
        ) : null}

        {/* Top 5 Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Card 1: Total Classes */}
          <div
            onClick={() => openClassModal('all')}
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-blue-300 hover:shadow-sm transition-all flex flex-col justify-between min-h-[148px] cursor-pointer group select-none"
            title="Click to see full schedule & all conducted classes"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                View →
              </span>
            </div>
            <div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">
                {loading ? '—' : totalClasses}
              </div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                Total Classes
              </div>
              <div className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">
                {totalClasses === 0 ? 'No sessions logged' : `${totalClasses} scheduled lectures`}
              </div>
            </div>
          </div>

          {/* Card 2: Classes Attended */}
          <div
            onClick={() => openClassModal('present')}
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all flex flex-col justify-between min-h-[148px] cursor-pointer group select-none"
            title="Click to see which classes you attended"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                View →
              </span>
            </div>
            <div>
              <div className="text-3xl font-black text-emerald-600 tracking-tight">
                {loading ? '—' : attended}
              </div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                Classes Attended
              </div>
              <div className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">
                {totalClasses === 0 ? '0 verified' : `${attended} verified present`}
              </div>
            </div>
          </div>

          {/* Card 3: Classes Missed */}
          <div
            onClick={() => openClassModal('absent')}
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-rose-300 hover:shadow-sm transition-all flex flex-col justify-between min-h-[148px] cursor-pointer group select-none"
            title="Click to see which class(es) you missed"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 group-hover:bg-rose-100 transition-colors">
                <XCircle className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                View →
              </span>
            </div>
            <div>
              <div className="text-3xl font-black text-rose-600 tracking-tight">
                {loading ? '—' : missed}
              </div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                Classes Missed
              </div>
              <div className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">
                {missed === 0 ? 'Zero absences' : `${missed} unexcused absence${missed === 1 ? '' : 's'}`}
              </div>
            </div>
          </div>

          {/* Card 4: Overall % */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all flex flex-col justify-between min-h-[148px]">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                totalClasses === 0
                  ? 'bg-slate-50 text-slate-500 border-slate-200'
                  : overallPct >= 75
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {totalClasses === 0 ? 'Pending' : overallPct >= 75 ? 'Safe' : 'Low'}
              </span>
            </div>
            <div>
              <div className={`text-3xl font-black tracking-tight ${
                totalClasses === 0 ? 'text-slate-400' : overallPct >= 75 ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                {loading || totalClasses === 0 ? '—' : `${overallPct}%`}
              </div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                Overall %
              </div>
              <div className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">
                {totalClasses === 0 ? 'No attendance yet' : 'Semester cumulative'}
              </div>
            </div>
          </div>

          {/* Card 5: Today's Status */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-purple-300 hover:shadow-sm transition-all flex flex-col justify-between min-h-[148px] col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${todayStatus.iconBg} ${todayStatus.iconColor}`}>
                <CalendarClock className="w-5 h-5" />
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${todayStatus.badgeBg}`}>
                Today
              </span>
            </div>
            <div>
              <div className={`text-xl sm:text-2xl font-black tracking-tight ${todayStatus.statusColor} truncate`}>
                {todayStatus.title}
              </div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                Today's Status
              </div>
              <div className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">
                {todayStatus.subtext}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Bar - Modern Segmented Control */}
        <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Overview Tab */}
        {activeTab === 'Overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Box: Overall Attendance */}
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Overall Attendance</h3>
                      <p className="text-xs text-slate-500">Cumulative semester progress</p>
                    </div>
                    {totalClasses > 0 && (
                      <span className="text-xs font-semibold text-slate-400">
                        {attended} of {totalClasses} classes attended
                      </span>
                    )}
                  </div>

                  <div className="flex justify-center my-4">
                    <DonutChart percent={overallPct} total={totalClasses} />
                  </div>

                  <div className="flex justify-center my-2">
                    {totalClasses === 0 ? (
                      <div className="text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 border border-slate-200 text-slate-600">
                          Pending Classes
                        </span>
                        <p className="text-xs text-slate-400 mt-1.5 max-w-xs">
                          Your percentage will calculate automatically as classroom lectures are logged.
                        </p>
                      </div>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold border shadow-2xs ${
                          safeAbove
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-rose-50 border-rose-200 text-rose-700'
                        }`}
                      >
                        {safeAbove ? <ShieldCheck className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                        {safeAbove ? 'Good Standing (≥ 75%)' : 'Attendance Alert (< 75%)'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-slate-100">
                  <div
                    onClick={() => openClassModal('present')}
                    className="bg-emerald-50/70 border border-emerald-100 hover:border-emerald-300 rounded-2xl p-4 text-center cursor-pointer hover:shadow-xs transition-all group select-none"
                    title="Click to view all attended classes"
                  >
                    <div className="text-2xl sm:text-3xl font-black text-emerald-700">{attended}</div>
                    <div className="text-xs font-bold text-slate-600 mt-0.5 flex items-center justify-center gap-1">
                      <span>Present Classes</span>
                      <span className="text-xs text-emerald-600 group-hover:translate-x-0.5 transition-transform">→</span>
                    </div>
                  </div>
                  <div
                    onClick={() => openClassModal('absent')}
                    className="bg-rose-50/70 border border-rose-100 hover:border-rose-300 rounded-2xl p-4 text-center cursor-pointer hover:shadow-xs transition-all group select-none"
                    title="Click to view all missed classes"
                  >
                    <div className="text-2xl sm:text-3xl font-black text-rose-600">{missed}</div>
                    <div className="text-xs font-bold text-slate-600 mt-0.5 flex items-center justify-center gap-1">
                      <span>Absent Classes</span>
                      <span className="text-xs text-rose-500 group-hover:translate-x-0.5 transition-transform">→</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Box: Subject Attendance Summary */}
              <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Subject Breakdown</h3>
                      <p className="text-xs text-slate-500">Per-course performance & thresholds</p>
                    </div>
                    <span className="text-xs font-medium text-slate-400">Click row for logs</span>
                  </div>

                  {subjectSummary.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 mb-1">No Subject Records Found</h4>
                      <p className="text-xs text-slate-500 max-w-xs">
                        Course-wise attendance rates will appear here once teachers conduct lectures.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3.5 flex-1">
                      {subjectSummary.map(subj => {
                        const statusBadge =
                          subj.pct >= 75
                            ? { label: 'Good attendance', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
                            : subj.pct >= 60
                            ? { label: 'At risk', class: 'bg-amber-50 text-amber-700 border-amber-200' }
                            : { label: 'Low attendance', class: 'bg-rose-50 text-rose-700 border-rose-200' }

                        const barColor =
                          subj.pct >= 75 ? 'bg-emerald-500' : subj.pct >= 60 ? 'bg-amber-500' : 'bg-rose-500'

                        return (
                          <div
                            key={subj.name}
                            onClick={() => openClassModal('all', subj.name)}
                            className="p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200/80 transition-all cursor-pointer group select-none"
                            title={`Click to view sessions for ${subj.name}`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                                  {subj.name}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${statusBadge.class}`}>
                                  {statusBadge.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-slate-900">{subj.pct}%</span>
                                <span className="text-xs font-semibold text-slate-400">
                                  ({subj.present}/{subj.total})
                                </span>
                              </div>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                style={{ width: `${subj.pct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
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
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Subject-wise Attendance</h3>
                <p className="text-xs text-slate-500">Comprehensive course breakdown and status</p>
              </div>
            </div>

            {subjectSummary.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  <BookOpen className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-800 mb-1">No Subject Data Available</h4>
                <p className="text-xs text-slate-500 max-w-sm">
                  Course statistics will populate automatically once your classes commence and attendance is marked.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {subjectSummary.map(subj => {
                  const statusBadge =
                    subj.pct >= 75
                      ? { label: 'Good attendance', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
                      : subj.pct >= 60
                      ? { label: 'At risk', class: 'bg-amber-50 text-amber-700 border-amber-200' }
                      : { label: 'Low attendance', class: 'bg-rose-50 text-rose-700 border-rose-200' }

                  const barColor =
                    subj.pct >= 75 ? 'bg-emerald-500' : subj.pct >= 60 ? 'bg-amber-500' : 'bg-rose-500'

                  return (
                    <div
                      key={subj.name}
                      onClick={() => openClassModal('all', subj.name)}
                      className="border border-slate-200/80 rounded-2xl p-5 bg-white shadow-xs hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group select-none"
                      title={`Click to view sessions for ${subj.name}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="text-base font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                          {subj.name}
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex-shrink-0 ${statusBadge.class}`}>
                          {statusBadge.label}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-3xl font-black text-slate-900 tracking-tight">
                          {subj.pct}%
                        </span>
                        <span className="text-xs font-semibold text-slate-400">
                          {subj.present} of {subj.total} attended
                        </span>
                      </div>
                      <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${subj.pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'History' && (
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Attendance History Logs</h3>
                <p className="text-xs text-slate-500">Chronological verification records</p>
              </div>
              {historyRecords.length > 0 && (
                <span className="text-xs font-medium text-slate-400">
                  Showing last {historyRecords.length} records
                </span>
              )}
            </div>

            {historyRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-3">
                  <Clock className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-800 mb-1">No Attendance Logs Recorded</h4>
                <p className="text-xs text-slate-500 max-w-sm">
                  Historical timestamps and automated attendance verifications will appear here once lectures are marked.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      {['Date', 'Subject', 'Time', 'Status'].map(h => (
                        <th key={h} className="px-6 py-3.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {historyRecords.map((r, i) => {
                      const isPres = (r.status || 'present') === 'present'
                      return (
                        <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-6 py-3.5 font-bold text-slate-800">
                            {formatSessionDate(r.date || r.markedAt)}
                          </td>
                          <td className="px-6 py-3.5 text-slate-700 font-medium">
                            {r.subject || r.course || 'General'}
                          </td>
                          <td className="px-6 py-3.5 text-slate-500 font-mono text-xs">
                            {r.markedAt || r.time || '—'}
                          </td>
                          <td className="px-6 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-0.5 text-xs font-bold rounded-full border ${
                                isPres
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {isPres ? '✓ Present' : '✗ Absent'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Monthly Tab */}
        {activeTab === 'Monthly' && (
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Monthly Attendance Trends</h3>
                <p className="text-xs text-slate-500">Month-over-month performance trends</p>
              </div>
            </div>

            {monthlyData.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16">
                <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
                  <TrendingUp className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-800 mb-1">No Monthly Trends Yet</h4>
                <p className="text-xs text-slate-500 max-w-sm">
                  Monthly attendance percentages and trends will compile over time as terms progress.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {monthlyData.map(m => {
                  const barColor =
                    m.pct >= 75 ? 'bg-emerald-500' : m.pct >= 60 ? 'bg-amber-500' : 'bg-rose-500'

                  return (
                    <div key={m.month} className="p-4 rounded-xl bg-slate-50/50 border border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-800">
                          {(() => {
                            try {
                              const parts = (m.month || '').split('-')
                              if (parts.length === 2) {
                                const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1)
                                return d.toLocaleString('default', { month: 'long', year: 'numeric' })
                              }
                              return m.month
                            } catch {
                              return m.month
                            }
                          })()}
                        </span>
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-black text-slate-900">{m.pct}%</span>
                          <span className="text-xs font-semibold text-slate-400">
                            ({m.present}/{m.total})
                          </span>
                        </div>
                      </div>
                      <div className="h-2.5 bg-slate-200/70 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${m.pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Interactive Class Detail Inspection Modal */}
      {renderClassModal()}
    </div>
  )
}
