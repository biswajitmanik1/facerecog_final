import { Camera, Shield, BarChart3, Clock, Users, FileSpreadsheet } from 'lucide-react'

const features = [
  {
    icon: <Camera className="w-8 h-8" />,
    title: 'Face Recognition',
    description: 'Advanced AI-powered face recognition marks attendance automatically in real-time.',
    color: 'from-blue-500 to-blue-600',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  {
    icon: <Shield className="w-8 h-8" />,
    title: 'Secure & Reliable',
    description: 'JWT-based authentication with role-based access control for students, teachers, and admins.',
    color: 'from-emerald-500 to-emerald-600',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    icon: <BarChart3 className="w-8 h-8" />,
    title: 'Analytics Dashboard',
    description: 'Comprehensive attendance statistics, trends, and department-level reports at a glance.',
    color: 'from-purple-500 to-purple-600',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
  {
    icon: <Clock className="w-8 h-8" />,
    title: 'Real-time Marking',
    description: 'Attendance is marked instantly as students are recognized — no manual effort needed.',
    color: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  {
    icon: <Users className="w-8 h-8" />,
    title: 'Multi-role Access',
    description: 'Dedicated dashboards for students, teachers, and administrators with tailored features.',
    color: 'from-cyan-500 to-cyan-600',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
  },
  {
    icon: <FileSpreadsheet className="w-8 h-8" />,
    title: 'Excel Export',
    description: 'Export attendance data to Excel with one click for records and offline analysis.',
    color: 'from-rose-500 to-rose-600',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
  },
]

export default function FeatureSection() {
  return (
    <section className="py-24 px-4 bg-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-blue-400 font-semibold text-sm uppercase tracking-wider">Features</span>
          <h2 className="text-4xl font-bold text-white mt-2 mb-4">Everything You Need</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            A complete attendance management system powered by cutting-edge face recognition technology.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, idx) => (
            <div key={idx}
              className={`p-6 rounded-2xl border ${feature.bg} ${feature.border} hover:scale-105 transition-all duration-300 group`}>
              <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.color} mb-4 text-white shadow-lg group-hover:scale-110 transition-transform`}>
                {feature.icon}
              </div>
              <h3 className="text-white font-bold text-xl mb-2">{feature.title}</h3>
              <p className="text-gray-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
