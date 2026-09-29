import React, { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, CheckCircle2, MapPin, Key, ArrowLeft, RefreshCw, Hash } from 'lucide-react'
import { apiFetch } from '../../lib/api.js'

export default function SelfMarkAttendance() {
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  const [step, setStep] = useState('form')   // form | camera | submitting | success | error
  const [sessionId, setSessionId] = useState('')
  const [code, setCode] = useState('')
  const [gpsStatus, setGpsStatus] = useState('idle')  // idle | capturing | captured | denied
  const [gps, setGps] = useState(null)
  const [capturedImage, setCapturedImage] = useState(null)
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

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
    if (!sessionId.trim() || !code.trim()) {
      setErrorMsg('Please enter Session ID and the 4-digit code first.')
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
        session_id: parseInt(sessionId),
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
  }, [sessionId, code])

  const reset = () => {
    stopCamera()
    setStep('form')
    setCode('')
    setCapturedImage(null)
    setResult(null)
    setErrorMsg('')
    setGps(null)
    setGpsStatus('idle')
  }

  // ── UI ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#eef2fb' }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          <button onClick={() => { stopCamera(); navigate('/dashboard') }} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="p-2 bg-indigo-600 rounded-xl">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Mark My Attendance</h1>
            <p className="text-xs text-gray-500">Session code + selfie verification</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto p-5">

        {/* ── Step: Form ── */}
        {step === 'form' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-base font-bold text-gray-800 mb-5">Enter Session Details</h2>

            {/* Session ID */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Session ID
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  placeholder="e.g. 42 (shown by teacher)"
                  value={sessionId}
                  onChange={e => setSessionId(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-base"
                />
              </div>
            </div>

            {/* Code */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                4-Digit Code from Projector
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  placeholder="e.g. 7342"
                  maxLength={4}
                  value={code}
                  onChange={e => setCode(e.target.value.slice(0, 4))}
                  className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-2xl font-black tracking-widest text-center"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                {errorMsg}
              </div>
            )}

            {/* Info */}
            <div className="mb-5 p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-sm text-indigo-700">
              <p className="font-semibold mb-1">📍 Location will be checked</p>
              <p className="text-indigo-600">Allow location permission when prompted. You must be physically in the classroom.</p>
            </div>

            <button
              onClick={openCamera}
              className="w-full py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5" /> Open Camera & Verify
            </button>
          </div>
        )}

        {/* ── Step: Camera ── */}
        {step === 'camera' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-base font-bold text-gray-800 mb-4 text-center">Take Your Selfie</h2>
            <p className="text-sm text-gray-500 text-center mb-4">Face the camera directly. Make sure your face is clearly visible.</p>

            <div className="relative rounded-xl overflow-hidden bg-black mb-4">
              <video ref={videoRef} autoPlay playsInline muted className="w-full" />
              {/* Face guide oval */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-60 border-4 border-white/60 rounded-full" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)' }} />
              </div>
            </div>

            <canvas ref={canvasRef} className="hidden" />

            <button
              onClick={captureAndSubmit}
              className="w-full py-4 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 text-lg"
            >
              <Camera className="w-5 h-5" /> Capture & Submit
            </button>

            <button onClick={reset} className="w-full mt-3 py-2.5 rounded-xl font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors text-sm">
              Cancel
            </button>
          </div>
        )}

        {/* ── Step: Submitting ── */}
        {step === 'submitting' && (
          <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
            <p className="text-lg font-bold text-gray-800 mb-1">Verifying...</p>
            <p className="text-sm text-gray-500">Checking code → GPS → face match</p>

            {capturedImage && (
              <img src={capturedImage} alt="Captured" className="w-24 h-24 rounded-full object-cover mx-auto mt-5 border-4 border-indigo-100" />
            )}

            <div className="mt-5 space-y-2">
              <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-xl text-sm text-indigo-700 font-medium">
                <Key className="w-4 h-4" /> Validating session code...
              </div>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${gpsStatus === 'captured' ? 'bg-emerald-50 text-emerald-700' : gpsStatus === 'denied' ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500'}`}>
                <MapPin className="w-4 h-4" />
                {gpsStatus === 'capturing' ? 'Getting GPS location...' : gpsStatus === 'captured' ? 'Location verified ✓' : gpsStatus === 'denied' ? 'GPS denied — skipped' : 'Waiting for GPS...'}
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-xl text-sm text-purple-700 font-medium">
                <Camera className="w-4 h-4" /> Running face recognition...
              </div>
            </div>
          </div>
        )}

        {/* ── Step: Success ── */}
        {step === 'success' && result && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-black text-gray-800 mb-1">Present! ✅</h2>
            <p className="text-gray-500 mb-5">{result.message}</p>

            <div className="space-y-2 text-left mb-6">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Student</span>
                <span className="text-sm font-bold text-gray-800">{result.student_name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Subject</span>
                <span className="text-sm font-bold text-gray-800">{result.subject}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Date</span>
                <span className="text-sm font-bold text-gray-800">{result.date}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-gray-500">Face Confidence</span>
                <span className="text-sm font-bold text-emerald-600">{result.confidence}%</span>
              </div>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {/* ── Step: Error ── */}
        {step === 'error' && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">❌</span>
            </div>
            <h2 className="text-xl font-black text-gray-800 mb-2">Verification Failed</h2>
            <p className="text-red-600 font-medium mb-6">{errorMsg}</p>

            {capturedImage && (
              <img src={capturedImage} alt="Captured" className="w-20 h-20 rounded-full object-cover mx-auto mb-5 border-4 border-red-100 opacity-60" />
            )}

            <button
              onClick={reset}
              className="w-full py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
