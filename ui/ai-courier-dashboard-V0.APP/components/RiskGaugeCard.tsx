'use client'

import { motion } from 'framer-motion'
import { ShoppingCart, CheckCircle2, XCircle } from 'lucide-react'
import { useState, useEffect } from 'react'

interface StatCard {
  icon: React.ReactNode
  title: string
  value: number
  borderColor: string
  shadowColor: string
  iconColor: string
}

interface RiskGaugeCardProps {
  displayPercentage: number
  orders: number
  delivery: number
  cancel: number
}

export function RiskGaugeCard({ displayPercentage, orders, delivery, cancel }: RiskGaugeCardProps) {
  const statCards: StatCard[] = [
    {
      icon: <ShoppingCart size={18} />,
      title: 'Total Order',
      value: orders,
      borderColor: 'border-blue-500',
      shadowColor: 'shadow-blue-500/30',
      iconColor: 'text-blue-500',
    },
    {
      icon: <CheckCircle2 size={18} />,
      title: 'Total Delivery',
      value: delivery,
      borderColor: 'border-green-500',
      shadowColor: 'shadow-green-500/30',
      iconColor: 'text-green-500',
    },
    {
      icon: <XCircle size={18} />,
      title: 'Total Cancel',
      value: cancel,
      borderColor: 'border-red-500',
      shadowColor: 'shadow-red-500/30',
      iconColor: 'text-red-500',
    },
  ]

  // Correction 1: reduced radius from 100 → 88 (~10% smaller circle)
  const radius = 88
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (displayPercentage / 100) * circumference

  // SVG viewBox sized with safe margin so outer ring never clips
  // outer ring r=108, strokeWidth=10 → outermost pixel = 113. ViewBox 240 gives 7px margin on each side.
  const VB = 240
  const cx = VB / 2  // 120
  const cy = VB / 2  // 120

  return (
    <div 
      className="relative w-full rounded-[18px]"
      style={{
        height: '280px',
        background: 'rgba(26,26,26,0.75)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
        boxShadow: 'inset 0 1px 0px rgba(255,255,255,0.06), 0 2px 12px rgba(0,0,0,0.5)',
        overflow: 'visible',
      }}
    >
      {/* Correction 2: RGB glow — soft large blur behind circle, top=orange, left=cyan, bottom=green, right=magenta */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: '50%',
          top: '44%',
          transform: 'translate(-50%, -50%)',
          width: '420px',
          height: '420px',
          filter: 'blur(55px)',
          background: `
            radial-gradient(circle 150px at 50%  4%,  rgba(255, 140, 20,  0.32) 0%, transparent 65%),
            radial-gradient(circle 150px at 4%   50%, rgba(0,  220, 255,  0.32) 0%, transparent 65%),
            radial-gradient(circle 150px at 50%  96%, rgba(30, 210,  80,  0.28) 0%, transparent 65%),
            radial-gradient(circle 150px at 96%  50%, rgba(160, 40, 230,  0.28) 0%, transparent 65%)
          `,
        }}
      />

      {/* Correction 2: circle shifted slightly downward (top: 44% not 50%) so it sits
          visually balanced between card top-edge and the floating stat cards below */}
      <div
        className="absolute"
        style={{
          left: '50%',
          top: '44%',
          transform: 'translate(-50%, -50%)',
          width: '216px',   // Correction 1: ~10% smaller than 240
          height: '216px',
        }}
      >
        {/* Correction 3: viewBox has generous margin; outer ring r=108 + strokeWidth/2=5 = 113 < 120 */}
        <svg width="216" height="216" viewBox="0 0 240 240" className="transform -rotate-90">
          <defs>
            {/* Refinement 2: light yellow → golden yellow → orange → deep orange → red-orange */}
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#FFF176" />
              <stop offset="25%"  stopColor="#FFD600" />
              <stop offset="55%"  stopColor="#FF8F00" />
              <stop offset="80%"  stopColor="#E65100" />
              <stop offset="100%" stopColor="#BF360C" />
            </linearGradient>
          </defs>

          {/* Outer black ring — r=108, outermost edge = 113, inside 120 viewBox boundary */}
          <circle cx={cx} cy={cy} r="108" fill="none" stroke="#050505" strokeWidth="10" />

          {/* Correction 1: solid black disc covering ENTIRE interior up to the outer ring edge.
              r=103 (= 108 - 5 half-stroke) fills everything solid so no transparent gap remains */}
          <circle cx={cx} cy={cy} r="103" fill="#050505" />

          {/* Base ring — deep royal blue, sits on top of black disc */}
          <circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke="#2A18E8"
            strokeWidth="20"
            strokeLinecap="round"
          />

          {/* Progress arc — same thickness, gradient on top of blue ring */}
          <motion.circle
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="20"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />

          {/* Inner black disc — re-covers the inside of the ring to restore clean black center */}
          <circle cx={cx} cy={cy} r="77" fill="#050505" />
        </svg>

        {/* Center text — sits in SVG container's rotated frame, so we counter-rotate */}
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center justify-center gap-1">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className="px-2.5 py-0.5 bg-red-600 rounded-full text-white text-xs font-bold"
            >
              Risk
            </motion.div>
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              className="text-4xl font-bold text-white"
            >
              {displayPercentage}%
            </motion.div>
          </div>
        </div>
      </div>

      {/* Corrections 6–9: stat cards — top-only accent border, no visible side/bottom lines,
          soft floating glow, consistent typography and padding */}
      <div className="absolute left-1/2 -translate-x-1/2 flex gap-2.5 z-20" style={{ bottom: '-22px' }}>
        {statCards.map((card, idx) => {
          const accentHex = card.borderColor === 'border-blue-500'
            ? '#3B82F6'
            : card.borderColor === 'border-green-500'
            ? '#22C55E'
            : '#EF4444'
          const glowRgb = card.borderColor === 'border-blue-500'
            ? '59,130,246'
            : card.borderColor === 'border-green-500'
            ? '34,197,94'
            : '239,68,68'

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + idx * 0.1, duration: 0.3 }}
              className="flex items-center gap-2 px-3 rounded-[9px]"
              style={{
                width: '120px',
                height: '50px',
                background: 'rgba(26,26,26,0.95)',
                backdropFilter: 'blur(12px)',
                /* Correction 5: top accent border only, no other borders */
                borderTop:    `2px solid ${accentHex}`,
                borderLeft:   'none',
                borderRight:  'none',
                borderBottom: 'none',
                /* Correction 6: very soft floating glow below card */
                boxShadow: `0 8px 20px rgba(${glowRgb}, 0.14)`,
              }}
            >
              {/* Corrections 8–9: icon + label + value with consistent spacing */}
              <div className={`${card.iconColor} flex-shrink-0`}>{card.icon}</div>
              <div className="flex flex-col justify-center gap-0.5 min-w-0">
                <div
                  className="text-gray-400 font-medium truncate"
                  style={{ fontSize: '10px', lineHeight: '1.2' }}
                >
                  {card.title}
                </div>
                <div className="text-sm font-bold text-white leading-none">{card.value}</div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
