import { useState, useRef, useEffect, useCallback } from 'react'
import { Camera, CheckCircle2, ArrowRight } from 'lucide-react'

const DIRECTIONS = ['Front', 'Left', 'Right', 'Up', 'Down']

/**
 * MultiCameraCapture — captures 5 directional face images for registration.
 * Props:
 *   onCapture(images: string[]) — called with array of 5 base64 image strings
 */
export default function MultiCameraCapture({ onCapture }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [captured, setCaptured] = useState([]) // array of base64 strings
  const [capturing, setCapturing] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    let active = true

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        if (!active) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (err) {
        console.error('Camera error:', err)
      }
    }

    startCamera()

    return () => {
      active = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  const captureOne = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    setCapturing(true)

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)

    const newCaptured = [...captured, dataUrl]
    setCaptured(newCaptured)

    setTimeout(() => {
      setCapturing(false)
      if (newCaptured.length < DIRECTIONS.length) {
        setCurrentIndex(newCaptured.length)
      } else {
        // All 5 captured — stop camera and call parent
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop())
        }
        onCapture(newCaptured)
      }
    }, 500)
  }, [captured, onCapture])

  const reset = () => {
    setCaptured([])
    setCurrentIndex(0)
  }

  const done = captured.length >= DIRECTIONS.length

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-2 justify-center flex-wrap">
        {DIRECTIONS.map((dir, idx) => (
          <div key={dir} className={`flex items-center gap-1 px-3 py-2 rounded-xl border-2 transition-all text-sm font-semibold ${
            idx < captured.length
              ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
              : idx === currentIndex
              ? 'bg-blue-50 border-blue-400 text-blue-700 scale-105'
              : 'bg-slate-50 border-slate-300 text-slate-500'
          }`}>
            {idx < captured.length ? <CheckCircle2 className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
            {dir}
          </div>
        ))}
      </div>

      {/* Camera */}
      {!done && (
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-slate-700 font-bold text-lg">
              Photo {currentIndex + 1} of {DIRECTIONS.length}: Look <span className="text-blue-600">{DIRECTIONS[currentIndex]}</span>
            </p>
            <p className="text-slate-500 text-sm mt-1">
              Position your face clearly and click Capture
            </p>
          </div>

          <div className="relative rounded-xl overflow-hidden border-2 border-slate-200 bg-black">
            <video ref={videoRef} autoPlay muted playsInline className="w-full" style={{ display: 'block' }} />
            {capturing && (
              <div className="absolute inset-0 bg-white/40 flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-blue-500 rounded-full animate-spin border-t-transparent" />
              </div>
            )}
          </div>

          <button
            onClick={captureOne}
            disabled={capturing}
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold rounded-xl transition-all duration-300 hover:scale-105 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" />
            {capturing ? 'Capturing...' : `Capture ${DIRECTIONS[currentIndex]} Photo`}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {done && (
        <div className="text-center py-8">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-800 mb-2">All 5 Photos Captured!</h3>
          <p className="text-slate-600">Submitting for registration…</p>
        </div>
      )}

      {captured.length > 0 && !done && (
        <button onClick={reset} className="w-full py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm">
          Reset & Start Over
        </button>
      )}
    </div>
  )
}
