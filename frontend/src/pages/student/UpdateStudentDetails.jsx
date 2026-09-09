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
      setUserType(utype)
      setUserEmail(email)
      if (!loggedIn || !email) { setIsAuthed(false); navigate('/signin'); return }
      setIsAuthed(true)
      fetchStudents(email, utype)
    } catch { setIsAuthed(false); navigate('/signin') }
  }, [navigate])

  useEffect(() => {
    if (isStaff && allStudents.length > 0) {
      let filtered = allStudents
      if (filters.department) filtered = filtered.filter(s => s.department === filters.department)
      if (filters.year) filtered = filtered.filter(s => s.year === filters.year)
      if (filters.division) filtered = filtered.filter(s => s.division === filters.division)
      if (filters.studentId) filtered = filtered.filter(s => s.studentId?.toLowerCase().includes(filters.studentId.toLowerCase()))
      if (filters.search) filtered = filtered.filter(s =>
        s.studentName?.toLowerCase().includes(filters.search.toLowerCase()) ||
        s.email?.toLowerCase().includes(filters.search.toLowerCase())
      )
      setStudents(filtered)
    }
  }, [filters, allStudents, isStaff])

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
  const clearFilters = () => setFilters({ department: '', year: '', division: '', studentId: '', search: '' })
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

  const inputCls = 'w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all'
  const selectCls = 'w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-700 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all'
  const labelCls = 'block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#eef2fb' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl">
              <Edit3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                {isStaff ? 'Manage Student Details' : 'Update Student Details'}
              </h1>
              <p className="text-base text-gray-500">
                {isStaff ? 'View and update student information' : 'Update your student information'}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(dashboardPath)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base font-medium transition-colors shadow-sm"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full flex flex-col gap-4">

          {/* Filter Bar â€” staff only */}
          {isStaff && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-gray-700 font-semibold text-base">
                  <Filter className="w-4 h-4 text-blue-500" />
                  Filter Students
                </div>
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  <X className="w-3 h-3" /> Clear All Filters
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <select name="department" value={filters.department} onChange={handleFilterChange} className={selectCls}>
                  <option value="">All Departments</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select name="year" value={filters.year} onChange={handleFilterChange} className={selectCls}>
                  <option value="">All Years</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select name="division" value={filters.division} onChange={handleFilterChange} className={selectCls}>
                  <option value="">All Divisions</option>
                  {divisions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input name="studentId" placeholder="Student ID" value={filters.studentId} onChange={handleFilterChange}
                    className={inputCls + ' pl-9'} />
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input name="search" placeholder="Search by name or email" value={filters.search} onChange={handleFilterChange}
                    className={inputCls + ' pl-9'} />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-sm text-gray-500">
                <Users className="w-3.5 h-3.5 text-green-500" />
                Showing <span className="font-semibold text-gray-700">{students.length}</span> of <span className="font-semibold text-gray-700">{allStudents.length}</span> students
              </div>
            </div>
          )}

          {/* Status bar */}
          {status.msg && (
            <div className={`rounded-xl border px-4 py-3 text-sm font-medium flex-shrink-0 ${statusBg[status.type] || statusBg.info}`}>
              {status.type === 'success' && 'âœ… '}{status.type === 'error' && 'âŒ '}{status.msg}
            </div>
          )}

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">

            {/* Student List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <h2 className="font-semibold text-gray-800 text-base">
                  {isStaff ? 'Students' : 'Student Record'}
                </h2>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">Loading records...</p>
                  </div>
                ) : students.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">ðŸ“š</div>
                    <p className="text-gray-500 text-sm mb-4">
                      {isStaff ? 'No students found with current filters.' : 'No student record found for your email.'}
                    </p>
                    {userType === 'student' && (
                      <button onClick={() => navigate('/student/registrationform')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 transition-colors">
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
                        className={`group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                          selected
                            ? 'bg-blue-50 border-blue-300 shadow-sm'
                            : 'bg-gray-50 border-gray-100 hover:bg-blue-50/50 hover:border-blue-200'
                        }`}
                      >
                        {/* Avatar */}
                        <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${getAvatarColor(student.studentId)} flex items-center justify-center text-white font-bold text-sm`}>
                          {getInitials(student.studentName)}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className={`font-semibold text-base truncate ${selected ? 'text-blue-700' : 'text-gray-800'}`}>
                            {student.studentName}
                          </div>
                          <div className="text-base text-gray-500 truncate">
                            {student.studentId} Â· {student.department}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium">{student.year}</span>
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium">Div {student.division}</span>
                          </div>
                        </div>

                        {/* Arrow / Delete */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {(isStaff || (userType === 'student' && student.email === userEmail)) && (
                            <button
                              onClick={e => { e.stopPropagation(); handleDelete(student._id, student.studentName) }}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <ChevronRight className={`w-4 h-4 transition-colors ${selected ? 'text-blue-400' : 'text-gray-300 group-hover:text-gray-400'}`} />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Edit Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-600" />
                <h2 className="font-semibold text-gray-800 text-base">Update Student Details</h2>
              </div>

              {selectedStudent ? (
                <form onSubmit={handleUpdate} className="flex-1 overflow-y-auto p-5 space-y-5">

                  {/* Personal Info */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <User className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Personal Information</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className={labelCls}>Full Name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input name="studentName" type="text" value={selectedStudent.studentName || ''} onChange={handleInputChange} required
                            className={inputCls + ' pl-10'} placeholder="Full name" />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Student ID</label>
                        <div className="relative">
                          <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input name="studentId" type="text" value={selectedStudent.studentId || ''} onChange={handleInputChange} required
                            className={inputCls + ' pl-10'} placeholder="Student ID" />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Email</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input name="email" type="email" value={selectedStudent.email || ''} onChange={handleInputChange}
                            disabled={userType === 'student'}
                            className={inputCls + ' pl-10 ' + (userType === 'student' ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : '')}
                            placeholder="Email address" />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Phone Number</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input name="phoneNumber" type="tel" value={selectedStudent.phoneNumber || ''} onChange={handleInputChange}
                            className={inputCls + ' pl-10'} placeholder="Phone number" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Academic Info */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <GraduationCap className="w-4 h-4 text-purple-500" />
                      <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Academic Information</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Department</label>
                        <select name="department" value={selectedStudent.department || ''} onChange={handleInputChange} required className={selectCls}>
                          <option value="">Select</option>
                          {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
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
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm">
                    {updating ? 'Saving...' : isStaff ? 'Save Changes' : 'Update My Details'}
                  </button>
                </form>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                    <Edit3 className="w-7 h-7 text-gray-300" />
                  </div>
                  <p className="text-gray-500 text-sm font-medium">
                    {students.length > 0
                      ? 'Select a student from the list to edit their details'
                      : 'No student record available to edit'}
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
