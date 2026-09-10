import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  FileSpreadsheet,
  Download,
  LayoutDashboard,
  Search,
  Filter,
  Users,
  AlertOctagon,
  TrendingUp,
  Calendar,
  CheckCircle2,
  RefreshCw,
  Printer,
} from 'lucide-react'
import { apiFetch } from '../../lib/api.js'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function DefaulterList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const utype = localStorage.getItem('userType')
  const teacherDept = utype === 'teacher' ? (localStorage.getItem('department') || '') : ''

  // Filters state
  const [department, setDepartment] = useState(teacherDept || searchParams.get('department') || '')
  const [year, setYear] = useState(searchParams.get('year') || '')
  const [division, setDivision] = useState(searchParams.get('division') || '')
  const [subject, setSubject] = useState(searchParams.get('subject') || '')
  const [threshold, setThreshold] = useState(searchParams.get('threshold') || '75')
  const [month, setMonth] = useState(searchParams.get('month') || '')

  // Data state
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [defaultersData, setDefaultersData] = useState([])
  const [allStudentsData, setAllStudentsData] = useState([])
  const [stats, setStats] = useState({
    totalStudents: 0,
    defaulterCount: 0,
    criticalCount: 0,
    safeCount: 0,
    defaulterRate: 0,
    averageAttendance: 0,
    totalSessions: 0,
  })
  const [metadata, setMetadata] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  // View mode: 'defaulters' or 'all'
  const [viewMode, setViewMode] = useState('defaulters')
  const [tableSearch, setTableSearch] = useState('')

  const dashboardPath = useMemo(() => {
    if (utype === 'admin') return '/admin/dashboard'
    if (utype === 'teacher') return '/teacher/dashboard'
    return '/dashboard'
  }, [utype])

  const fetchDefaulters = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const activeDept = teacherDept || department
      const params = new URLSearchParams()
      if (activeDept) params.set('department', activeDept)
      if (year) params.set('year', year)
      if (division) params.set('division', division)
      if (subject) params.set('subject', subject)
      if (threshold) params.set('threshold', threshold)
      if (month) params.set('month', month)

      const res = await apiFetch(`/api/attendance/defaulters?${params.toString()}`)
      const data = await res.json()

      if (data && data.success) {
        setDefaultersData(data.defaulters || [])
        setAllStudentsData(data.allStudents || [])
        setStats(data.stats || {})
        setMetadata(data.metadata || {})
        setHasSearched(true)
      } else {
        setErrorMsg(data?.error || 'Failed to fetch defaulters')
      }
    } catch (err) {
      console.error('Error fetching defaulters:', err)
      setErrorMsg('Failed to connect to server. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [department, teacherDept, year, division, subject, threshold, month])

  // Automatically fetch on mount if filters provided in query params or teacher has assigned department
  useEffect(() => {
    if (teacherDept || searchParams.get('department') || searchParams.get('year') || searchParams.get('division')) {
      fetchDefaulters()
    }
  }, [fetchDefaulters, searchParams, teacherDept])

  // Filter table data by search query
  const displayedStudents = useMemo(() => {
    const source = viewMode === 'defaulters' ? defaultersData : allStudentsData
    if (!tableSearch.trim()) return source

    const q = tableSearch.toLowerCase().trim()
    return source.filter(
      s =>
        (s.studentName && s.studentName.toLowerCase().includes(q)) ||
        (s.studentId && s.studentId.toLowerCase().includes(q))
    )
  }, [viewMode, defaultersData, allStudentsData, tableSearch])

  // 1-Click PDF Generator
  const generatePDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      const now = new Date()
      const formattedDate = now.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
      const formattedTime = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })

      // 1. Header Banner & Institution Title
      doc.setFillColor(30, 58, 138) // Deep Royal Blue
      doc.rect(0, 0, 210, 26, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(15)
      doc.text('SMART ATTENDANCE MANAGEMENT SYSTEM', 105, 11, { align: 'center' })

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('ACADEMIC ATTENDANCE MONITORING CELL • OFFICIAL REPORT', 105, 18, { align: 'center' })

      // 2. Report Subheading
      doc.setTextColor(220, 38, 38) // Crimson Red
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.text(`OFFICIAL NOTICE: ATTENDANCE DEFAULTER LIST (< ${threshold}% ATTENDANCE)`, 14, 35)

      // 3. Metadata Box
      doc.setFillColor(248, 250, 252) // slate-50
      doc.setDrawColor(226, 232, 240) // border slate-200
      doc.roundedRect(14, 38, 182, 23, 2, 2, 'FD')

      doc.setFontSize(9)
      doc.setTextColor(51, 65, 85)

      // Left column
      doc.setFont('helvetica', 'bold')
      doc.text('Department:', 18, 44)
      doc.setFont('helvetica', 'normal')
      doc.text(department || 'All Departments', 42, 44)

      doc.setFont('helvetica', 'bold')
      doc.text('Academic Year:', 18, 50)
      doc.setFont('helvetica', 'normal')
      doc.text(year || 'All Years', 44, 50)

      doc.setFont('helvetica', 'bold')
      doc.text('Division:', 18, 56)
      doc.setFont('helvetica', 'normal')
      doc.text(division ? `Division ${division}` : 'All Divisions', 35, 56)

      // Right column
      doc.setFont('helvetica', 'bold')
      doc.text('Subject:', 110, 44)
      doc.setFont('helvetica', 'normal')
      doc.text(subject || 'Composite (All Subjects)', 128, 44)

      doc.setFont('helvetica', 'bold')
      doc.text('Total Sessions:', 110, 50)
      doc.setFont('helvetica', 'normal')
      doc.text(String(stats.totalSessions || 0), 136, 50)

      doc.setFont('helvetica', 'bold')
      doc.text('Generated On:', 110, 56)
      doc.setFont('helvetica', 'normal')
      doc.text(`${formattedDate} ${formattedTime}`, 134, 56)

      // 4. Regulatory Advisory Notice Box
      doc.setFillColor(254, 242, 242) // light red
      doc.setDrawColor(254, 202, 202)
      doc.roundedRect(14, 64, 182, 14, 2, 2, 'FD')

      doc.setFontSize(8)
      doc.setTextColor(153, 27, 27)
      doc.setFont('helvetica', 'bold')
      doc.text('MANDATORY ACADEMIC REGULATION CLAUSE 4.2:', 18, 69)
      doc.setFont('helvetica', 'normal')
      const noticeLine = `Students with attendance below ${threshold}% are flagged as defaulters. Defaulters must report to their Class Teacher/HOD immediately. Shortfalls below 50% carry severe risk of examination debarment.`
      doc.text(doc.splitTextToSize(noticeLine, 174), 18, 73)

      // 5. Statistics Chips in PDF
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 41, 59)
      doc.text(
        `Class Strength: ${stats.totalStudents}  |  Total Defaulters: ${stats.defaulterCount} (${stats.defaulterRate}%)  |  Critical Risk (<50%): ${stats.criticalCount}  |  Class Average: ${stats.averageAttendance}%`,
        14,
        83
      )

      // 6. Defaulters Table (jspdf-autotable)
      const tableData = (viewMode === 'defaulters' ? defaultersData : allStudentsData).map((s, idx) => [
        idx + 1,
        s.studentId,
        s.studentName,
        s.totalSessions,
        s.attended,
        s.absent,
        `${s.percentage}%`,
        s.isDefaulter ? `+${s.classesNeeded} classes` : 'Target Met',
        s.status === 'critical' ? 'CRITICAL (<50%)' : s.isDefaulter ? 'DEFAULTER' : 'ELIGIBLE'
      ])

      autoTable(doc, {
        startY: 87,
        margin: { left: 14, right: 14, bottom: 35 },
        head: [['#', 'Roll / ID', 'Student Name', 'Held', 'Attd', 'Abs', 'Attd %', 'Recovery Target', 'Status']],
        body: tableData,
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8.5,
          halign: 'center',
        },
        styles: {
          fontSize: 8,
          cellPadding: 2.2,
          valign: 'middle',
          lineColor: [226, 232, 240],
          lineWidth: 0.1,
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },
          1: { fontStyle: 'bold', cellWidth: 22 },
          2: { cellWidth: 42 },
          3: { halign: 'center', cellWidth: 12 },
          4: { halign: 'center', cellWidth: 12 },
          5: { halign: 'center', cellWidth: 12 },
          6: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
          7: { halign: 'center', cellWidth: 26 },
          8: { halign: 'center', fontStyle: 'bold', cellWidth: 28 },
        },
        didParseCell: (data) => {
          if (data.section === 'body') {
            const rawRow = (viewMode === 'defaulters' ? defaultersData : allStudentsData)[data.row.index]
            if (rawRow) {
              if (rawRow.status === 'critical') {
                if (data.column.index === 6 || data.column.index === 8) {
                  data.cell.styles.textColor = [185, 28, 28] // bold red
                }
              } else if (rawRow.isDefaulter) {
                if (data.column.index === 6 || data.column.index === 8) {
                  data.cell.styles.textColor = [194, 65, 12] // amber
                }
              } else {
                if (data.column.index === 8) {
                  data.cell.styles.textColor = [22, 101, 52] // green
                }
              }
            }
          }
        },
      })

      // 7. Signatures Block & Page numbering on every page
      const totalPages = doc.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)

        // If last page, print official signature placeholders
        if (i === totalPages) {
          const finalY = doc.lastAutoTable ? Math.min(doc.lastAutoTable.finalY + 15, 260) : 250
          doc.setDrawColor(148, 163, 184)
          doc.setLineWidth(0.3)

          // 3 signature blocks
          doc.line(16, finalY + 10, 60, finalY + 10)
          doc.setFontSize(8)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(71, 85, 105)
          doc.text('Class Teacher / In-Charge', 18, finalY + 15)

          doc.line(85, finalY + 10, 130, finalY + 10)
          doc.text('Head of Department (HOD)', 87, finalY + 15)

          doc.line(150, finalY + 10, 194, finalY + 10)
          doc.text('Principal / Academic Dean', 152, finalY + 15)
        }

        // Footer note & Page numbering
        doc.setFontSize(7.5)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(148, 163, 184)
        doc.text(
          `Smart Attendance Portal • Generated on ${formattedDate} at ${formattedTime}`,
          14,
          290
        )
        doc.text(`Page ${i} of ${totalPages}`, 196, 290, { align: 'right' })
      }

      // Save PDF
      const filename = `Defaulter_List_${department || 'All'}_${year || 'Year'}_${division || 'Div'}_${threshold}pct.pdf`
      doc.save(filename.replace(/\s+/g, '_'))
    } catch (err) {
      console.error('Failed to generate PDF:', err)
      alert('Error generating PDF report. Check console for details.')
    }
  }

  // Excel Export
  const exportExcel = async () => {
    try {
      const source = viewMode === 'defaulters' ? defaultersData : allStudentsData
      if (!source || source.length === 0) {
        alert('No student records to export.')
        return
      }

      const rows = source.map((s, idx) => ({
        'Sr No': idx + 1,
        'Student ID': s.studentId,
        'Student Name': s.studentName,
        'Department': s.department,
        'Year': s.year,
        'Division': s.division,
        'Total Sessions': s.totalSessions,
        'Attended Sessions': s.attended,
        'Absent Sessions': s.absent,
        'Attendance %': `${s.percentage}%`,
        'Defaulter Status': s.isDefaulter ? 'YES' : 'NO',
        'Classes Needed to Reach 75%': s.isDefaulter ? s.classesNeeded : 0,
        'Risk Category': s.riskLabel,
      }))

      const XLSX = await import('xlsx')
      const worksheet = XLSX.utils.json_to_sheet(rows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Defaulters List')

      const filename = `Defaulters_${department || 'All'}_${year || 'Year'}_Div${division || 'All'}_${threshold}pct.xlsx`
      XLSX.writeFile(workbook, filename.replace(/\s+/g, '_'))
    } catch (err) {
      console.error('Error exporting Excel:', err)
      alert('Error generating Excel file.')
    }
  }

  const inputCls =
    'w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all'
  const selectCls =
    'w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-700 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all'
  const labelCls = 'block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#eef2fb' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-rose-600 rounded-xl shadow-sm text-white">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-800">Defaulter List Generator</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                  &lt; {threshold}% Attendance
                </span>
              </div>
              <p className="text-base text-gray-500">
                Auto-filter low attendance, calculate recovery classes, and export official notice board PDFs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/student/view-attendance')}
              className="px-4 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-base font-medium transition-colors"
            >
              All Records
            </button>
            <button
              onClick={() => navigate(dashboardPath)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base font-medium transition-colors shadow-sm"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        {/* Filters Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-rose-600" />
              <h2 className="text-lg font-bold text-gray-800">Class &amp; Attendance Filters</h2>
            </div>
            <span className="text-xs text-gray-400 font-medium">Configure criteria for evaluation</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-5">
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
                <select value={department} onChange={e => setDepartment(e.target.value)} className={selectCls}>
                  <option value="">All Departments</option>
                  {['Computer Science', 'Information Technology', 'Electronics', 'Mechanical', 'Civil'].map(d => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className={labelCls}>Year</label>
              <select value={year} onChange={e => setYear(e.target.value)} className={selectCls}>
                <option value="">All Years</option>
                {['1st Year', '2nd Year', '3rd Year', '4th Year'].map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Division</label>
              <select value={division} onChange={e => setDivision(e.target.value)} className={selectCls}>
                <option value="">All Divisions</option>
                {['A', 'B', 'C', 'D'].map(d => (
                  <option key={d} value={d}>
                    Division {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Subject</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="All Subjects (Composite)"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Threshold (%)</label>
              <input
                type="number"
                min="10"
                max="100"
                value={threshold}
                onChange={e => setThreshold(e.target.value)}
                placeholder="75"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Month (Optional)</label>
              <input
                type="month"
                value={month}
                onChange={e => setMonth(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Quick Threshold Presets */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="font-semibold text-gray-600">Quick Thresholds:</span>
              {[75, 65, 80, 85].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setThreshold(String(val))}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    threshold === String(val)
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {val}% {val === 75 ? '(Default)' : ''}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setDepartment(teacherDept || '')
                  setYear('')
                  setDivision('')
                  setSubject('')
                  setThreshold('75')
                  setMonth('')
                }}
                className="px-4 py-2.5 text-gray-600 hover:text-gray-800 text-sm font-semibold transition-colors"
              >
                Reset
              </button>

              <button
                onClick={fetchDefaulters}
                disabled={loading}
                className="py-3 px-6 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-base font-bold transition-all shadow-sm flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Evaluating Attendance...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Generate Defaulter List
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700">
            <AlertOctagon className="w-5 h-5 flex-shrink-0" />
            <p className="text-base font-medium">{errorMsg}</p>
          </div>
        )}

        {/* KPI Stat Cards Row (Visible after search) */}
        {hasSearched && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-xl text-blue-600 flex-shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-gray-800">{stats.totalStudents}</p>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Total Strength</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-rose-50 rounded-xl text-rose-600 flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-rose-600">{stats.defaulterCount}</p>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Defaulters (&lt; {threshold}%)
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-xl text-red-700 flex-shrink-0">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-red-700">{stats.criticalCount}</p>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Critical Risk (&lt; 50%)
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 flex-shrink-0">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-emerald-600">{stats.averageAttendance}%</p>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Class Average</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 flex-shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-indigo-600">{stats.totalSessions}</p>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Sessions Held</p>
              </div>
            </div>
          </div>
        )}

        {/* Results & Actions Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1 flex flex-col">
          {/* Action Toolbar */}
          <div className="p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4 bg-gray-50/40">
            <div className="flex flex-wrap items-center gap-3">
              {/* Toggle Buttons */}
              <div className="flex items-center bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setViewMode('defaulters')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    viewMode === 'defaulters'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Defaulters Only ({defaultersData.length})
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    viewMode === 'all'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All Students ({allStudentsData.length})
                </button>
              </div>

              {/* Table search input */}
              <div className="relative">
                <input
                  type="text"
                  value={tableSearch}
                  onChange={e => setTableSearch(e.target.value)}
                  placeholder="Search name or ID..."
                  className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-52"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              </div>
            </div>

            {/* 1-Click Generation Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={generatePDF}
                disabled={displayedStudents.length === 0}
                className="py-2.5 px-5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 disabled:opacity-40 text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2 hover:shadow-md cursor-pointer"
                title="Download clean, printable institutional notice board PDF with signatures block"
              >
                <Download className="w-4 h-4" />
                1-Click Official PDF
              </button>

              <button
                onClick={exportExcel}
                disabled={displayedStudents.length === 0}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-sm font-bold transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                title="Download formatted Excel spreadsheet"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export Excel
              </button>

              <button
                onClick={() => window.print()}
                className="py-2.5 px-3.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer"
                title="Print this view"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Table Content Area */}
          {loading ? (
            <div className="py-24 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600 mx-auto mb-4" />
              <p className="text-base text-gray-700 font-bold">Auditing Attendance Records...</p>
              <p className="text-sm text-gray-500 mt-1">
                Calculating student attendance percentages and recovery thresholds
              </p>
            </div>
          ) : !hasSearched ? (
            <div className="py-24 text-center text-gray-500">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <p className="text-lg font-bold text-gray-800">Ready to Generate Defaulter List</p>
              <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                Select your Department, Year, and Division above, then click{' '}
                <span className="font-semibold text-rose-600">"Generate Defaulter List"</span> to identify students below 75% attendance.
              </p>
            </div>
          ) : displayedStudents.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <p className="text-lg font-bold text-gray-800">
                {viewMode === 'defaulters' ? 'No Defaulters Found!' : 'No Students Match Filter'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {viewMode === 'defaulters'
                  ? `Every student has achieved ${threshold}% or higher attendance.`
                  : 'Try selecting a different department or division.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50/80 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">#</th>
                    <th className="px-6 py-4">Student ID</th>
                    <th className="px-6 py-4">Student Name</th>
                    <th className="px-6 py-4">Department / Div</th>
                    <th className="px-6 py-4 text-center">Sessions Held</th>
                    <th className="px-6 py-4 text-center">Attended / Missed</th>
                    <th className="px-6 py-4">Attendance %</th>
                    <th className="px-6 py-4 text-center">Classes to Recover</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-base">
                  {displayedStudents.map((student, idx) => {
                    const isCritical = student.status === 'critical'
                    const isWarning = student.status === 'warning'
                    const isSafe = student.status === 'safe'

                    return (
                      <tr
                        key={student.studentId || idx}
                        className={`transition-colors ${
                          isCritical
                            ? 'bg-red-50/30 hover:bg-red-50/60'
                            : isWarning
                            ? 'bg-amber-50/20 hover:bg-amber-50/50'
                            : 'hover:bg-blue-50/30'
                        }`}
                      >
                        <td className="px-6 py-4 text-sm font-semibold text-gray-400">{idx + 1}</td>

                        <td className="px-6 py-4 font-bold text-blue-600 font-mono text-sm">
                          {student.studentId}
                        </td>

                        <td className="px-6 py-4 font-medium text-gray-900">
                          <div>{student.studentName}</div>
                          {student.email && (
                            <div className="text-xs text-gray-400 font-normal">{student.email}</div>
                          )}
                        </td>

                        <td className="px-6 py-4 text-sm text-gray-600">
                          {student.department ? `${student.department} • ` : ''}
                          {student.year ? `${student.year} ` : ''}
                          {student.division ? `(Div ${student.division})` : ''}
                        </td>

                        <td className="px-6 py-4 text-center font-bold text-gray-700">
                          {student.totalSessions}
                        </td>

                        <td className="px-6 py-4 text-center text-sm font-semibold">
                          <span className="text-green-600 font-bold">{student.attended}</span>
                          <span className="text-gray-400 mx-1">/</span>
                          <span className="text-red-500 font-bold">{student.absent}</span>
                        </td>

                        <td className="px-6 py-4 min-w-[170px]">
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`text-base font-extrabold ${
                                isCritical
                                  ? 'text-red-600'
                                  : isWarning
                                  ? 'text-amber-600'
                                  : 'text-green-600'
                              }`}
                            >
                              {student.percentage}%
                            </span>
                            <span className="text-xs text-gray-400 font-semibold">
                              Target: {threshold}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isCritical
                                  ? 'bg-red-600'
                                  : isWarning
                                  ? 'bg-amber-500'
                                  : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(5, student.percentage))}%` }}
                            />
                          </div>
                        </td>

                        <td className="px-6 py-4 text-center">
                          {student.isDefaulter ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              +{student.classesNeeded} classes
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-50 text-green-700">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Met
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          {isCritical ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                              CRITICAL RISK
                            </span>
                          ) : isWarning ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                              DEFAULTER
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
                              ELIGIBLE
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
