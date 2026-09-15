import { useRef, useEffect, useCallback } from 'react'

/**
 * CameraCapture — high-performance webcam component with face bounding box overlay.
 *
 * Props:
 *   onCapture(dataUrl)   — called with a base64 image when capturing (can be async)
 *   captureIntervalMs    — interval in ms for live mode (default 700ms for fast recognition)
 *   singleShot           — if true, capture once then stop
 *   isLiveMode           — if true, capture continuously at captureIntervalMs
 *   facesData            — array of { box: [x,y,w,h], match: { name } | null }
 */
export default function CameraCapture({
  onCapture,
  captureIntervalMs = 700,
  singleShot = false,
  isLiveMode = false,
  facesData = [],
}) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  const isBusyRef = useRef(false)

  // Fast frame capture with downscaling & compression
  const captureFrame = useCallback(async () => {
    if (isBusyRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return

    isBusyRef.current = true
    try {
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

      canvas.width = targetW
      canvas.height = targetH
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(video, 0, 0, targetW, targetH)

      // 0.72 quality provides optimal balance of speed (small bytes) and deep learning recognition accuracy
      const dataUrl = canvas.toDataURL('image/jpeg', 0.72)
      if (onCapture) {
        await onCapture(dataUrl)
      }
    } catch (err) {
      console.error('Capture frame error:', err)
    } finally {
      isBusyRef.current = false
    }
  }, [onCapture])

  // Start webcam with low-latency constraints
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
        console.error('Camera access error:', err)
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

  // Live capture timer loop
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (isLiveMode && !singleShot) {
      // Immediate first capture
      const initialTimer = setTimeout(captureFrame, 200)
      intervalRef.current = setInterval(captureFrame, captureIntervalMs)

      return () => {
        clearTimeout(initialTimer)
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isLiveMode, singleShot, captureFrame, captureIntervalMs])

  // Draw face recognition bounding box overlay on top of video
  useEffect(() => {
    const overlay = overlayRef.current
    const video = videoRef.current
    if (!overlay || !video) return

    const ctx = overlay.getContext('2d')
    const vw = video.videoWidth || 640
    const vh = video.videoHeight || 480
    overlay.width = vw
    overlay.height = vh

    ctx.clearRect(0, 0, vw, vh)

    if (facesData && facesData.length > 0) {
      facesData.forEach(face => {
        if (!face.box) return
        const [x, y, w, h] = face.box
        const matched = face.match !== null && face.match !== undefined

        ctx.strokeStyle = matched ? '#22c55e' : '#ef4444'
        ctx.lineWidth = 3
        ctx.strokeRect(x, y, w, h)

        if (matched && face.match?.name) {
          ctx.font = 'bold 16px sans-serif'
          const label = `✓ ${face.match.name}`
          const textWidth = ctx.measureText(label).width
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
          ctx.fillRect(x, Math.max(0, y - 26), textWidth + 12, 22)
          ctx.fillStyle = '#4ade80'
          ctx.fillText(label, x + 6, Math.max(16, y - 9))
        }
      })
    }
  }, [facesData])

  return (
    <div className="relative overflow-hidden rounded-xl bg-slate-950 flex items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-auto object-cover rounded-xl"
        style={{ display: 'block' }}
      />
      <canvas
        ref={overlayRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
      <canvas ref={canvasRef} className="hidden" />
      {singleShot && (
        <button
          onClick={captureFrame}
          className="mt-3 w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all"
        >
          📸 Capture Photo
        </button>
      )}
    </div>
  )
}
