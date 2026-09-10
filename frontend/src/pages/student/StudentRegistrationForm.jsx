import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import MultiCameraCapture from '../../components/MultiCameraCapture.jsx'
import { ArrowLeft, User, Mail, Phone, Building, Calendar, Users, BookOpen, Camera, Home, IdCard, GraduationCap } from 'lucide-react'
import { apiFetch } from '../../lib/api.js'

const departments = ['Computer Science', 'Information Technology', 'Electronics', 'Mechanical', 'Civil', 'Electrical', 'Chemical', 'Biotechnology']
const years = ['1st Year', '2nd Year', '3rd Year', '4th Year']
const divisions = ['A', 'B', 'C', 'D']
const semesters = ['1', '2', '3', '4', '5', '6', '7', '8']

function InputField({ name, value, onChange, icon: Icon, label, placeholder, type = 'text', disabled = false }) {
  return (
    <div className="group">
      <label className="block text-slate-700 text-sm font-semibold mb-2 transition-all duration-300 group-focus-within:text-blue-600">{label}</label>
      <div className="relative">
        <input name={name} value={value} onChange={onChange} type={type} placeholder={placeholder} disabled={disabled}
          title={disabled ? "This is your sign-in email and can't be changed here" : undefined}
          className={`w-full px-4 py-3 pl-12 rounded-lg border-2 border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all duration-300 font-medium hover:border-slate-300 shadow-sm hover:shadow-md ${
            disabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
          }`} />
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 p-1 rounded-md bg-slate-100 group-focus-within:bg-blue-100 transition-all duration-300">
          <Icon className="w-4 h-4 text-slate-500 group-focus-within:text-blue-600 transition-colors duration-300" />
        </div>
      </div>
    </div>
  )
}

function SelectField({ name, value, onChange, icon: Icon, label, options, placeholder, prefix, disabled = false }) {
  return (
    <div className="group">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-slate-700 text-sm font-semibold transition-all duration-300 group-focus-within:text-emerald-600">{label}</label>
        {disabled && (
          <span className="text-xs text-blue-600 font-medium">🔒 Locked</span>
        )}
      </div>
      <div className="relative">
        <select name={name} value={value} onChange={onChange} disabled={disabled}
          className={`w-full px-4 py-3 pl-12 rounded-lg border-2 border-slate-200 text-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all duration-300 font-medium hover:border-slate-300 shadow-sm hover:shadow-md appearance-none ${
            disabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white cursor-pointer'
          }`}>
          <option value="" className="text-slate-400">{placeholder || `Select ${label}`}</option>
          {options.map(opt => (
            <option key={opt} value={opt} className="text-slate-800 font-medium">
              {prefix ? `${prefix}${opt}` : opt}
            </option>
          ))}
        </select>
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 p-1 rounded-md bg-slate-100 group-focus-within:bg-emerald-100 transition-all duration-300">
          <Icon className="w-4 h-4 text-slate-500 group-focus-within:text-emerald-600 transition-colors duration-300" />
        </div>
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <svg className="w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  )
}

export default function StudentRegistrationForm() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({ studentName: '', studentId: '', department: '', year: '', division: '', semester: '', email: '', phoneNumber: '' })
  const [status, setStatus] = useState('')
  const [step, setStep] = useState(1)
  const [isAuthed, setIsAuthed] = useState(null)
  const [userType, setUserType] = useState('student')

  const dashboardPath = useMemo(() => {
    if (userType === 'admin') return '/admin/dashboard'
    if (userType === 'teacher') return '/teacher/dashboard'
    return '/dashboard'
  }, [userType])

  useEffect(() => {
    try {
      const loggedIn = localStorage.getItem('isLoggedIn') === 'true'
      const utype = localStorage.getItem('userType') || 'student'
      setUserType(utype)
      if (!loggedIn) { setIsAuthed(false); navigate('/signin'); return }
      setIsAuthed(true)
      if (utype === 'student') {
        const loginEmail = localStorage.getItem('userEmail') || ''
        setFormData(prev => ({ ...prev, email: loginEmail }))
      } else if (utype === 'teacher') {
        const teacherDept = localStorage.getItem('department') || ''
        if (teacherDept) {
          setFormData(prev => ({ ...prev, department: teacherDept }))
        }
      }
    } catch { setIsAuthed(false); navigate('/signin') }
  }, [navigate])

  const handleInputChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const validateForm = () => {
    const required = Object.values(formData).every(v => v.trim() !== '')
    if (!required) { setStatus('Please fill all required fields'); return false }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) { setStatus('Please enter a valid email address'); return false }
    if (!/^[0-9]{10}$/.test(formData.phoneNumber)) { setStatus('Please enter a valid 10-digit phone number'); return false }
    return true
  }

  const handleFormSubmit = (e) => {
    e.preventDefault()
    if (validateForm()) { setStep(2); setStatus('Please capture your 5 photos for face recognition') }
  }

  const handlePhotoCapture = async (images) => {
    setStatus('Registering student...')
    try {
      const res = await apiFetch('/api/register-student', { method: 'POST', body: JSON.stringify({ ...formData, images }) })
      const data = await res.json()
      if (data.success) {
        localStorage.setItem('studentId', formData.studentId)
        localStorage.setItem('hasStudentRecord', 'true')
        setStatus(`✅ Student registered successfully! ID: ${formData.studentId}`)
        setTimeout(() => navigate(dashboardPath), 1200)
      } else { setStatus(`❌ ${data.error}`) }
    } catch { setStatus('❌ Error connecting to server') }
  }

  if (isAuthed === null) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-blue-600 mx-auto mb-6" />
          <p className="text-2xl text-slate-700 font-semibold">Checking access...</p>
        </div>
      </div>
    )
  }
  if (isAuthed === false) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute -top-40 -right-32 w-96 h-96 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-32 w-96 h-96 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse animation-delay-2000" />
      </div>

      <header className="bg-white/90 backdrop-blur-xl border-b-2 border-slate-200 shadow-lg relative z-10">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Student Registration</h1>
              <p className="text-slate-600 text-sm font-medium">Step {step} of 2: {step === 1 ? 'Student Details' : 'Photo Capture'}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-6 h-1.5 rounded-full transition-all duration-500 ${step >= 1 ? 'bg-blue-500' : 'bg-slate-200'}`} />
                <div className={`w-6 h-1.5 rounded-full transition-all duration-500 ${step >= 2 ? 'bg-blue-500' : 'bg-slate-200'}`} />
              </div>
            </div>
          </div>
          <button onClick={() => navigate(dashboardPath)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border-2 border-slate-300 hover:border-slate-400 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl font-semibold">
            <Home className="w-4 h-4" />
            <span className="hidden sm:block">Dashboard</span>
          </button>
        </div>
      </header>

      <main className="p-4 relative z-10 max-h-[calc(100vh-120px)] overflow-y-auto">
        <div className={`mx-auto transition-all duration-300 ${step === 1 ? 'max-w-7xl' : 'max-w-2xl'}`}>
          {step === 1 ? (
            <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-6 border-2 border-slate-200 shadow-2xl">
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Register New Student</h2>
                <p className="text-slate-600 text-base">Fill in all required student details</p>
              </div>
              <form onSubmit={handleFormSubmit}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200 shadow-lg">
                    <h3 className="text-xl font-bold text-slate-900 mb-5">Personal Details</h3>
                    <div className="space-y-4">
                      <InputField name="studentName" value={formData.studentName} onChange={handleInputChange} icon={User} label="Full Name *" placeholder="Enter student's full name" />
                      <InputField name="studentId" value={formData.studentId} onChange={handleInputChange} icon={IdCard} label="Student ID *" placeholder="Enter unique student ID" />
                      <InputField name="email" value={formData.email} onChange={handleInputChange} icon={Mail} label="Email Address *" placeholder="Enter student's email" type="email" disabled={userType === 'student'} />
                      <InputField name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} icon={Phone} label="Phone Number *" placeholder="Enter 10-digit phone number" type="tel" />
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 border-2 border-emerald-200 shadow-lg">
                    <h3 className="text-xl font-bold text-slate-900 mb-5">Academic Details</h3>
                    <div className="space-y-4">
                      <SelectField
                        name="department"
                        value={formData.department}
                        onChange={handleInputChange}
                        icon={Building}
                        label="Department *"
                        options={departments}
                        placeholder="Select Department"
                        disabled={userType === 'teacher' && !!localStorage.getItem('department')}
                      />
                      <SelectField name="year" value={formData.year} onChange={handleInputChange} icon={Calendar} label="Year *" options={years} placeholder="Select Academic Year" />
                      <SelectField name="division" value={formData.division} onChange={handleInputChange} icon={Users} label="Division *" options={divisions} placeholder="Select Division" prefix="Division " />
                      <SelectField name="semester" value={formData.semester} onChange={handleInputChange} icon={BookOpen} label="Semester *" options={semesters} placeholder="Select Semester" prefix="Semester " />
                    </div>
                  </div>
                </div>
                <div className="mt-6">
                  <button type="submit"
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-bold text-lg transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl group">
                    <span>Continue to Photo Capture</span>
                    <Camera className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    <ArrowLeft className="w-5 h-5 rotate-180 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-6 sm:p-8 border-2 border-slate-200 shadow-2xl">
              <div className="text-center mb-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Face Recognition Setup</h2>
                <p className="text-slate-600 text-sm sm:text-base">Capture 5 clear photos for accurate face recognition</p>
              </div>
              <MultiCameraCapture onCapture={handlePhotoCapture} />
              <div className="mt-6 flex justify-center max-w-lg mx-auto">
                <button onClick={() => setStep(1)}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold border-2 border-slate-300 hover:border-slate-400 transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center gap-2 text-sm">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Student Details
                </button>
              </div>
            </div>
          )}

          {status && (
            <div className="mt-4 text-center">
              <div className={`inline-block px-6 py-3 rounded-xl font-semibold border-2 transition-all duration-300 ${
                status.includes('✅') ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : status.includes('❌') ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>{status}</div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
