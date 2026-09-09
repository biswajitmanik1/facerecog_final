import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Mail, Phone, Filter, Trash2, Edit3, GraduationCap, IdCard, Search, X, ChevronRight, LayoutDashboard, Users, RotateCcw, Save } from 'lucide-react'
import { apiFetch } from '../../lib/api.js'

const departments = ['Computer Science', 'Information Technology', 'Electronics', 'Mechanical', 'Civil', 'Electrical', 'Chemical', 'Biotechnology']
const years = ['1st Year', '2nd Year', '3rd Year', '4th Year']
const divisions = ['A', 'B', 'C', 'D']
const semesters = ['1', '2', '3', '4', '5', '6', '7', '8']

function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '??'
}

const avatarColors = [
  'bg-blue-500', 'bg-purple-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-rose-500', 'bg-teal-500', 'bg-indigo-500'
]
function getAvatarColor(id) {
  const n = (id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return avatarColors[n % avatarColors.length]
}

export default function TeacherUpdateDetails() {
  const navigate = useNavigate()
  const [student, setStudent] = useState(null)
  const [originalStudent, setOriginalStudent] = useState(null)
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [status, setStatus] = useState({ msg: '', type: '' })
  const [isAuthed, setIsAuthed] = useState(null)
  const [userType, setUserType] = useState('teacher')
  const [searchFilters, setSearchFilters] = useState({ studentId: '', department: '', year: '', division: '', studentName: '' })

  const dashboardPath = useMemo(() => {
    if (userType === 'admin') return '/admin/dashboard'
    if (userType === 'teacher') return '/teacher/dashboard'
    return '/dashboard'
  }, [userType])

  useEffect(() => {
    const checkAuthStatus = () => {
      try {
        const loggedIn = localStorage.getItem('isLoggedIn') === 'true'
        const utype = localStorage.getItem('userType') || 'student'
        if (!loggedIn || (utype !== 'teacher' && utype !== 'admin')) {
          setIsAuthed(false)
          navigate('/signin')
        } else {
          setIsAuthed(true)
          setUserType(utype)
        }
      } catch {
        setIsAuthed(false)
        navigate('/signin')
      }
    }
    const id = setTimeout(checkAuthStatus, 100)
    return () => clearTimeout(id)
  }, [navigate])

  const handleFilterChange = (e) => setSearchFilters(prev => ({ ...prev, [e.target.name]: e.target.value }))
  const clearFilters = () => {
    setSearchFilters({ studentId: '', department: '', year: '', division: '', studentName: '' })
    setSearchResults([])
    setStatus({ msg: '', type: '' })
  }

  const searchStudents = async () => {
    const hasFilters = Object.values(searchFilters).some(v => v.trim() !== '')
    if (!hasFilters) {
      setStatus({ msg: 'Please enter at least one search criterion', type: 'warn' })
      return
    }
    setSearching(true)
    setStatus({ msg: '', type: '' })
    setSearchResults([])
    try {
      const params = new URLSearchParams()
      Object.entries(searchFilters).forEach(([k, v]) => { if (v.trim()) params.append(k, v.trim()) })
      const res = await apiFetch(`/api/teacher/students/search?${params}`)
      const data = await res.json()
      if (data.success) {
        setSearchResults(data.students)
        setStatus({
          msg: data.students.length === 0 ? 'No students found matching criteria' : `Found ${data.students.length} student(s)`,
          type: data.students.length === 0 ? 'warn' : 'info'
        })
      } else {
        setStatus({ msg: data.error || 'Search failed', type: 'error' })
        setSearchResults([])
      }
    } catch {
      setStatus({ msg: 'Error connecting to server', type: 'error' })
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const selectStudent = async (sel) => {
    setLoading(true)
    setStatus({ msg: '', type: '' })
    try {
      const res = await apiFetch(`/api/teacher/student/${sel._id}`)
      const data = await res.json()
      if (data.success && data.student) {
        setStudent(data.student)
        setOriginalStudent({ ...data.student })
      } else {
        setStatus({ msg: data.error || 'Could not load student details', type: 'error' })
      }
    } catch {
      setStatus({ msg: 'Error loading student details', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    if (student) setStudent(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!student) return
    setUpdating(true)
    setStatus({ msg: 'Saving changes...', type: 'info' })
    try {
      const res = await apiFetch(`/api/teacher/student/${student._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          studentName: student.studentName,
          studentId: student.studentId,
          department: student.department,
          year: student.year,
          division: student.division,
          semester: student.semester,
          email: student.email,
          phoneNumber: student.phoneNumber
        }),
      })
      const data = await res.json()
      if (data.success) {
        setStatus({ msg: 'Student details updated successfully!', type: 'success' })
        setOriginalStudent({ ...student })
        setSearchResults(prev => prev.map(s => s._id === student._id ? student : s))
      } else {
        setStatus({ msg: data.error || 'Update failed', type: 'error' })
      }
    } catch {
      setStatus({ msg: 'Error connecting to server', type: 'error' })
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (!student) return
    if (!window.confirm(`Are you sure you want to delete student ${student.studentName} (ID: ${student.studentId})?\n\nThis action cannot be undone.`)) return
    setUpdating(true)
    setStatus({ msg: 'Deleting student...', type: 'info' })
    try {
      const res = await apiFetch(`/api/teacher/student/${student._id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setStatus({ msg: `Student ${student.studentName} deleted successfully!`, type: 'success' })
        setStudent(null)
        setOriginalStudent(null)
        setSearchResults(prev => prev.filter(s => s._id !== student._id))
      } else {
        setStatus({ msg: data.error || 'Delete failed', type: 'error' })
      }
    } catch {
      setStatus({ msg: 'Error connecting to server', type: 'error' })
    } finally {
      setUpdating(false)
    }
  }

  const resetForm = () => {
    if (originalStudent) {
      setStudent({ ...originalStudent })
      setStatus({ msg: 'Changes reset', type: 'info' })
    }
  }

  const hasChanges = () => student && originalStudent && JSON.stringify(student) !== JSON.stringify(originalStudent)

  if (isAuthed === null) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#eef2fb' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-b-4 border-blue-600 mx-auto mb-4" />
          <p className="text-xl text-gray-700 font-medium">Checking authorization...</p>
        </div>
      </div>
    )
  }
  if (isAuthed === false) return null

  const inputCls = 'w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all'
  const selectCls = 'w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-700 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all'
  const labelCls = 'block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2'

  const statusBg = {
    success: 'bg-green-50 border-green-200 text-green-700',
    error: 'bg-red-50 border-red-200 text-red-700',
    warn: 'bg-amber-50 border-amber-200 text-amber-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#eef2fb' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-emerald-600 rounded-xl shadow-sm">
              <Edit3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Teacher - Student Management</h1>
              <p className="text-base text-gray-500">Search, review, and modify student information</p>
            </div>
          </div>

          <button
            onClick={() => navigate(dashboardPath)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base font-medium transition-colors shadow-sm"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-4">
        {/* Advanced Search Filter Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2 text-gray-800 font-bold text-base">
              <Filter className="w-5 h-5 text-blue-600" />
              Advanced Student Search
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Clear Filters
              </button>
              <button
                onClick={searchStudents}
                disabled={searching}
                className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-base font-semibold rounded-xl transition-colors shadow-sm"
              >
                <Search className="w-4 h-4" />
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                name="studentId"
                placeholder="Student ID (e.g. STU001)"
                value={searchFilters.studentId}
                onChange={handleFilterChange}
                className={inputCls + ' pl-10'}
              />
            </div>

            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                name="studentName"
                placeholder="Student Name"
                value={searchFilters.studentName}
                onChange={handleFilterChange}
                className={inputCls + ' pl-10'}
              />
            </div>

            <select name="department" value={searchFilters.department} onChange={handleFilterChange} className={selectCls}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            <select name="year" value={searchFilters.year} onChange={handleFilterChange} className={selectCls}>
              <option value="">All Years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>

            <select name="division" value={searchFilters.division} onChange={handleFilterChange} className={selectCls}>
              <option value="">All Divisions</option>
              {divisions.map(d => <option key={d} value={d}>Division {d}</option>)}
            </select>
          </div>
        </div>

        {/* Status banner */}
        {status.msg && (
          <div className={`rounded-xl border px-4 py-3 text-base font-semibold ${statusBg[status.type] || statusBg.info}`}>
            {status.type === 'success' && '✅ '}{status.type === 'error' && '❌ '}{status.msg}
          </div>
        )}

        {/* Results & Form Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[500px]">
          {/* Search Results List - 5 cols */}
          <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <h2 className="font-bold text-gray-800 text-base">Search Results</h2>
              </div>
              <span className="text-sm font-semibold text-gray-500">
                {searchResults.length} {searchResults.length === 1 ? 'student' : 'students'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loading ? (
                <div className="text-center py-16">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
                  <p className="text-base text-gray-500 font-medium">Loading record...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Search className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-base font-semibold text-gray-700">No students loaded</p>
                  <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
                    Use the search bar above to filter by name, ID, or department
                  </p>
                </div>
              ) : (
                searchResults.map(s => {
                  const selected = student?._id === s._id
                  return (
                    <div
                      key={s._id}
                      onClick={() => selectStudent(s)}
                      className={`group relative flex items-center gap-3.5 p-3.5 rounded-xl cursor-pointer transition-all border ${
                        selected
                          ? 'bg-blue-50 border-blue-300 shadow-sm'
                          : 'bg-gray-50/70 border-gray-100 hover:bg-blue-50/50 hover:border-blue-200'
                      }`}
                    >
                      {/* Avatar */}
                      <div className={`flex-shrink-0 w-11 h-11 rounded-xl ${getAvatarColor(s.studentId)} flex items-center justify-center text-white font-bold text-base shadow-sm`}>
                        {getInitials(s.studentName)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className={`font-bold text-base truncate ${selected ? 'text-blue-700' : 'text-gray-800'}`}>
                          {s.studentName}
                        </div>
                        <div className="text-sm text-gray-500 truncate mt-0.5">
                          ID: {s.studentId} · {s.department}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-xs bg-gray-200/70 text-gray-700 font-medium px-2 py-0.5 rounded-md">{s.year}</span>
                          <span className="text-xs bg-gray-200/70 text-gray-700 font-medium px-2 py-0.5 rounded-md">Div {s.division}</span>
                        </div>
                      </div>

                      <ChevronRight className={`w-5 h-5 transition-colors ${selected ? 'text-blue-500' : 'text-gray-300 group-hover:text-gray-400'}`} />
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Student Edit Form - 7 cols */}
          <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-emerald-600" />
                <h2 className="font-bold text-gray-800 text-base">Student Information</h2>
              </div>
              {hasChanges() && (
                <span className="text-xs font-bold px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg">
                  Unsaved Changes
                </span>
              )}
            </div>

            {!student ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-gray-500">
                <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                  <User className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-lg font-bold text-gray-700 mb-1">No Student Selected</h3>
                <p className="text-base text-gray-500 max-w-sm">
                  Search and click on a student from the results list to view and update their profile details.
                </p>
              </div>
            ) : (
              <form onSubmit={handleUpdate} className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Active Student summary pill */}
                <div className="bg-blue-50/80 border border-blue-200/70 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-bold text-blue-900">{originalStudent?.studentName}</h4>
                    <p className="text-sm font-medium text-blue-700 mt-0.5">ID: {originalStudent?.studentId} · {originalStudent?.department}</p>
                  </div>
                  {originalStudent?.updated_at && (
                    <span className="text-xs text-blue-600 bg-white/70 px-2.5 py-1 rounded-md border border-blue-100">
                      Updated: {new Date(originalStudent.updated_at * 1000).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Personal Information */}
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                    <User className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Personal Information</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Full Name</label>
                      <input
                        name="studentName"
                        type="text"
                        value={student.studentName || ''}
                        onChange={handleInputChange}
                        required
                        className={inputCls}
                        placeholder="Student Full Name"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Student ID</label>
                      <input
                        name="studentId"
                        type="text"
                        value={student.studentId || ''}
                        onChange={handleInputChange}
                        required
                        className={inputCls}
                        placeholder="e.g. STU001"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Email Address</label>
                      <input
                        name="email"
                        type="email"
                        value={student.email || ''}
                        onChange={handleInputChange}
                        required
                        className={inputCls}
                        placeholder="name@college.edu"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Phone Number</label>
                      <input
                        name="phoneNumber"
                        type="tel"
                        value={student.phoneNumber || ''}
                        onChange={handleInputChange}
                        className={inputCls}
                        placeholder="e.g. 9876543210"
                      />
                    </div>
                  </div>
                </div>

                {/* Academic Information */}
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                    <GraduationCap className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Academic Information</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Department</label>
                      <select name="department" value={student.department || ''} onChange={handleInputChange} required className={selectCls}>
                        <option value="">Select Department</option>
                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Year</label>
                      <select name="year" value={student.year || ''} onChange={handleInputChange} required className={selectCls}>
                        <option value="">Select Year</option>
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Division</label>
                      <select name="division" value={student.division || ''} onChange={handleInputChange} required className={selectCls}>
                        <option value="">Select Division</option>
                        {divisions.map(d => <option key={d} value={d}>Division {d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Semester</label>
                      <select name="semester" value={student.semester || ''} onChange={handleInputChange} required className={selectCls}>
                        <option value="">Select Semester</option>
                        {semesters.map(s => <option key={s} value={s}>Semester {s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="submit"
                    disabled={updating || !hasChanges()}
                    className="flex-1 py-3.5 px-5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-base font-bold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {updating ? 'Saving...' : 'Save Changes'}
                  </button>

                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={!hasChanges()}
                    className="py-3.5 px-5 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 text-base font-semibold rounded-xl transition-colors flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" /> Reset
                  </button>

                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={updating}
                    className="py-3.5 px-5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-base font-semibold rounded-xl transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
