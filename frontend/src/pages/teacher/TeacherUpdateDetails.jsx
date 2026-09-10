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
  const utype = localStorage.getItem('userType') || 'teacher'
  const teacherDept = utype === 'teacher' ? (localStorage.getItem('department') || '') : ''

  const [student, setStudent] = useState(null)
  const [originalStudent, setOriginalStudent] = useState(null)
  const [searchResults, setSearchResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [status, setStatus] = useState({ msg: '', type: '' })
  const [isAuthed, setIsAuthed] = useState(null)
  const [userType, setUserType] = useState(utype)
  const [searchFilters, setSearchFilters] = useState({ 
    studentId: '', 
    department: teacherDept || '', 
    year: '', 
    division: '', 
    studentName: '' 
  })

  const dashboardPath = useMemo(() => {
    if (userType === 'admin') return '/admin/dashboard'
    if (userType === 'teacher') return '/teacher/dashboard'
    return '/dashboard'
  }, [userType])

  useEffect(() => {
    const checkAuthStatus = () => {
      try {
        const loggedIn = localStorage.getItem('isLoggedIn') === 'true'
        const currentType = localStorage.getItem('userType') || 'student'
        if (!loggedIn || (currentType !== 'teacher' && currentType !== 'admin')) {
          setIsAuthed(false)
          navigate('/signin')
        } else {
          setIsAuthed(true)
          setUserType(currentType)
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
    setSearchFilters({ 
      studentId: '', 
      department: teacherDept || '', 
      year: '', 
      division: '', 
      studentName: '' 
    })
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
      const activeFilters = { ...searchFilters }
      if (teacherDept) activeFilters.department = teacherDept
      const params = new URLSearchParams()
      Object.entries(activeFilters).forEach(([k, v]) => { if (v.trim()) params.append(k, v.trim()) })
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

  const inputCls = 'w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 rounded-2xl px-4 py-2.5 text-slate-900 text-sm font-medium focus:outline-none transition-all duration-200 ease-out placeholder:text-slate-400 shadow-xs'
  const selectCls = 'w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 rounded-2xl px-4 py-2.5 text-slate-900 text-sm font-medium focus:outline-none transition-all duration-200 ease-out shadow-xs cursor-pointer'
  const labelCls = 'block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5'

  const statusBg = {
    success: 'bg-green-50 border-green-200 text-green-700',
    error: 'bg-red-50 border-red-200 text-red-700',
    warn: 'bg-amber-50 border-amber-200 text-amber-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-xs flex-shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-emerald-600 rounded-2xl shadow-xs transition-transform duration-200 hover:scale-105">
              <Edit3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">Teacher - Student Management</h1>
              <p className="text-sm font-medium text-slate-500">Search, review, and modify student information</p>
            </div>
          </div>

          <button
            onClick={() => navigate(dashboardPath)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.97] text-white rounded-2xl text-sm font-bold transition-all duration-200 ease-out shadow-xs hover:shadow-md"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-5">
        {/* Advanced Search Filter Card */}
        <div className="bg-white rounded-3xl shadow-sm hover:shadow-md border border-slate-200/90 p-5 transition-all duration-300">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-black text-slate-900">Search & Filter Students</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 active:scale-[0.97] border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-xs hover:shadow-sm transition-all duration-200 ease-out"
              >
                <X className="w-3.5 h-3.5" /> Clear Filters
              </button>
              <button
                onClick={searchStudents}
                disabled={searching}
                className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.97] disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all duration-200 ease-out shadow-xs hover:shadow-md"
              >
                <Search className="w-4 h-4" />
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                name="studentName"
                placeholder="Student Name"
                value={searchFilters.studentName}
                onChange={handleFilterChange}
                className={inputCls + ' pl-10'}
              />
            </div>

            {teacherDept ? (
              <div className="flex items-center justify-between bg-blue-50/80 border border-blue-300 rounded-2xl px-3.5 py-2 text-blue-950 text-sm font-bold shadow-xs transition-all duration-200">
                <span className="truncate font-bold">{teacherDept}</span>
                <span className="text-[10px] bg-blue-600 text-white font-extrabold px-2 py-0.5 rounded-lg uppercase tracking-wider ml-1.5 shrink-0 shadow-2xs">Locked</span>
              </div>
            ) : (
              <select name="department" value={searchFilters.department} onChange={handleFilterChange} className={selectCls}>
                <option value="">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}

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
          <div className={`rounded-2xl border px-4 py-3 text-base font-semibold shadow-xs animate-fade-in transition-all duration-300 ${statusBg[status.type] || statusBg.info}`}>
            {status.type === 'success' && '✅ '}{status.type === 'error' && '❌ '}{status.msg}
          </div>
        )}

        {/* Results & Form Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[500px]">
          {/* Search Results List - 5 cols */}
          <div className="lg:col-span-5 bg-white rounded-3xl shadow-sm hover:shadow-md border border-slate-200/90 flex flex-col overflow-hidden transition-all duration-300">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <h2 className="font-bold text-slate-900 text-base">Search Results</h2>
              </div>
              <span className="text-xs bg-slate-200/70 text-slate-800 font-bold px-2 py-0.5 rounded-lg">
                {searchResults.length} {searchResults.length === 1 ? 'student' : 'students'}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
              {loading ? (
                <div className="text-center py-16">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-600 font-semibold">Loading records...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-16 text-slate-500 bg-slate-50/70 m-2 rounded-2xl border-2 border-dashed border-slate-200 animate-fade-in">
                  <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
                    <Search className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">No students loaded</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
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
                      className={`group relative flex items-center gap-3.5 p-3.5 rounded-2xl cursor-pointer transition-all duration-200 ease-out border ${
                        selected
                          ? 'bg-blue-50/95 border-blue-500 shadow-md ring-2 ring-blue-500/20 translate-x-0.5'
                          : 'bg-white border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]'
                      }`}
                    >
                      {/* Avatar */}
                      <div className={`flex-shrink-0 w-11 h-11 rounded-2xl ${getAvatarColor(s.studentId)} flex items-center justify-center text-white font-black text-sm shadow-xs transition-transform duration-200 group-hover:scale-105`}>
                        {getInitials(s.studentName)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className={`font-bold text-base truncate transition-colors duration-150 ${selected ? 'text-blue-900' : 'text-slate-900 group-hover:text-blue-600'}`}>
                          {s.studentName}
                        </div>
                        <div className="text-sm font-semibold text-slate-600 truncate mt-0.5">
                          <span className="font-bold text-slate-800">{s.studentId}</span> • <span>{s.department}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs bg-slate-100 border border-slate-200 text-slate-800 px-2.5 py-0.5 rounded-lg font-bold shadow-2xs">{s.year}</span>
                          <span className="text-xs bg-slate-100 border border-slate-200 text-slate-800 px-2.5 py-0.5 rounded-lg font-bold shadow-2xs">Div {s.division}</span>
                        </div>
                      </div>

                      <ChevronRight className={`w-5 h-5 transition-all duration-200 ${selected ? 'text-blue-600 translate-x-0.5' : 'text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5'}`} />
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Student Edit Form - 7 cols */}
          <div className="lg:col-span-7 bg-white rounded-3xl shadow-sm hover:shadow-md border border-slate-200/90 flex flex-col overflow-hidden transition-all duration-300">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-emerald-600" />
                <h2 className="font-bold text-slate-900 text-base">Student Information</h2>
              </div>
              {hasChanges() && (
                <span className="text-xs font-bold px-2.5 py-1 bg-amber-50 border border-amber-300 text-amber-800 rounded-xl animate-scale-in">
                  Unsaved Changes
                </span>
              )}
            </div>

            {!student ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 m-5 bg-slate-50/70 rounded-3xl border-2 border-dashed border-slate-200 animate-fade-in">
                <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mb-4 shadow-xs">
                  <User className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-base font-bold text-slate-800 mb-1">No Student Selected</h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  Search and click on a student from the results list to view and update their profile details.
                </p>
              </div>
            ) : (
              <form onSubmit={handleUpdate} key={student._id} className="flex-1 overflow-y-auto p-6 space-y-6 animate-fade-in">
                {/* Active Student summary pill */}
                <div className="bg-blue-50/80 border border-blue-200/70 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-bold text-blue-900">{originalStudent?.studentName}</h4>
                    <p className="text-sm font-medium text-blue-700 mt-0.5">ID: {originalStudent?.studentId} • {originalStudent?.department}</p>
                  </div>
                  {originalStudent?.updated_at && (
                    <span className="text-xs text-blue-600 bg-white/80 px-2.5 py-1 rounded-lg border border-blue-100 shadow-2xs">
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
                      <div className="flex items-center justify-between mb-1.5">
                        <label className={labelCls}>Department</label>
                        {userType === 'teacher' && (
                          <span className="text-xs text-gray-400 font-medium">🔒 Read-only</span>
                        )}
                      </div>
                      {userType === 'teacher' ? (
                        <div className="w-full bg-slate-100/90 border border-slate-300 rounded-2xl px-4 py-3 text-slate-700 text-base font-medium">
                          {student.department || 'Not specified'}
                        </div>
                      ) : (
                        <select name="department" value={student.department || ''} onChange={handleInputChange} required className={selectCls}>
                          <option value="">Select Department</option>
                          {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      )}
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
                    className="flex-1 py-3.5 px-5 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white text-base font-bold rounded-2xl transition-all duration-200 ease-out shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {updating ? 'Saving...' : 'Save Changes'}
                  </button>

                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={!hasChanges()}
                    className="py-3.5 px-5 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 text-base font-semibold rounded-2xl transition-all duration-200 ease-out flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" /> Reset
                  </button>

                  {userType === 'admin' && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={updating}
                      className="py-3.5 px-5 bg-red-50 hover:bg-red-100 active:scale-[0.98] border border-red-200 text-red-600 text-base font-semibold rounded-2xl transition-all duration-200 ease-out flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
