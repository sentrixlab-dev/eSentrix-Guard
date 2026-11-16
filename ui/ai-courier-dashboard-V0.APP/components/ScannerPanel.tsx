'use client'

import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { Upload, Phone } from 'lucide-react'

export function ScannerPanel() {
  const [digits, setDigits] = useState<string>('0171122334')
  const [isScanning, setIsScanning] = useState(false)
  const [speed, setSpeed] = useState(0)

  useEffect(() => {
    if (isScanning) {
      const interval = setInterval(() => {
        setDigits(Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join(''))
        setSpeed(Math.floor(Math.random() * 360) + 200)
      }, 500)
      return () => clearInterval(interval)
    } else {
      setSpeed(0)
    }
  }, [isScanning])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="rounded-3xl p-8 border border-gray-700 bg-gray-900/50 backdrop-blur-sm overflow-hidden"
    >
      {/* Top Statistics Bar - exactly matching reference */}
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-700">
        <div className="flex gap-8">
          <div className="flex flex-col items-center">
            <div className="text-xs text-gray-400 mb-1">Commands</div>
            <div className="text-lg font-bold text-white">20 <span className="text-gray-500">/20</span></div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-xs text-gray-400 mb-1">Results Found</div>
            <div className="text-lg font-bold text-white">15</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="text-xs text-gray-400 mb-1">Data Captured</div>
            <div className="text-lg font-bold text-white">12</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400 mb-1">A.I. Scanning Series</div>
          <div className="text-sm font-mono text-gray-400">0171122334</div>
        </div>
      </div>

      {/* Main AI Display - Large futuristic number with wave */}
      <div className="relative mb-8 py-12 px-8 rounded-2xl bg-gradient-to-b from-gray-800 to-black border border-gray-700 overflow-hidden group">
        {/* Background wave animation */}
        <motion.div
          className="absolute inset-0 opacity-10"
          animate={{
            backgroundPosition: ['0% 0%', '100% 0%'],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          style={{
            backgroundImage: 'linear-gradient(90deg, #00d9ff 0%, #a855f7 25%, #ff8c42 50%, #ffd700 75%, #00d9ff 100%)',
            backgroundSize: '200% 100%',
          }}
        ></motion.div>

        {/* Wave visualization */}
        <svg
          className="absolute inset-0 w-full h-full opacity-20"
          viewBox="0 0 1000 200"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00d9ff" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ff8c42" />
            </linearGradient>
          </defs>
          <motion.path
            d="M 0 100 Q 250 30, 500 100 T 1000 100"
            fill="none"
            stroke="url(#waveGrad)"
            strokeWidth="3"
            animate={{ strokeDashoffset: [0, 100] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            strokeDasharray="100 100"
          />
        </svg>

        {/* Large glowing number */}
        <div className="relative z-10 text-center">
          <motion.div
            key={digits}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-8xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 drop-shadow-2xl"
          >
            {digits}
          </motion.div>
          <motion.div
            className="text-xs text-gray-400 mt-4"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            A.I. Scanning Server
          </motion.div>
        </div>

        {/* Glow effect */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          animate={{ opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <div className="w-full h-full rounded-2xl blur-3xl bg-gradient-to-b from-blue-500/30 to-transparent"></div>
        </motion.div>

        {/* Previous numbers below */}
        <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="text-xs text-gray-500 font-mono opacity-60"
            >
              0171122334
            </div>
          ))}
        </div>
      </div>

      {/* Platform / Perspective effect */}
      <div className="mb-8 perspective">
        <div className="relative h-32 rounded-2xl border-t-2 border-l-2 border-r border-b-4 border-gray-700 bg-gradient-to-b from-gray-800/50 to-black/80 overflow-hidden transform" style={{ transform: 'perspective(600px) rotateX(15deg)' }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600 opacity-40">Platform Base</div>
              <div className="text-xs text-gray-500 opacity-30 mt-2">3D Perspective View</div>
            </div>
          </div>
        </div>
      </div>

      {/* Status and Progress Section */}
      <div className="flex items-center gap-6 mb-8 p-6 rounded-xl bg-gray-800/40 border border-gray-700">
        {/* Circular progress indicator */}
        <div className="flex flex-col items-center">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="35" fill="none" stroke="#374151" strokeWidth="3" />
            <motion.circle
              cx="50"
              cy="50"
              r="35"
              fill="none"
              stroke="#a855f7"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="219.8 219.8"
              initial={{ strokeDashoffset: 219.8 }}
              animate={{ strokeDashoffset: isScanning ? 0 : 219.8 }}
              transition={{ duration: 3, repeat: Infinity }}
            />
          </svg>
          <span className="text-xs text-gray-400 mt-2 font-mono">13/20</span>
        </div>

        {/* Status text and progress bar */}
        <div className="flex-1">
          <div className="text-sm text-gray-300 mb-3 font-mono">
            {isScanning ? 'Scanning Active' : 'Standby'}
            <motion.span
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-cyan-400"
            >
              {isScanning ? ' ●' : ''}
            </motion.span>
          </div>
          <motion.div
            className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 via-yellow-500 to-orange-500 rounded-full"
            animate={{ width: isScanning ? '100%' : '0%' }}
            transition={{ duration: 0.5 }}
          ></motion.div>
        </div>

        {/* Speed indicator */}
        <div className="text-right">
          <div className="text-xs text-gray-400 mb-1">Speed</div>
          <motion.div
            className="text-2xl font-bold text-cyan-400 font-mono"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            {speed}/sec
          </motion.div>
        </div>
      </div>

      {/* Manual Number Check Section */}
      <div className="mb-8 p-6 rounded-xl bg-gray-800/40 border border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <Phone size={16} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-white">Manual Number Check</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4">Enter any mobile number to check manually</p>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Enter mobile number (e.g. 0171122334)"
            className="flex-1 bg-gray-900/80 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-cyan-500/50 focus:bg-gray-900"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg font-semibold text-white text-sm hover:shadow-lg hover:shadow-green-500/50 transition-shadow"
          >
            Check Now
          </motion.button>
        </div>
      </div>

      {/* Bottom Control Section */}
      <div className="flex items-center justify-between">
        {/* Left: Command selector */}
        <div className="text-sm text-gray-400">
          <span className="font-mono">CMD Select:</span>
          <select className="ml-2 bg-gray-800/60 border border-gray-600 rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500/50">
            <option>Command 1</option>
            <option>Command 2</option>
            <option>Command 3</option>
          </select>
        </div>

        {/* Center: Large Start/Stop Button */}
        <motion.button
          onClick={() => setIsScanning(!isScanning)}
          animate={{
            boxShadow: isScanning
              ? [
                  '0 0 20px rgba(16, 185, 129, 0.4)',
                  '0 0 40px rgba(16, 185, 129, 0.8)',
                  '0 0 20px rgba(16, 185, 129, 0.4)',
                ]
              : '0 0 10px rgba(16, 185, 129, 0)',
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          className={`w-24 h-24 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
            isScanning
              ? 'bg-red-600 text-white shadow-lg shadow-red-500/50'
              : 'bg-teal-500 text-white shadow-lg shadow-teal-500/50'
          }`}
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="text-center"
          >
            {isScanning ? '⏹' : '▶'}
          </motion.div>
        </motion.button>

        {/* Right: Upload and Loop */}
        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-3 bg-gray-800/60 border border-gray-600 rounded-lg text-white text-xs font-semibold hover:bg-gray-700/60 transition-colors flex items-center gap-2"
          >
            <Upload size={14} />
            Upload
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-3 bg-gray-800/60 border border-gray-600 rounded-lg text-white text-xs font-semibold hover:bg-gray-700/60 transition-colors"
          >
            Loop: OFF
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}
