import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Users,
  ShieldAlert,
  ShieldCheck,
  Camera,
  Mail,
  Phone,
  GraduationCap,
  Sparkles,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  UploadCloud,
  Download,
  Trash2,
  X,
  FileCheck,
  HelpCircle
} from 'lucide-react'
import { apiFetch, getToken } from '../../lib/api.js'

export default function StudentApprovals() {
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState({})
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('pending_approval')
  const [rosterFilter, setRosterFilter] = useState('all')
  const [rosterTotal, setRosterTotal] = useState(0)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  // Master Roster Modal State
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false)
  const [uploadingRoster, setUploadingRoster] = useState(false)
  const [uploadStats, setUploadStats] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const loggedIn = localStorage.getItem('isLoggedIn')
    const userType = localStorage.getItem('userType')
    if (!loggedIn || loggedIn !== 'true' || userType !== 'admin') {
      navigate('/signin', { replace: true })
      return
    }
    fetchStudents()
  }, [navigate])

  const fetchStudents = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/admin/approvals/students?status=all')
      const data = await res.json()
      if (data.success) {
        setStudents(data.students || [])
        setRosterTotal(data.rosterTotal || 0)
      } else {
        setError(data.error || 'Failed to fetch student records')
      }
    } catch {
      setError('Error connecting to backend server')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (identifier, name) => {
    setActionLoading(prev => ({ ...prev, [identifier]: true }))
    setMessage(null)
    setError(null)
    try {
      const res = await apiFetch(`/api/admin/approve-student/${encodeURIComponent(identifier)}`, {
        method: 'POST'
      })
      const data = await res.json()
      if (data.success) {
        setMessage(data.message || `Student ${name || identifier} approved successfully!`)
        fetchStudents()
      } else {
        setError(data.error || 'Failed to approve student')
      }
    } catch {
      setError('Network error while approving student')
    } finally {
      setActionLoading(prev => ({ ...prev, [identifier]: false }))
    }
  }

  const handleReject = async (identifier, name) => {
    if (!window.confirm(`Are you sure you want to reject registration for ${name || identifier}?`)) {
      return
    }
    setActionLoading(prev => ({ ...prev, [identifier]: true }))
    setMessage(null)
    setError(null)
    try {
      const res = await apiFetch(`/api/admin/reject-student/${encodeURIComponent(identifier)}`, {
        method: 'POST'
      })
      const data = await res.json()
      if (data.success) {
        setMessage(data.message || 'Student registration rejected.')
        fetchStudents()
      } else {
        setError(data.error || 'Failed to reject student')
      }
    } catch {
      setError('Network error while rejecting student')
    } finally {
      setActionLoading(prev => ({ ...prev, [identifier]: false }))
    }
  }

  const handleApproveAll = async () => {
    const pendingCount = students.filter(s => (s.status || 'pending_approval') === 'pending_approval').length
    if (pendingCount === 0) return

    if (!window.confirm(`Are you sure you want to approve ALL ${pendingCount} pending student registrations?`)) {
      return
    }

    setLoading(true)
    setMessage(null)
    setError(null)
    try {
      const res = await apiFetch('/api/admin/approve-all-students', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setMessage(data.message || 'All pending students approved successfully!')
        fetchStudents()
      } else {
        setError(data.error || 'Failed to approve pending students')
      }
    } catch {
      setError('Network error during bulk approval')
    } finally {
      setLoading(false)
    }
  }

  const handleAutoApproveVerified = async () => {
    const verifiedPendingCount = students.filter(
      s => (s.status || 'pending_approval') === 'pending_approval' && s.rosterMatched
    ).length

    if (verifiedPendingCount === 0) return

    if (
      !window.confirm(
        `Auto-approve ${verifiedPendingCount} student(s) who officially match the College Master Roster?`
      )
    ) {
      return
    }

    setLoading(true)
    setMessage(null)
    setError(null)
    try {
      const res = await apiFetch('/api/admin/auto-approve-verified', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setMessage(data.message || `Successfully auto-approved verified students!`)
        fetchStudents()
      } else {
        setError(data.error || 'Failed to auto-approve verified students')
      }
    } catch {
      setError('Network error during auto-approval')
    } finally {
      setLoading(false)
    }
  }

  const handleRosterFileUpload = async e => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingRoster(true)
    setUploadStats(null)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    const token = getToken()
    const headers = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    try {
      const res = await fetch('/api/admin/roster/upload', {
        method: 'POST',
        headers,
        body: formData
      })
      const data = await res.json()
      if (data.success) {
        setUploadStats(data.stats)
        setMessage(data.message || 'Master Roster uploaded successfully!')
        fetchStudents()
      } else {
        setError(data.error || 'Failed to upload Master Roster')
      }
    } catch {
      setError('Network error during file upload')
    } finally {
      setUploadingRoster(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleClearRoster = async () => {
    if (!window.confirm('Are you sure you want to clear all records from the Master Student Roster?')) {
      return
    }
    try {
      const res = await apiFetch('/api/admin/roster/clear', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setMessage(data.message || 'Master Roster cleared.')
        fetchStudents()
      }
    } catch {
      setError('Error clearing roster')
    }
  }

  const handleDownloadTemplate = (fmt = 'xlsx') => {
    window.open(`/sample_master_student_roster.${fmt}`, '_blank')
  }

  const counts = useMemo(() => {
    const pending = students.filter(s => (s.status || 'pending_approval') === 'pending_approval').length
    const active = students.filter(s => s.status === 'active').length
    const rejected = students.filter(s => s.status === 'rejected').length
    const verifiedPending = students.filter(
      s => (s.status || 'pending_approval') === 'pending_approval' && s.rosterMatched
    ).length
    return { pending, active, rejected, total: students.length, verifiedPending }
  }, [students])

  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const statusMatch =
        activeTab === 'all'
          ? true
          : (student.status || 'pending_approval') === activeTab

      if (!statusMatch) return false

      if (rosterFilter === 'verified' && !student.rosterMatched) return false
      if (rosterFilter === 'unrecognized' && student.rosterMatched) return false

      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        (student.studentName && student.studentName.toLowerCase().includes(q)) ||
        (student.studentId && student.studentId.toLowerCase().includes(q)) ||
        (student.email && student.email.toLowerCase().includes(q)) ||
        (student.phoneNumber && student.phoneNumber.includes(q)) ||
        (student.department && student.department.toLowerCase().includes(q)) ||
        (student.rosterRecord?.fullName && student.rosterRecord.fullName.toLowerCase().includes(q))
      )
    })
  }, [students, activeTab, rosterFilter, search])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Top Navbar */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="p-2.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-colors flex items-center gap-2 text-base font-semibold"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Back to Dashboard</span>
            </button>
            <div className="h-7 w-px bg-slate-800 hidden sm:block" />
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5 tracking-tight">
                <span>Student Approval Portal</span>
                <span className="text-xs sm:text-sm font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Institutional KYC
                </span>
              </h1>
              <p className="text-sm text-slate-300 hidden sm:block font-medium">
                Verify student registrations against College Master Roster &amp; biometrics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Master Roster Status Chip */}
            <button
              onClick={() => setIsRosterModalOpen(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                rosterTotal > 0
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25 shadow-sm'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25 shadow-sm'
              }`}
              title="Click to view or upload Master Roster"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>{rosterTotal > 0 ? `Master Roster (${rosterTotal})` : 'Upload Master Roster'}</span>
            </button>

            <button
              onClick={fetchStudents}
              disabled={loading}
              className="p-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              title="Refresh data"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Auto-Approve Verified Button */}
            {counts.verifiedPending > 0 && (
              <button
                onClick={handleAutoApproveVerified}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition-all hover:scale-102"
                title="Auto-Approve all students who match the official college roster"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Auto-Approve Verified ({counts.verifiedPending})</span>
              </button>
            )}

            {/* Bulk Approve All */}
            {counts.pending > 0 && (
              <button
                onClick={handleApproveAll}
                disabled={loading}
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl border border-slate-700 transition-all"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Approve All ({counts.pending})</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Banner Messages */}
        {message && (
          <div className="mb-6 p-4 bg-emerald-900/40 border border-emerald-500/50 rounded-2xl flex items-center gap-3 text-emerald-200 text-base shadow-lg">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
            <span className="font-semibold">{message}</span>
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-rose-900/40 border border-rose-500/50 rounded-2xl flex items-center gap-3 text-rose-200 text-base shadow-lg">
            <AlertCircle className="w-6 h-6 text-rose-400 flex-shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Master Roster Advisory Notice if 0 records */}
        {rosterTotal === 0 && (
          <div className="mb-6 p-5 bg-indigo-950/50 border border-indigo-500/50 rounded-2xl flex items-center justify-between gap-4 text-indigo-100 text-sm sm:text-base">
            <div className="flex items-center gap-3.5">
              <FileSpreadsheet className="w-7 h-7 text-indigo-400 flex-shrink-0" />
              <div>
                <span className="font-bold text-white text-base">Upload College Master Student Roster:</span> Cross-reference registrations automatically against admitted college rolls to verify genuine students and flag imposters.
              </div>
            </div>
            <button
              onClick={() => setIsRosterModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm whitespace-nowrap shadow-md transition-all"
            >
              Upload Excel / CSV
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div
            onClick={() => setActiveTab('pending_approval')}
            className={`p-6 rounded-2xl border cursor-pointer transition-all ${
              activeTab === 'pending_approval'
                ? 'bg-amber-500/15 border-amber-500/60 ring-2 ring-amber-500/40 shadow-xl shadow-amber-500/10'
                : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-slate-300">Pending Approval</span>
              <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-400">
                <Clock className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-black text-amber-400">{counts.pending}</span>
              <span className="text-sm text-slate-400 font-medium">require verification</span>
            </div>
            {counts.verifiedPending > 0 && (
              <div className="mt-2.5 text-sm text-emerald-400 flex items-center gap-1.5 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>{counts.verifiedPending} match Master Roster</span>
              </div>
            )}
          </div>

          <div
            onClick={() => setActiveTab('active')}
            className={`p-6 rounded-2xl border cursor-pointer transition-all ${
              activeTab === 'active'
                ? 'bg-emerald-500/15 border-emerald-500/60 ring-2 ring-emerald-500/40 shadow-xl shadow-emerald-500/10'
                : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-slate-300">Active Students</span>
              <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-black text-emerald-400">{counts.active}</span>
              <span className="text-sm text-slate-400 font-medium">can sign in &amp; attend</span>
            </div>
          </div>

          <div
            onClick={() => setActiveTab('rejected')}
            className={`p-6 rounded-2xl border cursor-pointer transition-all ${
              activeTab === 'rejected'
                ? 'bg-rose-500/15 border-rose-500/60 ring-2 ring-rose-500/40 shadow-xl shadow-rose-500/10'
                : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-slate-300">Rejected / Suspended</span>
              <div className="p-2.5 bg-rose-500/20 rounded-xl text-rose-400">
                <XCircle className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-black text-rose-400">{counts.rejected}</span>
              <span className="text-sm text-slate-400 font-medium">access revoked</span>
            </div>
          </div>

          <div
            onClick={() => setActiveTab('all')}
            className={`p-6 rounded-2xl border cursor-pointer transition-all ${
              activeTab === 'all'
                ? 'bg-blue-500/15 border-blue-500/60 ring-2 ring-blue-500/40 shadow-xl shadow-blue-500/10'
                : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-slate-300">Total Registered</span>
              <div className="p-2.5 bg-blue-500/20 rounded-xl text-blue-400">
                <Users className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">{counts.total}</span>
              <span className="text-sm text-slate-400 font-medium">in database</span>
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Main Status Tabs */}
          <div className="flex bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 w-full md:w-auto overflow-x-auto">
            {[
              { key: 'pending_approval', label: 'Pending Approval', count: counts.pending },
              { key: 'active', label: 'Active', count: counts.active },
              { key: 'rejected', label: 'Rejected', count: counts.rejected },
              { key: 'all', label: 'All Students', count: counts.total }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 rounded-lg text-base font-bold transition-all whitespace-nowrap flex items-center gap-2.5 ${
                  activeTab === tab.key
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-sm px-2.5 py-0.5 rounded-full font-bold ${
                    activeTab === tab.key
                      ? 'bg-blue-500/50 text-white'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Secondary Roster Verification Filter & Search */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {rosterTotal > 0 && (
              <div className="flex bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 text-sm w-full sm:w-auto">
                <button
                  onClick={() => setRosterFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all font-bold ${
                    rosterFilter === 'all' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setRosterFilter('verified')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 font-bold ${
                    rosterFilter === 'verified'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-emerald-400 hover:text-emerald-300'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verified Only</span>
                </button>
                <button
                  onClick={() => setRosterFilter('unrecognized')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 font-bold ${
                    rosterFilter === 'unrecognized'
                      ? 'bg-rose-600 text-white shadow'
                      : 'text-rose-400 hover:text-rose-300'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Unrecognized</span>
                </button>
              </div>
            )}

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name, roll, email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-11 pr-4 py-2.5 text-base text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200 font-bold"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Student Cards / Table */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-blue-500 mx-auto mb-4" />
            <p className="text-slate-300 text-base font-semibold">Loading student profiles...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl py-16 px-6 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              {activeTab === 'pending_approval' ? (
                <CheckCircle2 className="w-9 h-9 text-emerald-400" />
              ) : (
                <Users className="w-9 h-9" />
              )}
            </div>
            <h3 className="text-xl font-bold text-white mb-1.5">
              {activeTab === 'pending_approval' ? 'No Pending Approvals!' : 'No Students Found'}
            </h3>
            <p className="text-slate-400 text-base max-w-md mx-auto">
              {activeTab === 'pending_approval'
                ? 'All student registrations and KYC biometric profiles have been verified.'
                : search
                ? `No students matching "${search}" were found in this tab.`
                : 'No student accounts are currently registered under this category.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredStudents.map(student => {
              const identifier = student._id || student.email || student.studentId
              const isActioning = actionLoading[identifier]
              const status = student.status || 'pending_approval'

              return (
                <div
                  key={student._id || student.studentId || student.email}
                  className={`bg-slate-900/80 border rounded-2xl p-6 sm:p-7 transition-all shadow-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 ${
                    student.rosterMatched
                      ? 'border-emerald-500/40 hover:border-emerald-500/60 ring-1 ring-emerald-500/20'
                      : rosterTotal > 0
                      ? 'border-amber-500/40 hover:border-amber-500/60 ring-1 ring-amber-500/20'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Left Info */}
                  <div className="flex items-start gap-4 sm:gap-5 flex-1">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white text-xl flex-shrink-0 shadow-lg ${
                        student.rosterMatched
                          ? 'bg-gradient-to-br from-emerald-600 to-teal-700'
                          : 'bg-gradient-to-br from-blue-600 to-indigo-700'
                      }`}
                    >
                      {(student.studentName || student.studentId || 'S').charAt(0).toUpperCase()}
                    </div>

                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h4 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
                          {student.studentName || student.studentId || 'Unnamed Student'}
                        </h4>

                        {student.department === 'Pending Enrollment' && (
                          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-bold bg-indigo-500/25 text-indigo-300 border border-indigo-500/40">
                            Self-Signup
                          </span>
                        )}

                        {/* Status Badge */}
                        {status === 'pending_approval' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-amber-500/25 text-amber-300 border border-amber-500/40">
                            <Clock className="w-4 h-4" />
                            Pending Approval
                          </span>
                        )}
                        {status === 'active' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-emerald-500/25 text-emerald-300 border border-emerald-500/40">
                            <CheckCircle2 className="w-4 h-4" />
                            Active
                          </span>
                        )}
                        {status === 'rejected' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-rose-500/25 text-rose-300 border border-rose-500/40">
                            <XCircle className="w-4 h-4" />
                            Rejected
                          </span>
                        )}

                        {/* Master Roster Verification Badge */}
                        {student.rosterMatched ? (
                          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs sm:text-sm font-bold bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-sm">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            Official College Record
                          </span>
                        ) : rosterTotal > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs sm:text-sm font-bold bg-rose-500/15 text-rose-400 border border-rose-500/40 shadow-sm">
                            <ShieldAlert className="w-4 h-4 text-rose-400" />
                            Not in College Roster
                          </span>
                        ) : null}

                        {/* Biometric Badge */}
                        {student.face_registered || student.hasFaceProfile ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                            <Camera className="w-4 h-4 text-cyan-400" />
                            Face Enrolled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            <ShieldAlert className="w-4 h-4 text-slate-400" />
                            No Face Data
                          </span>
                        )}
                      </div>

                      {/* Official Roster Match Details Banner if matched */}
                      {student.rosterMatched && student.rosterRecord && (
                        <div className="text-sm text-emerald-200 flex flex-wrap items-center gap-x-3.5 gap-y-1 bg-emerald-950/50 px-4 py-2 rounded-xl border border-emerald-500/30 font-medium">
                          <span className="font-bold text-emerald-400">Official Match:</span>
                          <span className="font-semibold">{student.rosterRecord.fullName}</span>
                          <span>• {student.rosterRecord.department}</span>
                          {student.rosterRecord.year && <span>• {student.rosterRecord.year}</span>}
                          {student.rosterRecord.division && <span>• Div {student.rosterRecord.division}</span>}
                        </div>
                      )}

                      {/* Detail row */}
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-slate-300 pt-0.5">
                        <div className="flex items-center gap-1.5 text-slate-200 font-mono font-semibold">
                          <GraduationCap className="w-4 h-4 text-slate-400" />
                          <span>ID: {student.studentId || 'N/A'}</span>
                        </div>
                        {student.department && student.department !== 'N/A' && (
                          <div>
                            <span className="text-slate-400">Dept:</span>{' '}
                            <span className="text-slate-200 font-medium">{student.department}</span>
                            {student.year && student.year !== 'N/A' && ` (${student.year})`}
                            {student.division && student.division !== 'N/A' && ` Div ${student.division}`}
                          </div>
                        )}
                        {student.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <span>{student.email}</span>
                          </div>
                        )}
                        {student.phoneNumber && (
                          <div className="flex items-center gap-1.5 text-slate-200 font-medium">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <span>{student.phoneNumber}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-3 w-full lg:w-auto justify-end border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-800">
                    {status === 'pending_approval' && (
                      <>
                        <button
                          onClick={() => handleReject(identifier, student.studentName)}
                          disabled={isActioning}
                          className="px-4 py-2.5 rounded-xl text-sm font-bold text-rose-400 hover:bg-rose-500/10 border border-rose-500/40 hover:border-rose-500/60 transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Reject</span>
                        </button>

                        <button
                          onClick={() => handleApprove(identifier, student.studentName)}
                          disabled={isActioning}
                          className={`px-5 py-2.5 rounded-xl text-sm font-black text-white shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 ${
                            student.rosterMatched
                              ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30 hover:shadow-emerald-600/50'
                              : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{isActioning ? 'Approving...' : 'Approve & Activate'}</span>
                        </button>
                      </>
                    )}

                    {status === 'active' && (
                      <button
                        onClick={() => handleReject(identifier, student.studentName)}
                        disabled={isActioning}
                        className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/40 transition-all flex items-center gap-1.5 disabled:opacity-50"
                        title="Suspend account access"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Suspend</span>
                      </button>
                    )}

                    {status === 'rejected' && (
                      <button
                        onClick={() => handleApprove(identifier, student.studentName)}
                        disabled={isActioning}
                        className="px-4 py-2 rounded-xl text-sm font-bold text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/40 transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Re-Approve</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Upload Master Roster Modal */}
      {isRosterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-7 shadow-2xl relative">
            <button
              onClick={() => {
                setIsRosterModalOpen(false)
                setUploadStats(null)
              }}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3.5 mb-5">
              <div className="p-3.5 bg-emerald-500/20 text-emerald-400 rounded-2xl">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">College Master Student Roster</h3>
                <p className="text-sm text-slate-300">Upload official list of admitted students to auto-verify KYC</p>
              </div>
            </div>

            {/* Current Status */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 mb-5 flex items-center justify-between">
              <div>
                <span className="text-sm text-slate-400 block font-medium">Current Roster Records</span>
                <span className="text-3xl font-black text-white">{rosterTotal} Students</span>
              </div>
              {rosterTotal > 0 && (
                <button
                  onClick={handleClearRoster}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-sm text-rose-400 hover:bg-rose-500/10 border border-rose-500/30 rounded-xl font-semibold transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Clear Roster</span>
                </button>
              )}
            </div>

            {/* Upload Area */}
            <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl p-7 text-center mb-5 transition-colors">
              <UploadCloud className="w-12 h-12 text-slate-400 mx-auto mb-2.5" />
              <p className="text-base font-bold text-white mb-1">Upload Official Excel or CSV File</p>
              <p className="text-sm text-slate-400 mb-5">Supports .xlsx, .xls, or .csv formats</p>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleRosterFileUpload}
                accept=".csv, .xlsx, .xls"
                className="hidden"
                id="roster-upload-input"
                disabled={uploadingRoster}
              />
              <label
                htmlFor="roster-upload-input"
                className={`inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl cursor-pointer shadow-lg shadow-emerald-600/30 transition-all ${
                  uploadingRoster ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {uploadingRoster ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing Sheet...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Choose File to Import</span>
                  </>
                )}
              </label>
            </div>

            {/* Upload Result Stats */}
            {uploadStats && (
              <div className="mb-5 p-4 bg-emerald-900/40 border border-emerald-500/50 rounded-2xl text-sm text-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-emerald-400" />
                  <span>Imported: <b>{uploadStats.inserted} new</b>, <b>{uploadStats.updated} updated</b></span>
                </div>
                <span className="text-emerald-400 font-black text-base">Total: {uploadStats.totalProcessed}</span>
              </div>
            )}

            {/* Download Template & Guidance */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800 text-sm">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleDownloadTemplate('xlsx')}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl font-bold transition-all text-xs sm:text-sm"
                  title="Download sample formatted Excel spreadsheet (.xlsx)"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Excel Sample (.xlsx)</span>
                </button>
                <button
                  onClick={() => handleDownloadTemplate('csv')}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-xl font-bold transition-all text-xs sm:text-sm"
                  title="Download plain CSV sample (.csv)"
                >
                  <Download className="w-4 h-4" />
                  <span>Download CSV (.csv)</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-slate-400 font-medium text-xs sm:text-sm" title="Expected columns: Roll_Number, Full_Name, Department, Year, Division, Email, Phone_Number">
                <HelpCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span>Auto-detected columns</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
