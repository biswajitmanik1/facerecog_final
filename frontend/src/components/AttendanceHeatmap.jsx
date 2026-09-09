import { useState, useMemo } from 'react'
import {
  Flame,
  Trophy,
  Calendar,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info
} from 'lucide-react'

/**
 * Formats a Date object to YYYY-MM-DD local string safely.
 */
function toDateKey(d) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function AttendanceHeatmap({ records = [], totalClasses = 0 }) {
  const [selectedSubject, setSelectedSubject] = useState('All')
  const [hoveredDay, setHoveredDay] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  // 1. Extract unique subjects for filtering
  const subjectsList = useMemo(() => {
    const set = new Set()
    records.forEach(r => {
      const s = r.subject || r.course
      if (s) set.add(s)
    })
    return ['All', ...Array.from(set)]
  }, [records])

  // Filter records by selected subject if needed
  const filteredRecords = useMemo(() => {
    if (selectedSubject === 'All') return records
    return records.filter(r => (r.subject || r.course) === selectedSubject)
  }, [records, selectedSubject])

  // 2. Map records by date key: date -> { total, attended, absent, sessions: [] }
  const dateMap = useMemo(() => {
    const map = {}
    filteredRecords.forEach(r => {
      const rawDate = r.date || r.markedAt
      if (!rawDate) return
      // Extract YYYY-MM-DD
      const dateKey = String(rawDate).slice(0, 10)
      if (!map[dateKey]) {
        map[dateKey] = {
          date: dateKey,
          total: 0,
          attended: 0,
          absent: 0,
          sessions: [],
        }
      }
      map[dateKey].total++
      const isPresent = (r.status || 'present') === 'present'
      if (isPresent) map[dateKey].attended++
      else map[dateKey].absent++

      map[dateKey].sessions.push({
        subject: r.subject || r.course || 'General',
        status: isPresent ? 'present' : 'absent',
        time: r.markedAt || r.time || '',
      })
    })
    return map
  }, [filteredRecords])

  // 3. Generate 20-week calendar matrix (Monday to Sunday)
  const { weeks, monthLabels } = useMemo(() => {
    const now = new Date()
    // Current day of week: 0 is Sun, 1 is Mon, ..., 6 is Sat
    const currentDayOfWeek = now.getDay() // 0 = Sun, 1 = Mon ...
    // Adjust so Mon = 0, Sun = 6
    const adjustedDay = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1

    // End of current week (Sunday)
    const endOfWeek = new Date(now)
    endOfWeek.setDate(now.getDate() + (6 - adjustedDay))
    endOfWeek.setHours(23, 59, 59, 999)

    // 20 weeks total = 140 days
    const totalWeeks = 20
    const startDate = new Date(endOfWeek)
    startDate.setDate(endOfWeek.getDate() - (totalWeeks * 7 - 1))
    startDate.setHours(0, 0, 0, 0)

    const weeksArr = []
    const monthsArr = []
    let lastMonth = -1

    const iter = new Date(startDate)
    for (let w = 0; w < totalWeeks; w++) {
      const weekDays = []
      let weekFirstDayMonth = -1

      for (let d = 0; d < 7; d++) {
        const dObj = new Date(iter)
        const dateKey = toDateKey(dObj)
        const isFuture = dObj > now
        const isToday = dateKey === toDateKey(now)
        const info = dateMap[dateKey]

        if (d === 0) {
          weekFirstDayMonth = dObj.getMonth()
          // Month header labeling logic: cleanly space months and prevent overlap
          if (weekFirstDayMonth !== lastMonth) {
            if (monthsArr.length === 0) {
              monthsArr.push({
                weekIndex: w,
                label: dObj.toLocaleString('default', { month: 'short' }),
              })
              lastMonth = weekFirstDayMonth
            } else if (w - monthsArr[monthsArr.length - 1].weekIndex < 3) {
              // If within 2 weeks of previous label (e.g. week 0 was trailing end of previous month),
              // update the label to this new full month so they don't visually collide
              monthsArr[monthsArr.length - 1] = {
                weekIndex: w,
                label: dObj.toLocaleString('default', { month: 'short' }),
              }
              lastMonth = weekFirstDayMonth
            } else {
              monthsArr.push({
                weekIndex: w,
                label: dObj.toLocaleString('default', { month: 'short' }),
              })
              lastMonth = weekFirstDayMonth
            }
          }
        }

        let status = 'none'
        if (info && info.total > 0) {
          if (info.attended === info.total) status = 'present'
          else if (info.attended > 0) status = 'partial'
          else status = 'absent'
        }

        weekDays.push({
          date: dObj,
          dateKey,
          isFuture,
          isToday,
          info,
          status,
        })

        iter.setDate(iter.getDate() + 1)
      }

      weeksArr.push(weekDays)
    }

    return { weeks: weeksArr, monthLabels: monthsArr }
  }, [dateMap])

  // 4. Calculate Streaks & Semester Stats
  const streakStats = useMemo(() => {
    // Collect all class dates sorted
    const classDates = Object.keys(dateMap).sort()
    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 0
    let attendedDaysCount = 0
    let perfectDaysCount = 0
    let absentDaysCount = 0

    classDates.forEach(date => {
      const info = dateMap[date]
      if (info && info.total > 0) {
        if (info.attended > 0) {
          attendedDaysCount++
          if (info.attended === info.total) perfectDaysCount++
          tempStreak++
          if (tempStreak > longestStreak) longestStreak = tempStreak
        } else {
          absentDaysCount++
          tempStreak = 0
        }
      }
    })

    // Current streak: working backwards from latest date
    for (let i = classDates.length - 1; i >= 0; i--) {
      const info = dateMap[classDates[i]]
      if (info && info.total > 0) {
        if (info.attended > 0) {
          currentStreak++
        } else {
          break
        }
      }
    }

    const totalActiveDays = classDates.length
    const dailySuccessRate =
      totalActiveDays > 0 ? Math.round((attendedDaysCount / totalActiveDays) * 100) : 0

    return {
      currentStreak,
      longestStreak,
      totalActiveDays,
      attendedDaysCount,
      perfectDaysCount,
      absentDaysCount,
      dailySuccessRate,
    }
  }, [dateMap])

  const handleMouseEnter = (day, e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setHoveredDay(day)
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    })
  }

  const handleMouseLeave = () => {
    setHoveredDay(null)
  }

  const dayLabels = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun']

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80">
      {/* Top Header: Title, Theme Toggle, and Subject Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100/80">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-gray-800">Attendance Activity Heatmap</h3>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Visual daily attendance pattern across the semester (last 20 weeks)
          </p>
        </div>

        {/* Subject Filter Dropdown */}
        {subjectsList.length > 2 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Subject:
            </span>
            <select
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
              className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
            >
              {subjectsList.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Streak & Metric Badges Strip with Glassmorphism */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-amber-500/[0.08] via-amber-500/[0.02] to-white/80 backdrop-blur-xl border border-amber-200/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_4px_16px_rgba(245,158,11,0.06)]">
          <div className="p-3 bg-amber-500 text-white rounded-xl shadow-sm flex-shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-amber-800 leading-none mb-1">
              {streakStats.currentStreak} {streakStats.currentStreak === 1 ? 'day' : 'days'}
            </div>
            <div className="text-xs font-bold text-amber-900/60 uppercase tracking-wider">
              Current Streak
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500/[0.08] via-blue-500/[0.02] to-white/80 backdrop-blur-xl border border-blue-200/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_4px_16px_rgba(59,130,246,0.06)]">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-sm flex-shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-blue-800 leading-none mb-1">
              {streakStats.longestStreak} {streakStats.longestStreak === 1 ? 'day' : 'days'}
            </div>
            <div className="text-xs font-bold text-blue-900/60 uppercase tracking-wider">
              Longest Streak
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500/[0.08] via-emerald-500/[0.02] to-white/80 backdrop-blur-xl border border-emerald-200/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_4px_16px_rgba(16,185,129,0.06)]">
          <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-sm flex-shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-emerald-800 leading-none mb-1">
              {streakStats.attendedDaysCount}{' '}
              <span className="text-sm font-semibold text-emerald-600">
                / {streakStats.totalActiveDays}
              </span>
            </div>
            <div className="text-xs font-bold text-emerald-900/60 uppercase tracking-wider">
              Days Attended
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/[0.08] via-purple-500/[0.02] to-white/80 backdrop-blur-xl border border-purple-200/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_4px_16px_rgba(168,85,247,0.06)]">
          <div className="p-3 bg-purple-600 text-white rounded-xl shadow-sm flex-shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black text-purple-800 leading-none mb-1">
              {streakStats.dailySuccessRate}%
            </div>
            <div className="text-xs font-bold text-purple-900/60 uppercase tracking-wider">
              Daily Attendance Rate
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap Grid Container - Clean Light Tray matching Dashboard */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[680px] inline-block p-6 rounded-2xl bg-slate-50/90 border border-slate-200/90 shadow-inner">
          {/* Month labels row */}
          <div className="flex text-xs font-bold mb-3 pl-9 relative h-4">
            {monthLabels.map(m => (
              <span
                key={`${m.weekIndex}-${m.label}`}
                className="absolute text-xs tracking-tight font-bold text-slate-600"
                style={{ left: `${m.weekIndex * 26 + 38}px` }}
              >
                {m.label}
              </span>
            ))}
          </div>

          {/* Grid: 7 rows x 20 columns */}
          <div className="flex gap-2.5">
            {/* Day of week labels on left */}
            <div className="flex flex-col justify-between py-0.5 text-[11px] font-semibold select-none w-7 text-right pr-1 text-slate-400">
              {dayLabels.map((lbl, idx) => (
                <span key={idx} className="h-5 leading-5">
                  {lbl}
                </span>
              ))}
            </div>

            {/* Weeks columns */}
            <div className="flex gap-1.5">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-1.5">
                  {week.map((day, dIdx) => {
                    const isFut = day.isFuture
                    const isToday = day.isToday

                    // Clean GitHub-style tiles: soft slate-gray when no class, vivid colors when attended
                    let cellClass = ''
                    if (isFut) {
                      cellClass =
                        'bg-slate-100/50 border border-dashed border-slate-200 opacity-40'
                    } else if (day.status === 'present') {
                      cellClass =
                        'bg-gradient-to-br from-emerald-500 to-emerald-600 border border-emerald-400 shadow-[0_2px_6px_rgba(16,185,129,0.3),inset_0_1px_1px_rgba(255,255,255,0.6)]'
                    } else if (day.status === 'partial') {
                      cellClass =
                        'bg-gradient-to-br from-amber-400 to-amber-500 border border-amber-300 shadow-[0_2px_6px_rgba(245,158,11,0.3),inset_0_1px_1px_rgba(255,255,255,0.6)]'
                    } else if (day.status === 'absent') {
                      cellClass =
                        'bg-gradient-to-br from-rose-500 to-rose-600 border border-rose-400 shadow-[0_2px_6px_rgba(244,63,94,0.3),inset_0_1px_1px_rgba(255,255,255,0.6)]'
                    } else {
                      // Empty cell (no class recorded) - clear light slate tile, clearly visible like GitHub
                      cellClass =
                        'bg-slate-200/90 border border-slate-300/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)] hover:bg-slate-300 hover:border-slate-400'
                    }

                    const todayClass = isToday
                      ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-50 shadow-[0_0_10px_rgba(59,130,246,0.5)]'
                      : ''

                    return (
                      <div
                        key={dIdx}
                        onMouseEnter={e => !isFut && handleMouseEnter(day, e)}
                        onMouseLeave={handleMouseLeave}
                        className={`w-5 h-5 rounded-[6px] cursor-pointer transition-all duration-150 transform hover:scale-135 hover:z-10 relative ${cellClass} ${todayClass}`}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend & Details Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 mt-5 pt-4 border-t border-gray-100/80 text-xs font-medium text-gray-500">
        <div className="flex items-center gap-1.5 text-gray-400">
          <Info className="w-4 h-4 text-blue-500/70" />
          <span>Hover over any calendar cell to inspect daily lectures &amp; time</span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-xs font-semibold">Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-[5px] bg-slate-200 border border-slate-300 shadow-xs" />
            <span>No Class</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-[5px] bg-gradient-to-br from-rose-500 to-rose-600 border border-rose-400 shadow-xs shadow-rose-300" />
            <span>Absent (0%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-[5px] bg-gradient-to-br from-amber-400 to-amber-500 border border-amber-300 shadow-xs shadow-amber-300" />
            <span>Partial (&lt; 100%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-[5px] bg-gradient-to-br from-emerald-400 to-emerald-600 border border-emerald-400 shadow-xs shadow-emerald-300" />
            <span>Present (100%)</span>
          </div>
        </div>
      </div>

      {/* Floating Interactive Tooltip with Glassmorphism */}
      {hoveredDay && (
        <div
          className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 bg-gray-900/90 backdrop-blur-md text-white text-xs rounded-xl py-2.5 px-3.5 shadow-2xl border border-white/20 min-w-[210px]"
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
        >
          {/* Tooltip Header */}
          <div className="font-bold text-gray-200 border-b border-gray-700 pb-1 mb-1.5 flex items-center justify-between gap-3">
            <span>
              {hoveredDay.date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            {hoveredDay.isToday && (
              <span className="px-1.5 py-0.2 bg-blue-500/30 text-blue-300 text-[10px] rounded font-bold">
                Today
              </span>
            )}
          </div>

          {/* Tooltip Body */}
          {hoveredDay.info && hoveredDay.info.total > 0 ? (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                {hoveredDay.status === 'present' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : hoveredDay.status === 'partial' ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span
                  className={`font-bold ${
                    hoveredDay.status === 'present'
                      ? 'text-emerald-400'
                      : hoveredDay.status === 'partial'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {hoveredDay.info.attended} / {hoveredDay.info.total} Classes Attended (
                  {Math.round((hoveredDay.info.attended / hoveredDay.info.total) * 100)}%)
                </span>
              </div>

              {/* Sessions list */}
              <div className="space-y-1 mt-2 border-t border-gray-800 pt-1.5">
                {hoveredDay.info.sessions.map((sess, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] text-gray-300 gap-2">
                    <span className="truncate max-w-[120px]">{sess.subject}</span>
                    <span
                      className={`font-bold uppercase text-[10px] px-1.5 py-0.2 rounded ${
                        sess.status === 'present'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}
                    >
                      {sess.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-[11px] italic">No attendance records / off day</div>
          )}
        </div>
      )}
    </div>
  )
}
