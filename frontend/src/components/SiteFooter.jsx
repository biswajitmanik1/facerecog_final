import { useLocation } from 'react-router-dom'
import { Camera } from 'lucide-react'

const HIDDEN_PATHS = ['/signin', '/signup']

export default function SiteFooter() {
  const location = useLocation()

  if (HIDDEN_PATHS.includes(location.pathname)) return null

  return (
    <footer className="bg-gray-900/80 border-t border-gray-800 py-4 text-center text-gray-500 text-sm">
      <div className="flex items-center justify-center gap-2">
        <Camera className="w-4 h-4" />
        <span>Smart College — AI-Powered Attendance Management</span>
      </div>
    </footer>
  )
}
