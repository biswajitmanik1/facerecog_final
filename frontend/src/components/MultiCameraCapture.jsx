import { useState, useRef, useEffect, useCallback } from 'react'
import { Camera, CheckCircle2, ArrowRight, Zap, RotateCcw, Sparkles } from 'lucide-react'

const DIRECTIONS = ['Front', 'Left', 'Right', 'Up', 'Down']

/**
 * MultiCameraCapture — high-performance 5-angle face capture with instant & auto modes.
 * Props:
 *   onCapture(images: string[]) — called with array of 5 base64 image strings
 */
export default function MultiCameraCapture({ onCapture }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [captured, setCaptured] = useState([]) // array of base64 strings
  const [shutterFlash, setShutterFlash] = useState(false)
  const [isAutoMode, setIsAutoMode] = useState(false)
  const [countdown, setCountdown] = useState(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const autoTimerRef = useRef(null)

  // Start camera with optimized low-latency settings
  useEffect(() => {
    let active = true

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 },
            facingMode: 'user',
          },
        })
        if (!active) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
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
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
    }
  }, [])

  // Fast frame snapshot with downsampling
  const snapFrame = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return null

    const vw = video.videoWidth || 640
    const vh = video.videoHeight || 480
    const maxDim = 640

    let targetW = vw
    let targetH = vh
    if (vw > maxDim || vh > maxDim) {
      if (vw >= vh) {
        targetH = Math.round((vh / vw) * maxDim)
        targetW = maxDim
      } else {
        targetW = Math.round((vw / vh) * maxDim)
        targetH = maxDim
      }
    }

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, targetW, targetH)
    return canvas.toDataURL('image/jpeg', 0.76)
  }, [])

  // Fast single capture (manual or auto)
  const executeCapture = useCallback(() => {
    const dataUrl = snapFrame()
    if (!dataUrl) return

    // Visual camera shutter flash
    setShutterFlash(true)
    setTimeout(() => setShutterFlash(false), 90)

    setCaptured(prev => {
      const nextList = [...prev, dataUrl]
      if (nextList.length < DIRECTIONS.length) {
        setCurrentIndex(nextList.length)
      } else {
        // Complete! Stop stream and forward to parent
        setIsAutoMode(false)
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop())
        }
        onCapture(nextList)
      }
      return nextList
    })
  }, [snapFrame, onCapture])

  // Auto Fast-Capture Mode (Hands-Free Countdown)
  useEffect(() => {
    if (!isAutoMode) {
      setCountdown(null)
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
      return
    }

    if (captured.length >= DIRECTIONS.length) {
      setIsAutoMode(false)
      return
    }

    // Step-by-step countdown for each pose: 2 -> 1 -> SNAP
    setCountdown(2)
    const t1 = setTimeout(() => setCountdown(1), 700)
    const t2 = setTimeout(() => {
      setCountdown(null)
      executeCapture()
    }, 1400)

    autoTimerRef.current = t2

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [isAutoMode, captured.length, executeCapture])

  const handleStartAuto = () => {
    setIsAutoMode(true)
  }

  const handleCancelAuto = () => {
    setIsAutoMode(false)
    setCountdown(null)
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
  }

  const reset = () => {
    handleCancelAuto()
    setCaptured([])
    setCurrentIndex(0)
  }

  const done = captured.length >= DIRECTIONS.length

  return (
    <div className="space-y-5">
      {/* Progress Pills */}
      <div className="flex items-center gap-2 justify-center flex-wrap">
        {DIRECTIONS.map((dir, idx) => {
          const isDone = idx < captured.length
          const isCurrent = idx === currentIndex && !done
          return (
            <div
              key={dir}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border-2 transition-all text-xs sm:text-sm font-bold shadow-xs ${
                isDone
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                  : isCurrent
                  ? 'bg-blue-600 border-blue-600 text-white scale-105 shadow-md animate-pulse'
                  : 'bg-white border-slate-200 text-slate-400'
              }`}
            >
              {isDone ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Camera className="w-4 h-4" />}
              <span>{dir}</span>
            </div>
          )
        })}
      </div>

      {/* Camera Preview */}
      {!done && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-blue-700 text-sm font-bold mb-1">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Pose {currentIndex + 1} of {DIRECTIONS.length}: Look {DIRECTIONS[currentIndex]}</span>
            </div>
            <p className="text-slate-500 text-xs">
              {isAutoMode
                ? `Hold still! Auto-capturing ${DIRECTIONS[currentIndex]} pose...`
                : 'Turn your head slightly in the indicated direction and snap'}
            </p>
          </div>

          <div className="relative max-w-lg mx-auto rounded-2xl overflow-hidden border-2 border-slate-300 bg-slate-950 shadow-xl aspect-[4/3] max-h-[340px] flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ display: 'block' }}
            />

            {/* Oval Face Alignment Frame */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className={`w-44 h-56 border-2 border-dashed rounded-[50%] transition-colors duration-300 ${
                isAutoMode ? 'border-emerald-400/80 shadow-emerald-500/20' : 'border-white/40'
              }`} />
            </div>

            {/* Shutter Flash Animation */}
            {shutterFlash && (
              <div className="absolute inset-0 bg-white opacity-85 z-30 transition-opacity duration-100" />
            )}

            {/* Countdown Overlay during Auto-Capture */}
            {isAutoMode && countdown !== null && (
              <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs flex flex-col items-center justify-center z-20">
                <div className="w-20 h-20 rounded-full bg-blue-600/90 text-white flex items-center justify-center text-4xl font-extrabold shadow-2xl border-4 border-white/60 animate-ping">
                  {countdown}
                </div>
                <p className="text-white text-base font-bold mt-4 drop-shadow-md">
                  Look {DIRECTIONS[currentIndex]}!
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons: Auto Mode + Fast Manual Capture */}
          <div className="max-w-lg mx-auto space-y-2.5">
            {!isAutoMode ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleStartAuto}
                  className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-md hover:shadow-lg text-sm"
                >
                  <Zap className="w-4 h-4" />
                  ⚡ Auto Fast-Capture (Hands-Free)
                </button>

                <button
                  type="button"
                  onClick={executeCapture}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 shadow-md hover:shadow-lg text-sm"
                >
                  <Camera className="w-4 h-4" />
                  Snap {DIRECTIONS[currentIndex]} Now
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleCancelAuto}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-md text-sm"
              >
                ⏸ Pause Auto-Capture (Switch to Manual)
              </button>
            )}

            {captured.length > 0 && (
              <button
                type="button"
                onClick={reset}
                className="w-full py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset & Retake Photos
              </button>
            )}
          </div>
        </div>
      )}

      {/* Thumbnail Strip */}
      {captured.length > 0 && (
        <div className="max-w-lg mx-auto bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Captured Angles ({captured.length}/5)
            </span>
            {done && (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ready to Register
              </span>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {DIRECTIONS.map((dir, idx) => (
              <div
                key={dir}
                className={`relative aspect-square rounded-lg overflow-hidden border-2 flex items-center justify-center bg-slate-200 ${
                  idx < captured.length ? 'border-emerald-500 shadow-xs' : 'border-dashed border-slate-300'
                }`}
              >
                {idx < captured.length ? (
                  <>
                    <img src={captured[idx]} alt={dir} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 inset-x-0 bg-slate-900/75 text-white text-[10px] text-center py-0.5 font-bold">
                      {dir}
                    </div>
                  </>
                ) : (
                  <span className="text-[10px] text-slate-400 font-semibold">{dir}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completion Confirmation */}
      {done && (
        <div className="text-center py-6 bg-emerald-50/70 rounded-2xl border-2 border-emerald-200 max-w-lg mx-auto">
          <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-3 animate-bounce" />
          <h3 className="text-xl font-bold text-slate-800 mb-1">All 5 Angles Captured!</h3>
          <p className="text-slate-600 text-sm">Processing embeddings and saving registration…</p>
        </div>
      )}
    </div>
  )
}
