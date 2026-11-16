'use client'

import { BarChart3, Database, Home, Settings, User, Key } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

interface SidebarProps {
  activeItem: string
  setActiveItem: (item: string) => void
}

export function Sidebar({ activeItem, setActiveItem }: SidebarProps) {
  const [isConnected, setIsConnected] = useState(true)

  const menuItems = [
    { icon: Home, label: 'Dashboard' },
    { icon: Database, label: 'Database' },
    { icon: BarChart3, label: 'Analytics' },
    { icon: Key, label: 'API' },
    { icon: User, label: 'Users' },
  ]

  return (
    <aside className="absolute left-0 top-16 bottom-0 w-20 bg-[#161616] border-r border-gray-800 flex flex-col items-center pt-8 pb-8 z-40">
      {/* Top Navigation Items */}
      <div className="flex flex-col gap-8">
        {menuItems.map((item) => {
          const isActive = activeItem === item.label
          return (
            <motion.button
              key={item.label}
              onClick={() => setActiveItem(item.label)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative flex items-center justify-center group w-12 h-12"
              title={item.label}
            >
              {/* Active State: Gold rounded square background with gradient and glow */}
              {isActive && (
                <motion.div
                  layoutId="activeBackground"
                  className="absolute inset-0 bg-gradient-to-br from-amber-500/30 to-amber-600/20 rounded-lg border border-amber-500/50 shadow-inner shadow-amber-400/20"
                  transition={{ duration: 0.2 }}
                />
              )}

              {/* Icon */}
              <motion.div
                animate={{
                  color: isActive ? '#FFFFFF' : '#9CA3AF',
                }}
                transition={{ duration: 0.2 }}
              >
                <item.icon size={24} className="w-6 h-6 relative z-10" />
              </motion.div>

              {/* Hover tooltip */}
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                whileHover={{ opacity: 1, x: 0 }}
                className="absolute left-full ml-3 px-2 py-1 bg-gray-700 rounded text-xs text-white whitespace-nowrap pointer-events-none"
              >
                {item.label}
              </motion.div>
            </motion.button>
          )
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1"></div>

      {/* Bottom Section */}
      <div className="flex flex-col gap-6 items-center">
        {/* Settings Icon */}
        <motion.button
          onClick={() => setActiveItem('Settings')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center justify-center group relative w-12 h-12"
          title="Settings"
        >
          {activeItem === 'Settings' && (
            <motion.div
              layoutId="activeBackground"
              className="absolute inset-0 bg-gradient-to-br from-amber-500/30 to-amber-600/20 rounded-lg border border-amber-500/50 shadow-inner shadow-amber-400/20"
              transition={{ duration: 0.2 }}
            />
          )}
          <motion.div
            animate={{
              color: activeItem === 'Settings' ? '#FFFFFF' : '#9CA3AF',
            }}
            className="relative z-10 transition-colors"
          >
            <Settings size={24} className="w-6 h-6" />
          </motion.div>

          {/* Hover tooltip */}
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            whileHover={{ opacity: 1, x: 0 }}
            className="absolute left-full ml-3 px-2 py-1 bg-gray-700 rounded text-xs text-white whitespace-nowrap pointer-events-none"
          >
            Settings
          </motion.div>
        </motion.button>

        {/* Separator Line */}
        <div className="w-6 h-px bg-gray-700"></div>

        {/* Server Status */}
        <div className="flex flex-col items-center gap-2">
          <div className="text-xs text-gray-400 font-medium">Server</div>

          {/* Status Indicator - Glowing Circle */}
          <motion.div
            animate={{
              boxShadow: isConnected
                ? [
                    '0 0 4px rgba(34, 197, 94, 0.5)',
                    '0 0 10px rgba(34, 197, 94, 0.7)',
                    '0 0 4px rgba(34, 197, 94, 0.5)',
                  ]
                : [
                    '0 0 4px rgba(239, 68, 68, 0.5)',
                    '0 0 10px rgba(239, 68, 68, 0.7)',
                    '0 0 4px rgba(239, 68, 68, 0.5)',
                  ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className={`w-3.5 h-3.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
          />
        </div>
        
        {/* Spacer at the bottom */}
        <div className="mb-8"></div>
      </div>
    </aside>
  )
}
