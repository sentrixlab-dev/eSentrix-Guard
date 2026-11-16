'use client'

import { Bell, Moon } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

export function Header() {
  const [language, setLanguage] = useState<'bn' | 'en'>('bn')
  const [profilePic, setProfilePic] = useState<string | null>(null)
  const [username, setUsername] = useState<string>('U')

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const url = typeof window !== 'undefined' && window.location.port === '3001'
          ? 'http://localhost:3000/api/profile'
          : '/api/profile'
        const res = await fetch(url)
        const data = await res.json()
        if (data.success && data.user) {
          setProfilePic(data.user.profile_pic)
          setUsername(data.user.username || 'U')
        }
      } catch (err) {}
    }
    fetchProfile()

    const handleProfileUpdate = (e: any) => {
      setProfilePic(e.detail.profile_pic)
    }
    window.addEventListener('profile_updated', handleProfileUpdate)
    return () => window.removeEventListener('profile_updated', handleProfileUpdate)
  }, [])

  const toggleLanguage = () => {
    setLanguage(language === 'bn' ? 'en' : 'bn')
  }

  return (
    <header className="absolute top-0 left-0 right-0 z-50 bg-[#161616] border-b border-b-gray-800 h-16">
      <div className="h-full px-6 flex items-center justify-between">
        
        {/* LEFT: Logo and Title */}
        <div className="flex items-center gap-3">
          {/* Logo Image */}
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/5start-logo-RG0vzvT9ehs08zVfn5kGY49g0G2512.png"
            alt="5 Star Logo"
            className="h-7 w-auto"
          />
          
          {/* Title and Badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white tracking-tight">
              AI Courier Data Analytic
            </span>
            <span className="text-xs font-bold text-amber-500 bg-amber-900/40 px-1.5 py-0.5 rounded-sm">
              Pro
            </span>
          </div>
        </div>

        {/* RIGHT: Icons and Controls */}
        <div className="flex items-center gap-4">
          {/* Moon Icon - Theme Toggle */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-1.5 hover:bg-gray-800/60 rounded-lg transition-colors"
            aria-label="Toggle theme"
          >
            <Moon size={18} className="text-gray-400" />
          </motion.button>

          {/* Notification Icon */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-1.5 hover:bg-gray-800/60 rounded-lg transition-colors relative"
            aria-label="Notifications"
          >
            <Bell size={18} className="text-gray-400" />
            {/* Notification dot */}
            <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full"></div>
          </motion.button>

          {/* Language Selector - Toggle Button */}
          <motion.button
            onClick={toggleLanguage}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/40 border border-gray-700 rounded-full transition-colors hover:bg-gray-800/60"
            aria-label="Toggle language"
          >
            <motion.div
              initial={false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
              key={language}
              className="flex items-center gap-1.5"
            >
              {language === 'bn' ? (
                <>
                  {/* Bangladesh Flag */}
                  <svg className="w-4 h-3 rounded-sm" viewBox="0 0 900 600" xmlns="http://www.w3.org/2000/svg">
                    <rect width="900" height="600" fill="#006747"/>
                    <circle cx="420" cy="300" r="180" fill="#EF3B2D"/>
                  </svg>
                  {/* BN Text */}
                  <span className="text-xs font-semibold text-gray-200">BN</span>
                </>
              ) : (
                <>
                  {/* United States Flag */}
                  <svg className="w-4 h-3 rounded-sm" viewBox="0 0 900 600" xmlns="http://www.w3.org/2000/svg">
                    <rect width="900" height="600" fill="#B22234"/>
                    <path d="M 0 46 L 900 46 M 0 92 L 900 92 M 0 138 L 900 138 M 0 184 L 900 184 M 0 230 L 900 230 M 0 276 L 900 276 M 0 322 L 900 322 M 0 368 L 900 368 M 0 414 L 900 414 M 0 460 L 900 460 M 0 506 L 900 506 M 0 552 L 900 552" stroke="white" strokeWidth="46"/>
                    <rect width="360" height="323" fill="#3C3B6B"/>
                  </svg>
                  {/* EN Text */}
                  <span className="text-xs font-semibold text-gray-200">EN</span>
                </>
              )}
            </motion.div>
          </motion.button>

          {/* Profile Avatar */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-600 to-emerald-600 flex items-center justify-center cursor-pointer hover:shadow-lg hover:shadow-emerald-500/40 transition-shadow overflow-hidden border border-gray-600"
          >
            {profilePic ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={typeof window !== 'undefined' && window.location.port === '3001' ? `http://localhost:3000${profilePic}` : profilePic} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-white">{username[0]?.toUpperCase()}</span>
            )}
          </motion.button>
        </div>
      </div>
    </header>
  )
}
