'use client'

import { motion } from 'framer-motion'
import { Lock, Zap, Activity, Network } from 'lucide-react'

export function Footer() {
  const features = [
    {
      icon: Lock,
      title: 'Secure & Private',
      description: 'Your data is protected',
    },
    {
      icon: Zap,
      title: 'AI Powered',
      description: 'Advanced scanning',
    },
    {
      icon: Activity,
      title: 'Real-time Results',
      description: 'Instant data capture',
    },
    {
      icon: Network,
      title: 'Multi Network',
      description: 'All operators supported',
    },
  ]

  return (
    <motion.footer
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="sticky bottom-0 left-20 right-0 mt-8 px-6 py-6 bg-[#161616] border-t border-[#333333]"
    >
      <div className="grid grid-cols-4 gap-4">
        {features.map((feature, idx) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-[#1E1E1E] border border-[#333333] hover:bg-[#2A2A2A] transition-colors"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: idx * 0.3 }}
            >
              <feature.icon size={24} className="text-blue-400" />
            </motion.div>
            <h3 className="font-semibold text-sm text-white text-center">{feature.title}</h3>
            <p className="text-xs text-gray-500 text-center">{feature.description}</p>
          </motion.div>
        ))}
      </div>
    </motion.footer>
  )
}
