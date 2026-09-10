import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, Search, Download, LayoutDashboard, Calendar, Users, CheckCircle2, XCircle, TrendingUp, AlertTriangle } from 'lucide-react'
import { apiFetch } from '../../lib/api.js'

export default function ViewAttendance() {
  const navigate = useNavigate()
  const utype = localStorage.getItem('userType')
  const teacherDept = utype === 'teacher' ? (localStorage.getItem('department') || '') : ''

  const [attendanceData, setAttendanceData] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [filterDepartment, setFilterDepartment] = useState(teacherDept || '')
  const [filterYear, setFilterYear] = useState('')
  const [filterDivision, setFilterDivision] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterStudentId, setFilterStudentId] = useState(() => {
    if (utype === 'student') {
      return localStorage.getItem('studentId') || localStorage.getItem('username') || ''
    }
    return ''
  })
  const [stats, setStats] = useState({ totalStudents: 0, presentToday: 0, absentToday: 0, attendanceRate: 0 })
  const [searched, setSearched] = useState(false)

  const dashboardPath = useMemo(() => {
    if (utype === 'admin') return '/admin/dashboard'
    if (utype === 'teacher') return '/teacher/dashboard'
    return '/dashboard'
  }, [utype])

  useEffect(() => {
    if (filterStudentId) {
      fetchAttendanceData()
    }
  }, [])

  const fetchAttendanceData = async () => {
    const activeDept = teacherDept || filterDepartment
    if (!selectedDate && !activeDept && !filterStudentId) {
      alert('Please select a date, department, or student ID to filter.')
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedDate) params.set('date', selectedDate)
      if (activeDept) params.set('department', activeDept)
      if (filterYear) params.set('year', filterYear)
      if (filterDivision) params.set('division', filterDivision)
      if (filterSubject) params.set('subject', filterSubject)
      if (filterStudentId) params.set('student_id', filterStudentId)
      const res = await apiFetch(`/api/attendance?${params.toString()}`)
      const raw = await res.text()
      let data
      try {
        data = JSON.parse(raw)
      } catch (err) {
        console.error('Failed to parse response', err)
        throw err
      }
      if (data && data.success) {
        const mappedData = data.attendance.map((record, idx) => ({
          _id: record.sessionId ? `${record.sessionId}-${record.studentId || idx}` : (record.studentId || `row-${idx}`),
          sessionId: record.sessionId || '',
          studentId: record.studentId || record.student_id || '-',
          studentName: record.studentName || record.student_name || '-',
          subject: record.subject || filterSubject || '—',
          department: record.department || activeDept || '—',
          year: record.year || filterYear || '—',
          division: record.division || filterDivision || '—',
          date: record.date || data.date || selectedDate,
          time: record.markedAt || record.time || '—',
          status: record.status || 'present',
          confidence: record.confidence || (record.status === 'present' ? 95 : 0),
        }))
        setAttendanceData(mappedData)
        setStats(data.stats || { totalStudents: 0, presentToday: 0, absentToday: 0, attendanceRate: 0 })
      } else if (data && data.error) {
        alert(data.error)
      }
      setSearched(true)
    } catch (error) {
      console.error('Error fetching attendance:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportExcel = async () => {
    try {
      const activeDept = teacherDept || filterDepartment
      const params = new URLSearchParams()
      if (selectedDate) params.set('date', selectedDate)
      if (activeDept) params.set('department', activeDept)
      if (filterYear) params.set('year', filterYear)
      if (filterDivision) params.set('division', filterDivision)
      if (filterSubject) params.set('subject', filterSubject)
      const res = await apiFetch(`/api/attendance/export?${params.toString()}`)
      const raw = await res.text()
      let data
      try {
        data = JSON.parse(raw)
      } catch (err) {
        console.error('Failed to parse export', err)
        throw err
      }
      if (data && data.success) {
        const XLSX = await import('xlsx')
        const worksheet = XLSX.utils.json_to_sheet(data.data)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance')
        XLSX.writeFile(workbook, `attendance_${activeDept || 'dept'}_${selectedDate || 'export'}.xlsx`)
      } else if (data && data.error) {
        alert(data.error)
      }
    } catch (error) {
      console.error('Error exporting excel:', error)
    }
  }

  const inputCls = 'w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all'
  const selectCls = 'w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-700 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all'
  const labelCls = 'block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#eef2fb' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-sky-600 rounded-xl shadow-sm">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Attendance Records</h1>
              <p className="text-base text-gray-500">Query, inspect, and export student attendance logs</p>
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

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        {/* Filters Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <Search className="w-5 h-5 text-sky-600" />
            <h2 className="text-lg font-bold text-gray-800">Filter Records</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div>
              <label className={labelCls}>Select Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelCls}>Department</label>
                {teacherDept && (
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                    Assigned
                  </span>
                )}
              </div>
              {teacherDept ? (
                <div className="flex items-center justify-between bg-blue-50/80 border border-blue-300 rounded-xl px-4 py-3 text-blue-950 text-base font-bold shadow-xs transition-all duration-200">
                  <span className="truncate font-bold">{teacherDept}</span>
                  <span className="text-xs bg-blue-600 text-white font-extrabold px-2 py-0.5 rounded-lg uppercase tracking-wider ml-1.5 shrink-0 shadow-2xs">
                    Locked
                  </span>
                </div>
              ) : (
                <select value={filterDepartment} onChange={e => setFilterDepartment(e.target.value)} className={selectCls}>
                  <option value="">All Departments</option>
                  {['Computer Science', 'Information Technology', 'Electronics', 'Mechanical', 'Civil'].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className={labelCls}>Year</label>
              <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className={selectCls}>
                <option value="">All Years</option>
                {['1st Year', '2nd Year', '3rd Year', '4th Year'].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Division</label>
              <select value={filterDivision} onChange={e => setFilterDivision(e.target.value)} className={selectCls}>
                <option value="">All Divisions</option>
                {['A', 'B', 'C', 'D'].map(d => <option key={d} value={d}>Division {d}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Subject</label>
              <input
                type="text"
                value={filterSubject}
                onChange={e => setFilterSubject(e.target.value)}
                placeholder="e.g. Mathematics"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Student ID</label>
              <input
                type="text"
                value={filterStudentId}
                onChange={e => setFilterStudentId(e.target.value)}
                placeholder="e.g. STU001"
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={fetchAttendanceData}
              disabled={loading}
              className="py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-base font-bold transition-colors shadow-sm flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              {loading ? 'Fetching...' : 'Query Records'}
            </button>

            <button
              onClick={exportExcel}
              className="py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-base font-bold transition-colors shadow-sm flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </button>

            <button
              onClick={() => {
                const activeDept = teacherDept || filterDepartment
                const params = new URLSearchParams()
                if (activeDept) params.set('department', activeDept)
                if (filterYear) params.set('year', filterYear)
                if (filterDivision) params.set('division', filterDivision)
                if (filterSubject) params.set('subject', filterSubject)
                navigate(`/attendance/defaulters?${params.toString()}`)
              }}
              className="py-3 px-6 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-xl text-base font-bold transition-all shadow-sm flex items-center gap-2"
              title="Filter students with attendance < 75% and download official notice PDF"
            >
              <AlertTriangle className="w-4 h-4" />
              Generate Defaulter List (&lt; 75%)
            </button>
          </div>
        </div>

        {/* Stats Summary Bar */}
        {attendanceData.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-gray-800">{stats.totalStudents}</p>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Total Students</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-green-50 rounded-xl text-green-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-green-600">{stats.presentToday}</p>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Present</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-red-50 rounded-xl text-red-600">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-red-600">{stats.absentToday}</p>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Absent</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-purple-600">{stats.attendanceRate}%</p>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Attendance Rate</p>
              </div>
            </div>
          </div>
        )}

        {/* Attendance Results Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-800">
              {selectedDate ? `Records for ${new Date(selectedDate).toLocaleDateString()}` : 'Attendance Results'}
            </h3>
            <span className="text-sm font-semibold text-gray-500">
              {attendanceData.length} records found
            </span>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
              <p className="text-base text-gray-500 font-medium">Loading attendance data...</p>
            </div>
          ) : !searched ? (
            <div className="py-20 text-center text-gray-500">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-base font-semibold text-gray-700">No Query Executed</p>
              <p className="text-sm text-gray-500 mt-1">Please apply filters above and click "Query Records".</p>
            </div>
          ) : attendanceData.length === 0 ? (
            <div className="py-20 text-center text-gray-500">
              <p className="text-base font-semibold text-gray-700">No attendance records found</p>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your date or department filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50/80 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Student ID</th>
                    <th className="px-6 py-4">Full Name</th>
                    <th className="px-6 py-4">Subject</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Time</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-base">
                  {attendanceData.map(record => (
                    <tr key={record._id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-6 py-4 font-semibold text-blue-600">{record.studentId}</td>
                      <td className="px-6 py-4 font-medium text-gray-800">{record.studentName}</td>
                      <td className="px-6 py-4 font-semibold text-gray-700">{record.subject}</td>
                      <td className="px-6 py-4 text-gray-600">{new Date(record.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-gray-600 font-mono text-sm">{record.time}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          record.status === 'present'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${record.status === 'present' ? 'bg-green-600' : 'bg-red-600'}`} />
                          {record.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-700">{record.confidence}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
