import { useRef, useEffect, useCallback } from 'react'

/**
 * CameraCapture — webcam component with face bounding box overlay.
 *
 * Props:
 *   onCapture(dataUrl)   — called with a base64 image when capturing
 *   captureIntervalMs    — interval in ms for live mode (default 2000)
 *   singleShot           — if true, capture once then stop
 *   isLiveMode           — if true, capture continuously at captureIntervalMs
 *   facesData            — array of { box: [x,y,w,h], match: { name } | null }
 */
export default function CameraCapture({
  onCapture,
  captureIntervalMs = 2000,
  singleShot = false,
  isLiveMode = false,
  facesData = [],
}) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)

  const captureFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const ctx = canvas.getContext('2d')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    // Draw bounding boxes
    if (facesData && facesData.length > 0) {
      facesData.forEach(face => {
        if (!face.box) return
        const [x, y, w, h] = face.box
        const matched = face.match !== null && face.match !== undefined

        ctx.strokeStyle = matched ? '#22c55e' : '#ef4444'
        ctx.lineWidth = 3
        ctx.strokeRect(x, y, w, h)

        if (matched && face.match?.name) {
          ctx.fillStyle = matched ? '#22c55e' : '#ef4444'
          ctx.font = '16px Arial'
          ctx.fillText(face.match.name, x, y - 8)
        }
      })
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    if (onCapture) onCapture(dataUrl)
  }, [facesData, onCapture])

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

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (isLiveMode && !singleShot) {
      intervalRef.current = setInterval(captureFrame, captureIntervalMs)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isLiveMode, singleShot, captureFrame, captureIntervalMs])

  return (
    <div className="relative">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full rounded-lg"
        style={{ display: 'block' }}
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
