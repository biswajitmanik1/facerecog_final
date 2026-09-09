import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserCog, Home, Trash2, Plus, Mail, IdCard, Building, Lock, User } from 'lucide-react'
import { apiFetch } from '../../lib/api.js'

const departments = [
  'Computer Science', 'Information Technology', 'Electronics',
  'Mechanical', 'Civil', 'Electrical', 'Chemical', 'Biotechnology'
]

export default function ManageTeachers() {
  const navigate = useNavigate()
  const [isAuthed, setIsAuthed] = useState(null)
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ username: '', email: '', password: '', employeeId: '', department: '' })

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

  const fetchTeachers = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/admin/teachers')
      const data = await res.json()
      if (data.success) { setTeachers(data.teachers) }
      else { setStatus(`❌ ${data.error || 'Failed to load teachers'}`) }
    } catch {
      setStatus('❌ Error connecting to server')
    } finally { setLoading(false) }
  }

  const handleFormChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    setStatus('Creating teacher account...')
    try {
      const res = await apiFetch('/api/admin/teachers', { method: 'POST', body: JSON.stringify(form) })
      const data = await res.json()
      if (data.success) {
        setStatus(`✅ Teacher account created for ${form.username}`)
        setForm({ username: '', email: '', password: '', employeeId: '', department: '' })
        fetchTeachers()
      } else { setStatus(`❌ ${data.error}`) }
    } catch { setStatus('❌ Error connecting to server') }
    finally { setCreating(false) }
  }

  const toggleStatus = async (teacher) => {
    const nextStatus = teacher.status === 'active' ? 'inactive' : 'active'
    try {
      const res = await apiFetch(`/api/admin/teachers/${teacher._id}`, { method: 'PUT', body: JSON.stringify({ status: nextStatus }) })
      const data = await res.json()
      if (data.success) { setStatus(`✅ ${teacher.username} is now ${nextStatus}`); fetchTeachers() }
      else { setStatus(`❌ ${data.error}`) }
    } catch { setStatus('❌ Error connecting to server') }
  }

  const handleDelete = async (teacher) => {
    if (!confirm(`Delete teacher account for ${teacher.username} (${teacher.email})? This cannot be undone.`)) return
    try {
      const res = await apiFetch(`/api/admin/teachers/${teacher._id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) { setStatus(`✅ ${teacher.username} deleted`); fetchTeachers() }
      else { setStatus(`❌ ${data.error}`) }
    } catch { setStatus('❌ Error connecting to server') }
  }

  if (isAuthed === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-500 mx-auto mb-4" />
          <p className="text-xl text-slate-700 font-medium">Checking access...</p>
        </div>
      </div>
    )
  }
  if (isAuthed === false) return null

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg">
              <UserCog className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Manage Teachers</h1>
              <p className="text-slate-600">Create, deactivate, or remove teacher accounts</p>
            </div>
          </div>
          <button onClick={() => navigate('/admin/dashboard')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl transition-all shadow-lg">
            <Home className="w-5 h-5" />
            Dashboard
          </button>
        </div>

        {status && (
          <div className={`mb-6 p-4 rounded-xl text-center border-2 ${
            status.includes('✅') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
          }`}>{status}</div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Create teacher form */}
          <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-600" />
              New Teacher Account
            </h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input name="username" placeholder="Username" required value={form.username} onChange={handleFormChange}
                  className="w-full border-2 border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input name="email" type="email" placeholder="Email" required value={form.email} onChange={handleFormChange}
                  className="w-full border-2 border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input name="password" type="password" placeholder="Temporary password" required value={form.password} onChange={handleFormChange}
                  className="w-full border-2 border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
              </div>
              <div className="relative">
                <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input name="employeeId" placeholder="Employee ID" required value={form.employeeId} onChange={handleFormChange}
                  className="w-full border-2 border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
              </div>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select name="department" value={form.department} onChange={handleFormChange}
                  className="w-full border-2 border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                  <option value="">Select Department (optional)</option>
                  {departments.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <button type="submit" disabled={creating}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 transition-all">
                {creating ? 'Creating...' : 'Create Teacher Account'}
              </button>
            </form>
          </div>

          {/* Teacher list */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-lg border-2 border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Teachers ({teachers.length})</h3>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3" />
                <p className="text-slate-600">Loading teachers...</p>
              </div>
            ) : teachers.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No teacher accounts yet.</p>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {teachers.map(teacher => (
                  <div key={teacher._id} className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">
                        {teacher.username}
                        <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                          teacher.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>{teacher.status}</span>
                      </div>
                      <div className="text-sm text-slate-600">{teacher.email}</div>
                      <div className="text-xs text-slate-500">
                        {teacher.employeeId ? `ID: ${teacher.employeeId}` : ''}
                        {teacher.department ? ` • ${teacher.department}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleStatus(teacher)}
                        className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 hover:bg-slate-100 transition-colors text-slate-700">
                        {teacher.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => handleDelete(teacher)}
                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors" title="Delete teacher">
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
    </main>
  )
}
