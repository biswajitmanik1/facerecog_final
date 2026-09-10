import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Mail, Phone, Filter, Trash2, Edit3, GraduationCap, IdCard, Search, X, ChevronRight, LayoutDashboard, Users } from 'lucide-react'
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

export default function UpdateStudentDetails() {
  const navigate = useNavigate()
  const [students, setStudents] = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [status, setStatus] = useState({ msg: '', type: '' })
  const [isAuthed, setIsAuthed] = useState(null)
  const [userType, setUserType] = useState('student')
  const [userEmail, setUserEmail] = useState('')
  const [teacherDept, setTeacherDept] = useState('')
  const isStaff = userType === 'teacher' || userType === 'admin'
  const [filters, setFilters] = useState({ department: '', year: '', division: '', studentId: '', search: '' })

  const dashboardPath = useMemo(() => {
    if (userType === 'admin') return '/admin/dashboard'
    if (userType === 'teacher') return '/teacher/dashboard'
    return '/dashboard'
  }, [userType])

  useEffect(() => {
    try {
      const loggedIn = localStorage.getItem('isLoggedIn') === 'true'
      const email = localStorage.getItem('userEmail') || ''
      const utype = localStorage.getItem('userType') || 'student'
      const dept = utype === 'teacher' ? (localStorage.getItem('department') || '') : ''
      setUserType(utype)
      setUserEmail(email)
      setTeacherDept(dept)
      if (dept) {
        setFilters(prev => ({ ...prev, department: dept }))
      }
      if (!loggedIn || !email) { setIsAuthed(false); navigate('/signin'); return }
      setIsAuthed(true)
      fetchStudents(email, utype)
    } catch { setIsAuthed(false); navigate('/signin') }
  }, [navigate])

  useEffect(() => {
    if (isStaff && allStudents.length > 0) {
      let filtered = allStudents
      const activeDept = teacherDept || filters.department
      if (activeDept) filtered = filtered.filter(s => s.department === activeDept)
      if (filters.year) filtered = filtered.filter(s => s.year === filters.year)
      if (filters.division) filtered = filtered.filter(s => s.division === filters.division)
      if (filters.studentId) filtered = filtered.filter(s => s.studentId?.toLowerCase().includes(filters.studentId.toLowerCase()))
      if (filters.search) filtered = filtered.filter(s =>
        s.studentName?.toLowerCase().includes(filters.search.toLowerCase()) ||
        s.email?.toLowerCase().includes(filters.search.toLowerCase())
      )
      setStudents(filtered)
    }
  }, [filters, allStudents, isStaff, teacherDept])

  const fetchStudents = async (email, type) => {
    try {
      const url = type === 'student' ? '/api/students' : '/api/admin/students'
      const res = await apiFetch(url)
      const data = await res.json()
      if (data.success) {
        setStudents(data.students)
        if (type !== 'student') setAllStudents(data.students)
        if (data.students.length === 0 && type === 'student')
          setStatus({ msg: 'No student record found for your email. Please register first.', type: 'warn' })
      } else setStatus({ msg: data.error || 'Error fetching student records', type: 'error' })
    } catch { setStatus({ msg: 'Error connecting to server', type: 'error' }) }
    finally { setLoading(false) }
  }

  const handleFilterChange = e => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }))
  const clearFilters = () => setFilters({ department: teacherDept || '', year: '', division: '', studentId: '', search: '' })
  const handleStudentSelect = student => { setSelectedStudent({ ...student }); setStatus({ msg: '', type: '' }) }
  const handleInputChange = e => {
    if (selectedStudent) setSelectedStudent(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleUpdate = async e => {
    e.preventDefault()
    if (!selectedStudent) return
    setUpdating(true)
    setStatus({ msg: 'Saving changes...', type: 'info' })
    try {
      const res = await apiFetch(`/api/students/${selectedStudent._id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...selectedStudent, user_email: userEmail }),
      })
      const data = await res.json()
      if (data.success) {
        setStatus({ msg: `Student details updated successfully!`, type: 'success' })
        fetchStudents(userEmail, userType)
      } else {
        setStatus({ msg: res.status === 403 ? 'Unauthorized: You can only update permitted records' : data.error, type: 'error' })
      }
    } catch { setStatus({ msg: 'Error connecting to server', type: 'error' }) }
    finally { setUpdating(false) }
  }

  const handleDelete = async (studentId, studentName) => {
    if (!confirm(`Delete ${studentName}? This cannot be undone.`)) return
    try {
      const res = await apiFetch(`/api/students/${studentId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setStatus({ msg: `${studentName} deleted successfully.`, type: 'success' })
        fetchStudents(userEmail, userType)
        if (selectedStudent?._id === studentId) setSelectedStudent(null)
      } else setStatus({ msg: res.status === 403 ? 'Unauthorized' : data.error, type: 'error' })
    } catch { setStatus({ msg: 'Error connecting to server', type: 'error' }) }
  }

  if (isAuthed === null) return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: '#eef2fb' }}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-3" />
        <p className="text-gray-600 font-medium text-base">Loading...</p>
      </div>
    </div>
  )
  if (isAuthed === false) return null

  const statusBg = {
    success: 'bg-green-50 border-green-200 text-green-700',
    error: 'bg-red-50 border-red-200 text-red-700',
    warn: 'bg-amber-50 border-amber-200 text-amber-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
  }

  const inputCls = 'w-full bg-white border-2 border-slate-300 hover:border-slate-400 focus:border-blue-600 rounded-2xl px-4 py-2.5 text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400 shadow-xs'
  const selectCls = 'w-full bg-white border-2 border-slate-300 hover:border-slate-400 focus:border-blue-600 rounded-2xl px-4 py-2.5 text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all shadow-xs cursor-pointer'
  const labelCls = 'block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5'

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b-2 border-slate-200 shadow-xs flex-shrink-0">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-2xl shadow-xs">
              <Edit3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">
                {isStaff ? 'Manage Student Details' : 'Update Student Details'}
              </h1>
              <p className="text-sm font-medium text-slate-500">
                {isStaff ? 'View and update student information' : 'Update your student information'}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(dashboardPath)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold transition-colors shadow-xs"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full flex flex-col gap-5">

          {/* Filter Bar — staff only */}
          {isStaff && (
            <div className="bg-white rounded-3xl shadow-md border-2 border-slate-300 p-5 flex-shrink-0">
              <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b-2 border-slate-100">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                  <Filter className="w-4 h-4 text-blue-600" />
                  Filter Students
                </div>
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Clear All Filters
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {teacherDept ? (
                  <div className="flex items-center justify-between bg-blue-50 border-2 border-blue-400 rounded-2xl px-3.5 py-2 text-blue-950 text-sm font-bold shadow-xs">
                    <span className="truncate">{teacherDept}</span>
                    <span className="text-[10px] bg-blue-600 text-white font-extrabold px-2 py-0.5 rounded-lg uppercase tracking-wider ml-1.5 shrink-0">Locked</span>
                  </div>
                ) : (
                  <select name="department" value={filters.department} onChange={handleFilterChange} className={selectCls}>
                    <option value="">All Departments</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                )}
                <select name="year" value={filters.year} onChange={handleFilterChange} className={selectCls}>
                  <option value="">All Years</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select name="division" value={filters.division} onChange={handleFilterChange} className={selectCls}>
                  <option value="">All Divisions</option>
                  {divisions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input name="studentId" placeholder="Student ID" value={filters.studentId} onChange={handleFilterChange}
                    className={inputCls + ' pl-10'} />
                </div>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input name="search" placeholder="Search by name or email" value={filters.search} onChange={handleFilterChange}
                    className={inputCls + ' pl-10'} />
                </div>
              </div>
              <div className="mt-3.5 flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-xl w-fit">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>Showing <strong className="text-slate-900 font-bold">{students.length}</strong> of <strong className="text-slate-900 font-bold">{allStudents.length}</strong> students</span>
              </div>
            </div>
          )}

          {/* Status bar */}
          {status.msg && (
            <div className={`rounded-2xl border-2 px-4 py-3 text-sm font-bold flex-shrink-0 shadow-xs ${statusBg[status.type] || statusBg.info}`}>
              {status.type === 'success' && '✅ '}{status.type === 'error' && '❌ '}{status.msg}
            </div>
          )}

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">

            {/* Student List */}
            <div className="bg-white rounded-3xl shadow-md border-2 border-slate-300 flex flex-col overflow-hidden">
              <div className="px-5 py-3.5 border-b-2 border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span>{isStaff ? 'Students' : 'Student Record'}</span>
                </div>
                <span className="text-xs bg-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded-lg">
                  {students.length} Total
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
                    <p className="text-slate-600 font-semibold text-sm">Loading records...</p>
                  </div>
                ) : students.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 m-2">
                    <div className="text-4xl mb-2">📚</div>
                    <p className="text-slate-700 font-bold text-sm mb-3">
                      {isStaff ? 'No students found with current filters.' : 'No student record found for your email.'}
                    </p>
                    {userType === 'student' && (
                      <button onClick={() => navigate('/student/registrationform')}
                        className="px-4 py-2 bg-blue-600 text-white font-bold rounded-2xl text-xs hover:bg-blue-700 shadow-sm transition-colors">
                        Register as Student
                      </button>
                    )}
                  </div>
                ) : (
                  students.map(student => {
                    const selected = selectedStudent?._id === student._id
                    return (
                      <div
                        key={student._id}
                        onClick={() => handleStudentSelect(student)}
                        className={`group relative flex items-center gap-3.5 p-3.5 rounded-2xl cursor-pointer transition-all border-2 ${
                          selected
                            ? 'bg-blue-50/90 border-blue-600 shadow-md ring-2 ring-blue-200'
                            : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 hover:shadow-sm'
                        }`}
                      >
                        {/* Avatar */}
                        <div className={`flex-shrink-0 w-11 h-11 rounded-2xl ${getAvatarColor(student.studentId)} flex items-center justify-center text-white font-black text-sm shadow-xs`}>
                          {getInitials(student.studentName)}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className={`font-bold text-base truncate ${selected ? 'text-blue-900' : 'text-slate-900'}`}>
                            {student.studentName}
                          </div>
                          <div className="text-sm font-semibold text-slate-600 truncate mt-0.5">
                            <span className="font-bold text-slate-800">{student.studentId}</span> • <span>{student.department}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs bg-slate-100 border border-slate-300 text-slate-800 px-2.5 py-0.5 rounded-lg font-bold shadow-2xs">{student.year}</span>
                            <span className="text-xs bg-slate-100 border border-slate-300 text-slate-800 px-2.5 py-0.5 rounded-lg font-bold shadow-2xs">Div {student.division}</span>
                          </div>
                        </div>

                        {/* Arrow / Delete */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {((userType === 'admin') || (userType === 'student' && student.email === userEmail)) && (
                            <button
                              onClick={e => { e.stopPropagation(); handleDelete(student._id, student.studentName) }}
                              className="p-2 rounded-xl text-red-500 hover:bg-red-100 hover:text-red-700 transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <ChevronRight className={`w-5 h-5 transition-colors ${selected ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Edit Form */}
            <div className="bg-white rounded-3xl shadow-md border-2 border-slate-300 flex flex-col overflow-hidden">
              <div className="px-5 py-3.5 border-b-2 border-slate-200 bg-slate-50 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-emerald-600" />
                <h2 className="font-bold text-slate-900 text-base">Update Student Details</h2>
              </div>

              {selectedStudent ? (
                <form onSubmit={handleUpdate} className="flex-1 overflow-y-auto p-5 space-y-5">

                  {/* Personal Info */}
                  <div>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-slate-100">
                      <User className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Personal Information</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3.5">
                      <div>
                        <label className={labelCls}>Full Name</label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input name="studentName" type="text" value={selectedStudent.studentName || ''} onChange={handleInputChange} required
                            className={inputCls + ' pl-10'} placeholder="Full name" />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Student ID</label>
                        <div className="relative">
                          <IdCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input name="studentId" type="text" value={selectedStudent.studentId || ''} onChange={handleInputChange} required
                            className={inputCls + ' pl-10'} placeholder="Student ID" />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Email</label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input name="email" type="email" value={selectedStudent.email || ''} onChange={handleInputChange}
                            disabled={userType === 'student'}
                            className={inputCls + ' pl-10 ' + (userType === 'student' ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : '')}
                            placeholder="Email address" />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Phone Number</label>
                        <div className="relative">
                          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input name="phoneNumber" type="tel" value={selectedStudent.phoneNumber || ''} onChange={handleInputChange}
                            className={inputCls + ' pl-10'} placeholder="Phone number" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Academic Info */}
                  <div>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-slate-100">
                      <GraduationCap className="w-4 h-4 text-purple-600" />
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Academic Information</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className={labelCls}>Department</label>
                          {userType === 'teacher' && (
                            <span className="text-xs text-slate-500 font-bold">🔒 Read-only</span>
                          )}
                        </div>
                        {userType === 'teacher' ? (
                          <div className="w-full bg-slate-100 border-2 border-slate-300 rounded-2xl px-4 py-2.5 text-slate-900 text-sm font-bold shadow-xs">
                            {selectedStudent.department || 'Not specified'}
                          </div>
                        ) : (
                          <select name="department" value={selectedStudent.department || ''} onChange={handleInputChange} required className={selectCls}>
                            <option value="">Select</option>
                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        )}
                      </div>
                      <div>
                        <label className={labelCls}>Year</label>
                        <select name="year" value={selectedStudent.year || ''} onChange={handleInputChange} required className={selectCls}>
                          <option value="">Select</option>
                          {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Division</label>
                        <select name="division" value={selectedStudent.division || ''} onChange={handleInputChange} required className={selectCls}>
                          <option value="">Select</option>
                          {divisions.map(d => <option key={d} value={d}>Division {d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Semester</label>
                        <select name="semester" value={selectedStudent.semester || ''} onChange={handleInputChange} required className={selectCls}>
                          <option value="">Select</option>
                          {semesters.map(s => <option key={s} value={s}>Semester {s}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <button type="submit" disabled={updating}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-sm">
                    {updating ? 'Saving...' : isStaff ? 'Save Changes' : 'Update My Details'}
                  </button>
                </form>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 m-5 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-300">
                  <div className="w-16 h-16 bg-white border-2 border-slate-200 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                    <Edit3 className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-800 text-sm font-bold">
                    {students.length > 0
                      ? 'Select a student from the list to edit their details'
                      : 'No student record available to edit'}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">Click any student card on the left</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
