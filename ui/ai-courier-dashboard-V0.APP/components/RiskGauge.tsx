'use client'

import { motion } from 'framer-motion'
import { ShoppingCart, CheckCircle, XCircle } from 'lucide-react'

interface RiskGaugeProps {
  percentage?: number
}

export function RiskGauge({ percentage = 35 }: RiskGaugeProps) {
  const circumference = 2 * Math.PI * 90

  // Color gradient based on percentage
  const getGradientStops = () => {
    if (percentage < 20) return 'from-blue-500 via-blue-500 to-blue-500'
    if (percentage < 40) return 'from-blue-500 via-purple-500 to-purple-500'
    if (percentage < 60) return 'from-purple-500 via-orange-500 to-orange-500'
    if (percentage < 80) return 'from-orange-500 via-yellow-500 to-yellow-500'
    return 'from-yellow-500 via-red-500 to-red-500'
  }

  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-effect rounded-2xl p-8 border border-[#333333]"
    >
      {/* Animated Circular Progress */}
      <div className="flex justify-center mb-8 relative">
        {/* Background glow */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-56 h-56 rounded-full bg-gradient-to-br from-purple-500/20 via-blue-500/20 to-transparent blur-3xl"></div>
        </div>

        {/* SVG Circle */}
        <svg className="w-56 h-56 -rotate-90 relative z-10" viewBox="0 0 200 200">
          {/* Background circle */}
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="#333333"
            strokeWidth="8"
            opacity="0.3"
          />

          {/* Animated progress circle */}
          <motion.circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="url(#gradient)"
            strokeWidth="8"
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            strokeDasharray={circumference}
          />

          {/* Gradient definition */}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              {percentage < 20 && (
                <>
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#3B82F6" />
                </>
              )}
              {percentage >= 20 && percentage < 40 && (
                <>
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="50%" stopColor="#A855F7" />
                  <stop offset="100%" stopColor="#A855F7" />
                </>
              )}
              {percentage >= 40 && percentage < 60 && (
                <>
                  <stop offset="0%" stopColor="#A855F7" />
                  <stop offset="50%" stopColor="#FF8C42" />
                  <stop offset="100%" stopColor="#FF8C42" />
                </>
              )}
              {percentage >= 60 && percentage < 80 && (
                <>
                  <stop offset="0%" stopColor="#FF8C42" />
                  <stop offset="50%" stopColor="#FFD700" />
                  <stop offset="100%" stopColor="#FFD700" />
                </>
              )}
              {percentage >= 80 && (
                <>
                  <stop offset="0%" stopColor="#FFD700" />
                  <stop offset="50%" stopColor="#FF6B6B" />
                  <stop offset="100%" stopColor="#FF6B6B" />
                </>
              )}
            </linearGradient>
          </defs>
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-center"
          >
            <div className="text-sm text-gray-400 mb-1">Risk</div>
            <div className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {percentage}%
            </div>
          </motion.div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mt-12">
        {[
          {
            icon: ShoppingCart,
            label: 'Total Order',
            value: 0,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
          },
          {
            icon: CheckCircle,
            label: 'Total Delivery',
            value: 0,
            color: 'text-green-400',
            bg: 'bg-green-500/10',
          },
          {
            icon: XCircle,
            label: 'Total Cancel',
            value: 0,
            color: 'text-red-400',
            bg: 'bg-red-500/10',
          },
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + idx * 0.1 }}
            className={`${stat.bg} rounded-lg p-4 border border-[#333333]`}
          >
            <div className="flex items-center gap-3">
              <stat.icon size={20} className={stat.color} />
              <div className="flex-1">
                <div className="text-xs text-gray-400">{stat.label}</div>
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: idx * 0.3 }}
                  className={`text-lg font-semibold ${stat.color}`}
                >
                  {stat.value}
                </motion.div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
