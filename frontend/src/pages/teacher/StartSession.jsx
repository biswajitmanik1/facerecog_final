import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera,
  Play,
  Square,
  Calendar,
  BookOpen,
  Users,
  CheckCircle2,
  LayoutDashboard,
  MapPin,
  RefreshCw,
  Key,
  XCircle,
  AlertTriangle,
  ArrowRight
} from 'lucide-react'
import CameraCapture from '../../components/CameraCapture.jsx'
import { apiFetch } from '../../lib/api.js'

export default function StartSession() {
  const navigate = useNavigate()
  const userType = localStorage.getItem('userType') || ''
  const teacherDept = userType === 'teacher' ? (localStorage.getItem('department') || '') : ''

  const [sessionId, setSessionId] = useState(null)
  const [sessionActive, setSessionActive] = useState(false)
  const [recognitionStarted, setRecognitionStarted] = useState(false)
  const [status, setStatus] = useState('')
  const [facesData, setFacesData] = useState([])
  const [recognizedStudents, setRecognizedStudents] = useState([])
  const [finalizing, setFinalizing] = useState(false)
  const [sessionSummary, setSessionSummary] = useState(null)
  const [form, setForm] = useState({
    date: '',
    subject: '',
    department: teacherDept || '',
    year: '',
    division: ''
  })

  // GPS state
  const [gpsStatus, setGpsStatus] = useState('idle') // idle | capturing | captured | denied
  const [teacherGps, setTeacherGps] = useState(null)

  // Session code state
  const [sessionCode, setSessionCode] = useState(null)
  const [regeneratingCode, setRegeneratingCode] = useState(false)

  const fetchSessionCode = useCallback(async (sid) => {
    if (!sid) return
    try {
      const res = await apiFetch(`/api/attendance/session-code/${sid}`)
      const data = await res.json()
      if (data.success && data.code) {
        setSessionCode(data.code)
      }
    } catch (_) {}
  }, [])

  useEffect(() => {
    if (sessionId) {
      fetchSessionCode(sessionId)
    }
  }, [sessionId, fetchSessionCode])

  const handleRegenerateCode = async () => {
    if (!sessionId) return
    setRegeneratingCode(true)
    try {
      const res = await apiFetch(`/api/attendance/regenerate-code/${sessionId}`, { method: 'POST' })
      const data = await res.json()
      if (data.success && data.code) {
        setSessionCode(data.code)
        setStatus(`🔄 New 4-digit code generated: ${data.code}`)
      } else {
        setStatus(`❌ ${data.error || 'Failed to regenerate code'}`)
      }
    } catch (err) {
      console.error(err)
      setStatus('❌ Network error regenerating code')
    } finally {
      setRegeneratingCode(false)
    }
  }

  const captureGps = () => new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return }
    setGpsStatus('capturing')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const gps = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setTeacherGps(gps)
        setGpsStatus('captured')
        resolve(gps)
      },
      () => { setGpsStatus('denied'); resolve(null) },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  })

  const createSession = async () => {
    const activeDept = teacherDept || form.department
    if (!form.date || !form.subject || !activeDept || !form.year || !form.division) {
      setStatus('Please fill all fields')
      return
    }
    setStatus('Capturing your location...')
    const gps = await captureGps()

    setStatus('Creating session...')
    try {
      const payload = {
        ...form,
        department: activeDept,
        teacher_lat: gps?.lat ?? null,
        teacher_lng: gps?.lng ?? null,
        gps_radius: 10,
      }
      const res = await apiFetch('/api/attendance/create_session', { method: 'POST', body: JSON.stringify(payload) })
      const data = await res.json()
      if (data.session_id) {
        setSessionId(data.session_id)
        if (data.session_code) setSessionCode(data.session_code)
        setStatus(`✅ Session #${data.session_id} created! ${gps ? '📍 GPS enabled.' : '⚠️ No GPS — students can mark from anywhere.'}`)
        setSessionActive(true)
      } else {
        setStatus('❌ Failed to create session')
      }
    } catch (err) {
      console.error(err)
      setStatus('❌ Error creating session')
    }
  }

  const handleRecognize = useCallback(async (imageDataUrl) => {
    const payload = { image: imageDataUrl }
    if (sessionId) payload.session_id = sessionId
    else {
      if (form.department) payload.department = form.department
      if (form.year) payload.year = form.year
      if (form.division) payload.division = form.division
    }
    try {
      const res = await apiFetch('/api/attendance/real-mark', { method: 'POST', body: JSON.stringify(payload) })
      const data = await res.json()
      if (data.faces && data.faces.length > 0) {
        const face = data.faces[0]
        if (face.match) {
          setStatus(`✅ Recognized ${face.match.name}`)
          setRecognizedStudents(prev => prev.includes(face.match.name) ? prev : [...prev, face.match.name])
        } else {
          setStatus(face.message ? `⚠️ ${face.message}` : '❌ Face not recognized')
        }
        setFacesData(data.faces.map(f => ({ box: f.box, match: f.match })))
      } else {
        setStatus('❌ No faces detected')
        setFacesData([])
      }
    } catch (err) {
      console.error(err)
      setStatus('❌ Recognition failed')
      setFacesData([])
    }
  }, [sessionId, form])

  const handleEndSession = async () => {
    if (!sessionId) return
    const confirmed = window.confirm(
      "Are you sure you want to end and finalize this attendance session? All students not yet marked will be recorded as absent."
    )
    if (!confirmed) return

    setFinalizing(true)
    setStatus('Finalizing session and recording absentees...')
    setRecognitionStarted(false)

    try {
      const res = await apiFetch('/api/attendance/end_session', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId })
      })
      const data = await res.json()
      if (data.success) {
        setSessionSummary(data.statistics)
        setStatus(`✅ Session #${sessionId} finalized successfully!`)
      } else {
        setStatus(`❌ ${data.error || 'Failed to finalize session'}`)
      }
    } catch (err) {
      console.error(err)
      setStatus('❌ Network error while ending session')
    } finally {
      setFinalizing(false)
    }
  }

  const handleStartNewSession = () => {
    setSessionId(null)
    setSessionActive(false)
    setRecognitionStarted(false)
    setRecognizedStudents([])
    setFacesData([])
    setSessionSummary(null)
    setSessionCode(null)
    setStatus('')
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
            <div className="p-2.5 bg-purple-600 rounded-xl shadow-sm">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Attendance Session</h1>
              <p className="text-base text-gray-500">Live face recognition automated attendance</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-sm font-bold ${recognitionStarted ? 'bg-green-50 border-green-300 text-green-700' : 'bg-gray-100 border-gray-200 text-gray-600'}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${recognitionStarted ? 'bg-green-600 animate-pulse' : 'bg-gray-400'}`} />
              {recognitionStarted ? 'LIVE' : 'SETUP'}
            </div>

            <button
              onClick={() => navigate('/teacher/dashboard')}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base font-medium transition-colors shadow-sm"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Action / Control Sub-header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {sessionId && !sessionSummary ? (
              <>
                {recognitionStarted ? (
                  <button
                    onClick={() => { setRecognitionStarted(false); setStatus('Camera paused') }}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Square className="w-4 h-4" /> Pause Camera
                  </button>
                ) : (
                  <button
                    onClick={() => { setRecognitionStarted(true); setStatus('Starting live recognition...') }}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Play className="w-4 h-4" /> Start Camera
                  </button>
                )}

                <button
                  onClick={handleEndSession}
                  disabled={finalizing}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                  title="Finalize attendance and record absentees"
                >
                  <Square className="w-4 h-4 fill-current" />
                  {finalizing ? 'Ending...' : 'End & Finalize Session'}
                </button>
              </>
            ) : !sessionId && !recognitionStarted ? (
              <button
                onClick={() => { setSessionActive(false); setRecognitionStarted(true); setStatus('Starting demo recognition...') }}
                className="px-5 py-2.5 rounded-xl text-base font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Play className="w-4 h-4" /> Start Demo Recognition
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-4 text-base">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-gray-200 shadow-sm">
              <span className="text-gray-500 font-medium">Session:</span>
              <span className={`font-semibold ${sessionSummary ? 'text-indigo-600' : recognitionStarted ? 'text-green-600' : sessionId ? 'text-emerald-600' : 'text-gray-700'}`}>
                {sessionSummary ? 'Finalized' : recognitionStarted ? 'Camera Live' : sessionId ? 'Active' : 'Not Created'}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-gray-200 shadow-sm">
              <span className="text-gray-500 font-medium">Recognized:</span>
              <span className="font-bold text-gray-800">{recognizedStudents.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {sessionSummary ? (
          <div className="max-w-xl mx-auto bg-white rounded-3xl p-8 shadow-sm border border-gray-100 text-center animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-emerald-200">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-1">Session Finalized!</h2>
            <p className="text-sm text-gray-500 mb-6">Attendance has been recorded and finalized in the database.</p>

            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-100 text-center">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">Present</p>
                <p className="text-3xl font-black text-emerald-800">{sessionSummary.present_count ?? recognizedStudents.length}</p>
              </div>
              <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-100 text-center">
                <p className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-1">Absent</p>
                <p className="text-3xl font-black text-rose-800">{sessionSummary.absent_count ?? 0}</p>
              </div>
              <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-100 text-center">
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1">Total</p>
                <p className="text-3xl font-black text-indigo-800">{sessionSummary.total_students ?? 0}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleStartNewSession}
                className="flex-1 py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4" /> Start New Session
              </button>
              <button
                onClick={() => navigate('/teacher/dashboard')}
                className="flex-1 py-3.5 rounded-xl font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4" /> Go to Dashboard
              </button>
            </div>
          </div>
        ) : !sessionId ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Session Creation Form */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                <div className="p-2 bg-blue-50 rounded-xl">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Create Attendance Session</h2>
                  <p className="text-sm text-gray-500">Specify details before initiating facial recognition</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Date</label>
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Subject Name</label>
                  <input
                    type="text"
                    name="subject"
                    placeholder="e.g. Advanced Data Structures"
                    value={form.subject}
                    onChange={handleChange}
                    className={inputCls}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={labelCls}>Department</label>
                    {teacherDept && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                        🔒 Locked to your department
                      </span>
                    )}
                  </div>
                  {teacherDept ? (
                    <div className="flex items-center bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-medium text-sm">
                      <span>{teacherDept}</span>
                    </div>
                  ) : (
                    <select name="department" value={form.department} onChange={handleChange} className={selectCls}>
                      <option value="">Select Department</option>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Year</label>
                    <select name="year" value={form.year} onChange={handleChange} className={selectCls}>
                      <option value="">Select Year</option>
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Division</label>
                    <select name="division" value={form.division} onChange={handleChange} className={selectCls}>
                      <option value="">Select Division</option>
                      {divisions.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <button
                  onClick={createSession}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-base bg-emerald-500 hover:bg-emerald-600 text-white transition-colors flex items-center justify-center gap-2 mt-6 shadow-sm"
                >
                  <Calendar className="w-5 h-5" /> Initialize Session
                </button>

                {status && (
                  <div className={`p-3.5 rounded-xl text-base font-semibold text-center border ${status.includes('✅') ? 'bg-green-50 border-green-200 text-green-700' : status.includes('❌') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                    {status}
                  </div>
                )}
              </div>
            </div>

            {/* Instruction Guide */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                  <div className="p-2 bg-purple-50 rounded-xl">
                    <BookOpen className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Session Guidelines</h2>
                    <p className="text-sm text-gray-500">Best practices for accurate face recognition</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-100">
                    <h3 className="text-base font-bold text-purple-900 mb-2">1. Setup Session</h3>
                    <ul className="text-base text-purple-800 space-y-1.5">
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-purple-600 rounded-full" />
                        Enter the active subject, department, year, and division.
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-purple-600 rounded-full" />
                        Click "Initialize Session" to register a live tracking session.
                      </li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-green-50/70 border border-green-100">
                    <h3 className="text-base font-bold text-green-900 mb-2">2. Live Recognition</h3>
                    <ul className="text-base text-green-800 space-y-1.5">
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-green-600 rounded-full" />
                        Ensure room lighting is adequate and camera is steady.
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-green-600 rounded-full" />
                        Students should face the camera directly for instant match.
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-green-600 rounded-full" />
                        Attendance records are automatically stored in the database.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-700">
                💡 Need a quick dry run? Click <strong>"Start Demo Recognition"</strong> in the top toolbar to test the camera feed without saving to a specific class session.
              </div>
            </div>
          </div>
        ) : (
          /* Live Session View */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Camera View */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <Camera className="w-5 h-5 text-purple-600" />
                  <h2 className="text-xl font-bold text-gray-800">Live Camera Feed</h2>
                </div>
                <span className="text-sm font-semibold px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg">
                  {form.subject || 'Session Active'}
                </span>
              </div>

              {!recognitionStarted ? (
                <div className="text-center py-16 rounded-xl bg-gray-50 border border-dashed border-gray-300">
                  <div className="w-20 h-20 bg-white shadow-sm rounded-full flex items-center justify-center mx-auto mb-4">
                    <Play className="w-8 h-8 text-purple-600" />
                  </div>
                  <p className="text-lg text-gray-700 font-semibold mb-2">Session Ready to Begin</p>
                  <p className="text-base text-gray-500 mb-6 max-w-sm mx-auto">
                    Click the button below to turn on the camera and start matching faces.
                  </p>
                  <button
                    onClick={() => { setRecognitionStarted(true); setStatus('Starting live recognition...') }}
                    className="px-6 py-3.5 rounded-xl font-bold text-base bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-colors inline-flex items-center gap-2"
                  >
                    <Play className="w-5 h-5" /> Start Live Recognition
                  </button>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden bg-black/5 border border-gray-200">
                  <CameraCapture
                    isLiveMode={true}
                    onCapture={handleRecognize}
                    facesData={facesData}
                    captureIntervalMs={700}
                  />
                </div>
              )}
            </div>

            {/* Results Column */}
            <div className="space-y-6">

              {/* Session Code Panel */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-bold text-gray-800">Session Code</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-semibold border border-indigo-100">Show on Projector</span>
                  </div>
                  {teacherGps ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                      <MapPin className="w-3.5 h-3.5" /> GPS ON
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-amber-600 font-semibold">
                      <MapPin className="w-3.5 h-3.5" /> No GPS
                    </span>
                  )}
                </div>
                <div className="bg-indigo-600 rounded-2xl py-6 px-4 text-center mb-3 shadow-sm">
                  <p className="text-indigo-200 text-xs font-bold mb-2 uppercase tracking-widest">
                    Session #{sessionId} Passcode
                  </p>
                  <div className="flex items-center justify-center gap-3 mb-4">
                    {(sessionCode || '----').split('').map((digit, i) => (
                      <div key={i} className="w-14 h-16 bg-white rounded-xl flex items-center justify-center text-4xl font-black text-indigo-700 shadow-md">
                        {digit}
                      </div>
                    ))}
                  </div>

                  {/* Regenerate Code Button */}
                  <button
                    onClick={handleRegenerateCode}
                    disabled={regeneratingCode}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/80 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    title="Generate a new 4-digit code"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${regeneratingCode ? 'animate-spin' : ''}`} />
                    {regeneratingCode ? 'Generating...' : 'Regenerate Code'}
                  </button>
                </div>
                <p className="text-xs text-gray-400 text-center mt-2">Students: open app → Mark Attendance → enter 4-digit code + selfie</p>

                {/* Navigation tip */}
                <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">💡</span>
                  <div>
                    <p className="text-xs font-bold text-amber-800">Session stays active in the background</p>
                    <p className="text-xs text-amber-700 mt-0.5">You can go to Dashboard or switch accounts — the session code keeps working. Come back to end the session when done.</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-4">
                  <button
                    onClick={handleEndSession}
                    disabled={finalizing}
                    className="w-full py-3.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors text-base flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    {finalizing ? 'Finalizing Session...' : 'End & Finalize Session'}
                  </button>

                  <button
                    onClick={() => navigate('/teacher/dashboard')}
                    className="w-full py-2.5 rounded-xl font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors text-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LayoutDashboard className="w-4 h-4" /> Go to Dashboard (Keep Active)
                  </button>
                </div>
              </div>

              {/* Status card */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Recognition Status</h3>
                <div className={`p-4 rounded-xl border text-center font-bold text-lg ${status.includes('✅') ? 'bg-green-50 border-green-200 text-green-700' : status.includes('❌') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                  {status || 'Waiting for active face recognition...'}
                </div>
              </div>

              {/* Recognized Students List */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-lg font-bold text-gray-800">Recognized Students</h3>
                  </div>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold text-sm border border-emerald-200 rounded-lg">
                    {recognizedStudents.length} Present
                  </span>
                </div>

                {recognizedStudents.length > 0 ? (
                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {recognizedStudents.map((student, index) => (
                      <div
                        key={student}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 hover:bg-emerald-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-base font-bold text-gray-800">{student}</p>
                            <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Marked Present
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 font-mono">Recorded</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Users className="w-7 h-7 text-gray-400" />
                    </div>
                    <p className="text-base font-semibold text-gray-700">No students recognized yet</p>
                    <p className="text-sm text-gray-500 mt-1">Matched students will immediately appear here</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
