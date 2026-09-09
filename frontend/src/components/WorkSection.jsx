import { UserPlus, Camera, CheckCircle2, BarChart3 } from 'lucide-react'

const steps = [
  {
    icon: <UserPlus className="w-8 h-8" />,
    step: '01',
    title: 'Register',
    description: 'Students register with their details and capture 5-angle face photos for the recognition model.',
    color: 'from-blue-500 to-indigo-600',
  },
  {
    icon: <Camera className="w-8 h-8" />,
    step: '02',
    title: 'Start Session',
    description: 'Teacher or admin starts an attendance session for a specific class, subject, and date.',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    icon: <CheckCircle2 className="w-8 h-8" />,
    step: '03',
    title: 'Auto Mark',
    description: 'The live camera feed recognizes students\' faces and marks attendance automatically in real-time.',
    color: 'from-purple-500 to-violet-600',
  },
  {
    icon: <BarChart3 className="w-8 h-8" />,
    step: '04',
    title: 'View Reports',
    description: 'Access detailed attendance reports, filter by date/department, and export to Excel.',
    color: 'from-amber-500 to-orange-600',
  },
]

export default function WorkSection() {
  return (
    <section className="py-24 px-4 bg-gray-950">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-purple-400 font-semibold text-sm uppercase tracking-wider">How It Works</span>
          <h2 className="text-4xl font-bold text-white mt-2 mb-4">Simple 4-Step Process</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            From registration to reporting — everything automated with AI face recognition.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, idx) => (
            <div key={idx} className="relative text-center group">
              <div className="flex justify-center mb-4">
                <div className={`p-4 rounded-2xl bg-gradient-to-br ${step.color} text-white shadow-xl group-hover:scale-110 transition-transform duration-300`}>
                  {step.icon}
                </div>
              </div>
              <div className="text-gray-600 font-bold text-5xl absolute top-0 right-4 select-none">{step.step}</div>
              <h3 className="text-white font-bold text-xl mb-2">{step.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
