import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserCog,
  Home,
  Trash2,
  Plus,
  Mail,
  IdCard,
  Building,
  Lock,
  User,
  Edit3,
  X,
  CheckCircle2,
  Search,
  Check,
  RefreshCw,
  Key,
  Users,
  AlertTriangle,
} from 'lucide-react'
import { apiFetch } from '../../lib/api.js'

const departments = [
  'Computer Science',
  'Information Technology',
  'Electronics',
  'Mechanical',
  'Civil',
  'Electrical',
  'Chemical',
  'Biotechnology',
]

export default function ManageTeachers() {
  const navigate = useNavigate()
  const [isAuthed, setIsAuthed] = useState(null)
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState({ msg: '', type: '' })
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    password: '',
    employeeId: '',
    department: '',
  })

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('')

  // Edit Teacher Modal state
  const [editingTeacher, setEditingTeacher] = useState(null)
  const [editForm, setEditForm] = useState({
    username: '',
    email: '',
    employeeId: '',
    department: '',
    status: 'active',
    password: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    try {
      const loggedIn = localStorage.getItem('isLoggedIn') === 'true'
      const userType = localStorage.getItem('userType')
      if (!loggedIn || userType !== 'admin') {
        setIsAuthed(false)
        navigate('/signin')
        return
      }
      setIsAuthed(true)
      fetchTeachers()
    } catch {
      setIsAuthed(false)
      navigate('/signin')
    }
  }, [navigate])

  const showStatus = (msg, type = 'success') => {
    setStatus({ msg, type })
    setTimeout(() => {
      setStatus({ msg: '', type: '' })
    }, 5000)
  }

  const fetchTeachers = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/admin/teachers')
      const data = await res.json()
      if (data.success) {
        setTeachers(data.teachers || [])
      } else {
        showStatus(data.error || 'Failed to load teachers', 'error')
      }
    } catch {
      showStatus('Error connecting to server', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Stats calculation
  const stats = useMemo(() => {
    const total = teachers.length
    const active = teachers.filter(t => t.status === 'active').length
    const inactive = total - active
    const depts = new Set(teachers.map(t => t.department).filter(Boolean)).size
    return { total, active, inactive, depts }
  }, [teachers])

  // Filtered teachers list
  const filteredTeachers = useMemo(() => {
    return teachers.filter(t => {
      const q = searchQuery.toLowerCase().trim()
      const matchQuery =
        !q ||
        (t.username && t.username.toLowerCase().includes(q)) ||
        (t.email && t.email.toLowerCase().includes(q)) ||
        (t.employeeId && t.employeeId.toLowerCase().includes(q))

      const matchDept = !selectedDeptFilter || t.department === selectedDeptFilter
      const matchStatus = !selectedStatusFilter || t.status === selectedStatusFilter

      return matchQuery && matchDept && matchStatus
    })
  }, [teachers, searchQuery, selectedDeptFilter, selectedStatusFilter])

  // Form handlers
  const handleCreateChange = e => {
    setCreateForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleCreate = async e => {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await apiFetch('/api/admin/teachers', {
        method: 'POST',
        body: JSON.stringify(createForm),
      })
      const data = await res.json()
      if (data.success) {
        showStatus(`Teacher account created for "${createForm.username}"`, 'success')
        setCreateForm({ username: '', email: '', password: '', employeeId: '', department: '' })
        fetchTeachers()
      } else {
        showStatus(data.error || 'Failed to create teacher', 'error')
      }
    } catch {
      showStatus('Error connecting to server', 'error')
    } finally {
      setCreating(false)
    }
  }

  // Edit Modal Handlers
  const openEditModal = teacher => {
    setEditingTeacher(teacher)
    setEditForm({
      username: teacher.username || '',
      email: teacher.email || '',
      employeeId: teacher.employeeId || teacher.employee_id || '',
      department: teacher.department || '',
      status: teacher.status || 'active',
      password: '',
    })
  }

  const closeEditModal = () => {
    setEditingTeacher(null)
    setEditForm({
      username: '',
      email: '',
      employeeId: '',
      department: '',
      status: 'active',
      password: '',
    })
  }

  const handleEditChange = e => {
    setEditForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleUpdateTeacher = async e => {
    e.preventDefault()
    if (!editingTeacher) return
    setSavingEdit(true)
    try {
      const payload = {
        username: editForm.username.trim(),
        email: editForm.email.trim(),
        employeeId: editForm.employeeId.trim(),
        department: editForm.department,
        status: editForm.status,
      }
      if (editForm.password && editForm.password.trim()) {
        payload.password = editForm.password.trim()
      }

      const res = await apiFetch(`/api/admin/teachers/${editingTeacher._id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success) {
        showStatus(`Teacher "${editForm.username}" updated successfully!`, 'success')
        closeEditModal()
        fetchTeachers()
      } else {
        showStatus(data.error || 'Failed to update teacher account', 'error')
      }
    } catch {
      showStatus('Error connecting to server', 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  const toggleStatus = async teacher => {
    const nextStatus = teacher.status === 'active' ? 'inactive' : 'active'
    try {
      const res = await apiFetch(`/api/admin/teachers/${teacher._id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await res.json()
      if (data.success) {
        showStatus(`Teacher "${teacher.username}" status updated to ${nextStatus}`, 'success')
        fetchTeachers()
      } else {
        showStatus(data.error || 'Failed to update status', 'error')
      }
    } catch {
      showStatus('Error connecting to server', 'error')
    }
  }

  const handleDelete = async teacher => {
    if (!confirm(`Delete teacher account for "${teacher.username}" (${teacher.email})? This action cannot be undone.`)) {
      return
    }
    try {
      const res = await apiFetch(`/api/admin/teachers/${teacher._id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        showStatus(`Teacher "${teacher.username}" deleted successfully`, 'success')
        fetchTeachers()
      } else {
        showStatus(data.error || 'Failed to delete teacher', 'error')
      }
    } catch {
      showStatus('Error connecting to server', 'error')
    }
  }

  const inputCls =
    'w-full border-2 border-slate-200 rounded-xl pl-10 pr-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none bg-white placeholder-slate-400'
  const selectCls =
    'w-full border-2 border-slate-200 rounded-xl pl-10 pr-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none bg-white'

  if (isAuthed === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4" />
          <p className="text-xl text-slate-700 font-medium">Checking access...</p>
        </div>
      </div>
    )
  }
  if (isAuthed === false) return null

  return (
    <main className="min-h-screen bg-[#f1f5f9] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl shadow-md text-white">
              <UserCog className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Manage Teachers</h1>
              <p className="text-sm sm:text-base text-slate-500 mt-0.5">
                Create, edit details, assign departments, and configure teacher accounts
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition-all shadow-sm"
          >
            <Home className="w-4 h-4" />
            Admin Dashboard
          </button>
        </div>

        {/* Global Notification Banner */}
        {status.msg && (
          <div
            className={`p-4 rounded-2xl text-sm sm:text-base font-bold flex items-center justify-center gap-2 border-2 transition-all ${
              status.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-rose-50 text-rose-800 border-rose-300'
            }`}
          >
            {status.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{status.msg}</span>
          </div>
        )}

        {/* Statistics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center gap-3.5">
            <div className="p-3 bg-purple-100 text-purple-700 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">{stats.total}</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Teachers</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center gap-3.5">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-emerald-700">{stats.active}</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Accounts</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center gap-3.5">
            <div className="p-3 bg-rose-100 text-rose-700 rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-rose-700">{stats.inactive}</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Inactive Accounts</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center gap-3.5">
            <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-black text-blue-700">{stats.depts}</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Departments Covered</div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column: Create New Teacher Form */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-slate-100">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">New Teacher Account</h2>
                  <p className="text-xs text-slate-500">Provision login &amp; assign department</p>
                </div>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Full Name / Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      name="username"
                      placeholder="e.g. Prof. Alan Turing"
                      required
                      value={createForm.username}
                      onChange={handleCreateChange}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      name="email"
                      type="email"
                      placeholder="e.g. turing@college.edu"
                      required
                      value={createForm.email}
                      onChange={handleCreateChange}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Temporary Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      name="password"
                      type="password"
                      placeholder="Min 6 characters"
                      required
                      value={createForm.password}
                      onChange={handleCreateChange}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Employee ID
                  </label>
                  <div className="relative">
                    <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      name="employeeId"
                      placeholder="e.g. EMP-CSE-001"
                      required
                      value={createForm.employeeId}
                      onChange={handleCreateChange}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Department Assignment
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                      name="department"
                      value={createForm.department}
                      onChange={handleCreateChange}
                      className={selectCls}
                    >
                      <option value="">Select Department (Recommended)</option>
                      {departments.map(d => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={creating}
                  className="w-full py-3 mt-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-bold transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Create Teacher Account</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Teacher Directory & Edit Actions */}
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-black text-slate-900">Faculty Directory</h2>
                <p className="text-xs text-slate-500">
                  Showing {filteredTeachers.length} of {teachers.length} registered teachers
                </p>
              </div>

              <button
                onClick={fetchTeachers}
                disabled={loading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                title="Refresh list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, email, ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-800 text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              <div>
                <select
                  value={selectedDeptFilter}
                  onChange={e => setSelectedDeptFilter(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                >
                  <option value="">All Departments</option>
                  {departments.map(d => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={selectedStatusFilter}
                  onChange={e => setSelectedStatusFilter(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>
            </div>

            {/* Teacher Cards List */}
            {loading ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3" />
                <p className="text-slate-500 font-semibold text-sm">Loading teachers...</p>
              </div>
            ) : filteredTeachers.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl p-8">
                <UserCog className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-700 font-bold text-base">No matching teacher accounts found</p>
                <p className="text-slate-400 text-xs mt-1">Try adjusting your search criteria or create a new teacher.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                {filteredTeachers.map(teacher => (
                  <div
                    key={teacher._id}
                    className="p-4 rounded-2xl border-2 border-slate-200 bg-slate-50 hover:bg-white hover:border-purple-300 hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-black flex items-center justify-center text-base shrink-0 shadow-sm">
                        {(teacher.username || 'T').substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-base">{teacher.username}</span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider ${
                              teacher.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {teacher.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{teacher.email}</span>
                        </div>
                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-1">
                          {teacher.employeeId && (
                            <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[11px] font-bold">
                              ID: {teacher.employeeId}
                            </span>
                          )}
                          {teacher.department ? (
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold text-[11px]">
                              {teacher.department}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">No Dept Assigned</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions Group */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => openEditModal(teacher)}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition-all shadow-xs"
                        title="Edit teacher details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Details</span>
                      </button>

                      <button
                        onClick={() => toggleStatus(teacher)}
                        className={`px-3 py-2 text-xs font-bold rounded-xl border transition-colors ${
                          teacher.status === 'active'
                            ? 'border-slate-300 bg-white hover:bg-slate-100 text-slate-700'
                            : 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {teacher.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>

                      <button
                        onClick={() => handleDelete(teacher)}
                        className="p-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-100 transition-colors"
                        title="Delete teacher permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* EDIT TEACHER MODAL */}
      {editingTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border-2 border-slate-200 overflow-hidden flex flex-col animate-scaleUp">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                  <Edit3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black">Edit Teacher Details</h3>
                  <p className="text-xs text-purple-200">
                    Modifying profile for <span className="font-bold underline">{editingTeacher.username}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={closeEditModal}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleUpdateTeacher} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Teacher Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      name="username"
                      required
                      value={editForm.username}
                      onChange={handleEditChange}
                      className={inputCls}
                      placeholder="e.g. Prof. Alan Turing"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      name="email"
                      type="email"
                      required
                      value={editForm.email}
                      onChange={handleEditChange}
                      className={inputCls}
                      placeholder="e.g. turing@college.edu"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Employee ID
                  </label>
                  <div className="relative">
                    <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      name="employeeId"
                      required
                      value={editForm.employeeId}
                      onChange={handleEditChange}
                      className={inputCls}
                      placeholder="e.g. EMP-CSE-001"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Department
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                      name="department"
                      value={editForm.department}
                      onChange={handleEditChange}
                      className={selectCls}
                    >
                      <option value="">Select Department</option>
                      {departments.map(d => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Account Status
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      editForm.status === 'active'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value="active"
                      checked={editForm.status === 'active'}
                      onChange={handleEditChange}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Active Account</span>
                  </label>

                  <label
                    className={`flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      editForm.status === 'inactive'
                        ? 'border-rose-500 bg-rose-50 text-rose-900 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value="inactive"
                      checked={editForm.status === 'inactive'}
                      onChange={handleEditChange}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span>Inactive / Suspended</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Reset Password <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    name="password"
                    type="password"
                    value={editForm.password}
                    onChange={handleEditChange}
                    className={inputCls}
                    placeholder="Leave empty to keep existing password"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Only enter a new password if you want to override the teacher's current login credentials.
                </p>
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={savingEdit}
                  className="px-5 py-2.5 rounded-xl border-2 border-slate-300 font-bold text-slate-700 hover:bg-slate-100 transition-colors text-sm"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {savingEdit ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
