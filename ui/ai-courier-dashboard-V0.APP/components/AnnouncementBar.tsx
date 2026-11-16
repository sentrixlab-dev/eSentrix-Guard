'use client'

import { CheckCircle2 } from 'lucide-react'

interface AnnouncementBarProps {
  announcements?: string[]
}

export function AnnouncementBar({ announcements }: AnnouncementBarProps) {
  const defaultAnnouncements = [
    'Check Bangladeshi Largest Courier Customer Fraud Status',
    'Real-time Fraud Detection Powered by AI',
    'Secure & Private — Your Data is Protected',
    'Multi-network Support for All Couriers',
  ]

  const items = announcements || defaultAnnouncements

  // Render one "track" of items — we use two identical tracks side-by-side.
  // The keyframe slides both left by exactly 100% of one track width, then
  // snaps back to 0 — because the second copy is identical, the snap is invisible.
  const Track = () => (
    <div className="flex items-center h-full gap-8 px-4 flex-shrink-0" aria-hidden>
      {items.map((announcement, idx) => (
        <div key={idx} className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
          <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
          <span className="text-xs text-gray-400">{announcement}</span>
          {/* Separator dot between items */}
          {idx < items.length - 1 && (
            <span className="ml-6 text-gray-700 select-none">•</span>
          )}
        </div>
      ))}
    </div>
  )

  return (
    <div className="relative mx-6 mt-2 h-8 overflow-hidden rounded-full bg-gray-900/50 border border-gray-800/80 shadow-sm">
      {/*
        Two identical tracks concatenated.
        The CSS animation slides the outer container left by 50% of its total width
        (= 100% of one track), then resets to 0 — because the tracks are identical
        the reset is invisible, producing a perfectly seamless infinite loop.

        will-change: transform  → promotes to GPU compositor layer (no repaints)
        translateZ(0)           → forces hardware acceleration
        backface-visibility: hidden + perspective → prevents subpixel blur
      */}
      <style>{`
        @keyframes marquee-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-inner {
          animation: marquee-scroll 16s linear infinite;
          will-change: transform;
          transform: translate3d(0, 0, 0);
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
      `}</style>

      <div className="marquee-inner flex items-center h-full">
        <Track />
        <Track />
      </div>

      {/* Fade overlay left */}
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#161616] via-[#161616]/80 to-transparent pointer-events-none z-10" />
      {/* Fade overlay right */}
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#161616] via-[#161616]/80 to-transparent pointer-events-none z-10" />
    </div>
  )
}
