import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, CheckCircle2, MapPin, Key, ArrowLeft, RefreshCw, BookOpen, Clock, AlertTriangle } from 'lucide-react'
import { apiFetch } from '../../lib/api.js'

export default function SelfMarkAttendance() {
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  const [step, setStep] = useState('loading')   // loading | form | no_session | already_marked | camera | submitting | success | error
  const [activeSession, setActiveSession] = useState(null)
  const [code, setCode] = useState('')
  const [gpsStatus, setGpsStatus] = useState('idle')  // idle | capturing | captured | denied
  const [gps, setGps] = useState(null)
  const [capturedImage, setCapturedImage] = useState(null)
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [checkingSession, setCheckingSession] = useState(false)

  // ── Fetch Active Session for this student's class ─────────────
  const fetchActiveSession = useCallback(async () => {
    setCheckingSession(true)
    setErrorMsg('')
    try {
      const res = await apiFetch('/api/attendance/my-active-session')
      const data = await res.json()
      if (data.success && data.session_id) {
        setActiveSession(data)
        if (data.already_marked) {
          setStep('already_marked')
        } else {
          setStep('form')
        }
      } else {
        setActiveSession(null)
        setStep('no_session')
        setErrorMsg(data.error || 'No active session found.')
      }
    } catch (err) {
      setActiveSession(null)
      setStep('no_session')
      setErrorMsg('Could not connect to server. Please try again.')
    } finally {
      setCheckingSession(false)
    }
  }, [])

  useEffect(() => {
    fetchActiveSession()
  }, [fetchActiveSession])

  // ── GPS ──────────────────────────────────────────────────────────
  const getGps = () => new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return }
    setGpsStatus('capturing')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setGps(coords)
        setGpsStatus('captured')
        resolve(coords)
      },
      () => { setGpsStatus('denied'); resolve(null) },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  })

  // ── Camera ───────────────────────────────────────────────────────
  const openCamera = async () => {
    if (!code.trim()) {
      setErrorMsg('Please enter the 4-digit code shown on the projector.')
      return
    }
    if (code.trim().length !== 4 || isNaN(Number(code))) {
      setErrorMsg('Code must be exactly 4 digits.')
      return
    }
    setErrorMsg('')
    setStep('camera')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      setErrorMsg('Camera access denied. Please allow camera permission.')
      setStep('form')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }

  const captureAndSubmit = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return

    // Capture frame
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d').drawImage(video, 0, 0)
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85)
    setCapturedImage(imageDataUrl)
    stopCamera()
    setStep('submitting')

    // Get GPS
    const coords = await getGps()

    // Submit
    try {
      const payload = {
        session_id: activeSession?.session_id,
        code: code.trim().padStart(4, '0'),
        image: imageDataUrl,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      }
      const res = await apiFetch('/api/attendance/student-self-mark', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      if (data.success) {
        setResult(data)
        setStep('success')
      } else {
        setErrorMsg(data.error || 'Attendance marking failed.')
        setStep('error')
      }
    } catch (err) {
      setErrorMsg('Network error. Please try again.')
      setStep('error')
    }
  }, [activeSession, code])

  const reset = () => {
    stopCamera()
    setCode('')
    setCapturedImage(null)
    setResult(null)
    setErrorMsg('')
    setGps(null)
    setGpsStatus('idle')
    fetchActiveSession()
  }

  // ── UI ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#eef2fb' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { stopCamera(); navigate('/dashboard') }}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="p-2 bg-indigo-600 rounded-xl shadow-xs">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">Mark Attendance</h1>
              <p className="text-xs text-gray-500">Live 4-digit code + selfie check</p>
            </div>
          </div>

          <button
            onClick={fetchActiveSession}
            disabled={checkingSession}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors border border-gray-200"
            title="Check for active session"
          >
            <RefreshCw className={`w-4 h-4 ${checkingSession ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto p-5">

        {/* ── Step: Loading ── */}
        {step === 'loading' && (
          <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center">
            <div className="w-12 h-12 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-base font-bold text-gray-800">Searching for Live Session...</p>
            <p className="text-xs text-gray-500 mt-1">Connecting to your class schedule</p>
          </div>
        )}

        {/* ── Step: No Active Session ── */}
        {step === 'no_session' && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">No Active Session</h2>
            <p className="text-sm text-gray-500 mb-6">
              There is no live attendance session running for your department and class right now. Please wait for your teacher to initiate the session.
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={fetchActiveSession}
                className="w-full py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Check Again
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-3 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors text-sm"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Already Marked ── */}
        {step === 'already_marked' && activeSession && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-200">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Already Marked Present! ✅</h2>
            <p className="text-sm text-gray-500 mb-6">
              You are already verified and marked present for <span className="font-bold text-gray-700">{activeSession.subject}</span> today.
            </p>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {/* ── Step: Form (Only 4-digit code required!) ── */}
        {step === 'form' && activeSession && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            {/* Live Session Badge */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 mb-5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Session Active
                </span>
                {activeSession.gps_enabled ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                    <MapPin className="w-3 h-3" /> GPS Protected
                  </span>
                ) : null}
              </div>
              <p className="text-lg font-black text-gray-900">{activeSession.subject}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {activeSession.department} • {activeSession.year} • Div {activeSession.division}
              </p>
            </div>

            {/* Code Input */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Enter 4-Digit Code from Projector
              </label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400" />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="• • • •"
                  maxLength={4}
                  autoFocus
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full pl-12 pr-4 py-3.5 border-2 border-indigo-200 rounded-xl text-gray-900 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 text-3xl font-black tracking-[0.5em] text-center transition-all"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-2 text-center">
                Look at the code currently shown on the classroom screen.
              </p>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              onClick={openCamera}
              className="w-full py-4 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 text-base shadow-sm cursor-pointer"
            >
              <Camera className="w-5 h-5" /> Open Camera & Verify
            </button>
          </div>
        )}

        {/* ── Step: Camera ── */}
        {step === 'camera' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-base font-bold text-gray-800 mb-1 text-center">Take Live Selfie</h2>
            <p className="text-xs text-gray-500 text-center mb-4">Face the camera directly in clear light.</p>

            <div className="relative rounded-2xl overflow-hidden bg-black mb-4 aspect-[4/3]">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {/* Face guide oval */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-44 h-56 border-3 border-white/70 rounded-full" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)' }} />
              </div>
            </div>

            <canvas ref={canvasRef} className="hidden" />

            <button
              onClick={captureAndSubmit}
              className="w-full py-4 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 text-lg shadow-sm cursor-pointer"
            >
              <Camera className="w-5 h-5" /> Capture & Submit
            </button>

            <button
              onClick={() => { stopCamera(); setStep('form') }}
              className="w-full mt-2.5 py-2.5 rounded-xl font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── Step: Submitting ── */}
        {step === 'submitting' && (
          <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
            <p className="text-lg font-bold text-gray-800 mb-1">Verifying...</p>
            <p className="text-xs text-gray-500">Checking code → GPS location → face biometric</p>

            {capturedImage && (
              <img src={capturedImage} alt="Captured" className="w-20 h-20 rounded-full object-cover mx-auto mt-4 border-3 border-indigo-100 shadow-xs" />
            )}

            <div className="mt-5 space-y-2 text-left">
              <div className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 rounded-xl text-xs text-indigo-700 font-semibold">
                <Key className="w-4 h-4 flex-shrink-0" /> Validating 4-digit code...
              </div>
              <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold ${gpsStatus === 'captured' ? 'bg-emerald-50 text-emerald-700' : gpsStatus === 'denied' ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500'}`}>
                <MapPin className="w-4 h-4 flex-shrink-0" />
                {gpsStatus === 'capturing' ? 'Capturing GPS coordinates...' : gpsStatus === 'captured' ? 'Location verified ✓' : gpsStatus === 'denied' ? 'GPS permission skipped' : 'Checking classroom distance...'}
              </div>
              <div className="flex items-center gap-2 px-3.5 py-2 bg-purple-50 rounded-xl text-xs text-purple-700 font-semibold">
                <Camera className="w-4 h-4 flex-shrink-0" /> Comparing face biometrics...
              </div>
            </div>
          </div>
        )}

        {/* ── Step: Success ── */}
        {step === 'success' && result && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-emerald-200">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-black text-gray-800 mb-1">Present! ✅</h2>
            <p className="text-sm text-gray-500 mb-5">{result.message}</p>

            <div className="space-y-2 text-left mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="text-gray-500 font-medium">Student</span>
                <span className="font-bold text-gray-800">{result.student_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="text-gray-500 font-medium">Subject</span>
                <span className="font-bold text-gray-800">{result.subject}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="text-gray-500 font-medium">Date</span>
                <span className="font-bold text-gray-800">{result.date}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500 font-medium">Face Match</span>
                <span className="font-bold text-emerald-600">{result.confidence}% Match</span>
              </div>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {/* ── Step: Error ── */}
        {step === 'error' && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-200">
              <span className="text-4xl">❌</span>
            </div>
            <h2 className="text-xl font-black text-gray-800 mb-2">Verification Failed</h2>
            <p className="text-sm text-red-600 font-medium mb-6">{errorMsg}</p>

            {capturedImage && (
              <img src={capturedImage} alt="Captured" className="w-20 h-20 rounded-full object-cover mx-auto mb-5 border-4 border-red-100 opacity-60" />
            )}

            <button
              onClick={reset}
              className="w-full py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
