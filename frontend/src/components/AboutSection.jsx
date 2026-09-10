const badges = [
  { label: 'Python', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { label: 'FastAPI', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { label: 'OpenCV', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { label: 'React', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  { label: 'Tailwind CSS', color: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
  { label: 'PostgreSQL', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  { label: 'Face Recognition', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { label: 'JWT Auth', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
]

export default function AboutSection() {
  return (
    <section id="about" className="py-24 px-4 bg-gray-900">
      <div className="max-w-4xl mx-auto text-center">
        <span className="text-emerald-400 font-semibold text-sm uppercase tracking-wider">About</span>
        <h2 className="text-4xl font-bold text-white mt-2 mb-6">Built with Modern Tech</h2>
        <p className="text-gray-400 text-lg leading-relaxed mb-10">
          Smart Attendance combines a high-performance Python/FastAPI backend with an OpenCV-powered face recognition pipeline, 
          a React frontend, and PostgreSQL (JSONB) storage. Designed for real educational institutions looking to 
          streamline the attendance process and reduce manual overhead.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          {badges.map(badge => (
            <span key={badge.label}
              className={`px-4 py-2 rounded-full text-sm font-semibold border ${badge.color}`}>
              {badge.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
