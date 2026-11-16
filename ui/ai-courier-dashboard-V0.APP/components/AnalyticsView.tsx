'use client'

import { motion } from 'framer-motion'
import { BarChart3, Bolt, ShieldAlert, Server, TowerControl, TrendingUp } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export function AnalyticsView() {
  const stats = [
    { label: 'Scan Velocity', value: '142.5 / min', desc: 'Queries per minute', icon: <Bolt size={20} />, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: 'Accuracy Rate', value: '99.82%', desc: 'Stealth bypass rate', icon: <ShieldAlert size={20} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Engine Load', value: '18.4%', desc: 'CPU Thread utilization', icon: <Server size={20} />, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Operator Share', value: '5 Networks', desc: 'Bangladesh operator coverage', icon: <TowerControl size={20} />, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  ]

  const operators = [
    { name: 'Grameenphone', percentage: 45, color: '#06b6d4' },
    { name: 'Banglalink', percentage: 25, color: '#ef4444' },
    { name: 'Robi Axiata', percentage: 20, color: '#a855f7' },
    { name: 'Airtel', percentage: 8, color: '#f43f5e' },
    { name: 'Teletalk', percentage: 2, color: '#10b981' },
  ]

  const graphData = [
    { time: '09:00', throughput: 35 },
    { time: '10:00', throughput: 65 },
    { time: '11:00', throughput: 120 },
    { time: '12:00', throughput: 90 },
    { time: '13:00', throughput: 185 },
    { time: '14:00', throughput: 140 },
    { time: '15:00', throughput: 210 },
  ]

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1a1a1a] border border-[#333] p-3 rounded-xl shadow-2xl">
          <p className="text-gray-400 text-xs mb-1 font-mono">{label}</p>
          <p className="text-white font-bold text-lg flex items-center gap-1">
            {payload[0].value} <span className="text-purple-400 text-xs font-normal uppercase tracking-wider">req/min</span>
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="ml-20 px-6 pb-6 h-[calc(100vh-120px)] flex flex-col gap-6"
    >
      {/* Header */}
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 size={24} className="text-purple-500" /> Advanced Analytics
        </h1>
        <p className="text-sm text-gray-400 mt-1">Real-time scanning analytics and performance logs</p>
      </div>

      {/* Grid container */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6 pr-2">
        {/* Top Widgets */}
        <div className="grid grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-[#1E1E1E] p-4.5 rounded-2xl border border-[#333333] flex items-center gap-4 shadow-xl"
            >
              <div className={`p-3 rounded-xl ${s.bg} ${s.color}`}>
                {s.icon}
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-gray-400 font-semibold text-transform: uppercase">{s.label}</span>
                <span className="text-lg font-black text-white mt-1 leading-none">{s.value}</span>
                <span className="text-[10px] text-gray-500 mt-1.5">{s.desc}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Graphical Section */}
        <div className="grid grid-cols-3 gap-6">
          {/* Chart card */}
          <div className="col-span-2 bg-[#1E1E1E] p-6 rounded-2xl border border-[#333333] flex flex-col min-h-[300px] shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-6">
              <TrendingUp size={16} className="text-purple-400" /> System Throughput History
            </h3>
            <div className="flex-1 bg-black/40 rounded-xl border border-[#333333] p-4 h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={graphData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorThroughput" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="50%" stopColor="#ec4899" />
                      <stop offset="100%" stopColor="#eab308" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                  <XAxis dataKey="time" stroke="#666" tick={{ fill: '#666', fontSize: 11 }} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#666" tick={{ fill: '#666', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#444', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area 
                    type="monotone" 
                    dataKey="throughput" 
                    stroke="url(#lineGradient)" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorThroughput)" 
                    activeDot={{ r: 6, fill: '#ec4899', stroke: '#fff', strokeWidth: 2 }} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Distribution card */}
          <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-[#333333] flex flex-col min-h-[300px] shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-6">
              <TowerControl size={16} className="text-cyan-400" /> Operator Distribution
            </h3>
            <div className="flex-1 flex flex-col gap-6 justify-center">
              {operators.map((op, idx) => (
                <div key={idx} className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-gray-300">{op.name}</span>
                    <span className="text-gray-400">{op.percentage}%</span>
                  </div>
                  <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-[#333333]">
                    <div
                      style={{ width: `${op.percentage}%`, backgroundColor: op.color }}
                      className="h-full rounded-full shadow-[0_0_8px_currentColor]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
