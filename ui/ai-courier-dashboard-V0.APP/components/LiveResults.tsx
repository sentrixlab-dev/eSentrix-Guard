'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Phone, Truck, ClipboardList, CheckCircle, XCircle } from 'lucide-react'
import { useState, useEffect } from 'react'

interface ResultRow {
  id: string
  phone: string
  courier: string
  order: string
  delivery: string
  cancel: string
  rate: number
  whatsapp: boolean
}

interface LiveResultsProps {
  results: ResultRow[]
}

export function LiveResults({ results }: LiveResultsProps) {

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="glass-effect rounded-2xl border border-[#333333] overflow-hidden flex flex-col h-full w-full"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#333333] flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Live Results</h2>
        </div>
        <motion.button
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="px-4 py-2 bg-[#2A2A2A] border border-[#333333] rounded-lg text-sm text-gray-300 hover:bg-[#333333] transition-colors"
        >
          Ready
        </motion.button>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-[105px_1fr_55px_75px_75px_55px_80px] gap-2 px-4 py-3 bg-[#1A1A1A] border-b border-[#333333] text-[13px] font-semibold text-gray-400 sticky top-0">
        <div className="flex items-center gap-2 text-blue-400"><Phone size={16} className="text-blue-500" /> <span className="text-gray-200">Phone</span></div>
        <div className="flex items-center gap-2 text-orange-400"><Truck size={16} className="text-orange-500" /> <span className="text-gray-200">Courier</span></div>
        <div className="flex items-center gap-2 text-cyan-400"><ClipboardList size={16} className="text-cyan-500" /> <span className="text-gray-200">Order</span></div>
        <div className="flex items-center gap-2 text-green-400"><CheckCircle size={16} className="text-green-500" /> <span className="text-gray-200">Delivery</span></div>
        <div className="flex items-center gap-2 text-red-400"><XCircle size={16} className="text-red-500" /> <span className="text-gray-200">Cancel</span></div>
        <div className="flex items-center gap-2 text-gray-400"><span className="text-gray-400 font-bold">%</span> <span className="text-gray-200">Rate</span></div>
        <div className="flex items-center gap-2 text-green-500"><MessageCircle size={16} className="text-green-500" /> <span className="text-gray-200">WhatsApp</span></div>
      </div>

      {/* Results Table Body */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence>
          {results.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-12 px-6"
            >
              <div className="text-6xl mb-4">📦</div>
              <h3 className="text-lg font-semibold text-gray-300 mb-2">No Data Yet</h3>
              <p className="text-sm text-gray-500 text-center">Start the scanner to see live results</p>
            </motion.div>
          ) : (
            results.map((row, idx) => {
              const shortCourier = row.courier
                ? row.courier
                    .replace(/RedX/gi, 'RDX')
                    .replace(/Pathao/gi, 'PAT')
                    .replace(/SteadFast/gi, 'STF')
                    .replace(/Paperfly/gi, 'PAP')
                    .replace(/CarryBee/gi, 'CRY')
                    .replace(/ParcelDex/gi, 'PAR')
                : '-';

              return (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-[105px_1fr_55px_75px_75px_55px_80px] gap-2 px-4 py-3 border-b border-[#333333] items-center hover:bg-[#2A2A2A]/50 transition-colors group"
              >
                {/* Phone */}
                <motion.div
                  animate={{ fontWeight: idx === 0 ? 600 : 400 }}
                  className="text-base text-gray-300 truncate font-mono"
                >
                  {row.phone}
                </motion.div>

                {/* Courier */}
                <div className="text-sm text-gray-300 leading-snug break-words" title={row.courier}>{shortCourier}</div>

                {/* Order */}
                <div className="text-base text-gray-300">{row.order}</div>

                {/* Delivery */}
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="inline-block"
                >
                  <span className="px-4 py-1.5 bg-green-500/20 text-green-400 text-sm font-semibold rounded-full border border-green-500/30">
                    ✓ {row.delivery}
                  </span>
                </motion.div>

                {/* Cancel */}
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="inline-block"
                >
                  <span className="px-4 py-1.5 bg-red-500/20 text-red-400 text-sm font-semibold rounded-full border border-red-500/30">
                    ✕ {row.cancel}
                  </span>
                </motion.div>

                {/* Rate */}
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="inline-block"
                >
                  <span className="px-4 py-1.5 bg-purple-500/20 text-purple-400 text-sm font-semibold rounded-full border border-purple-500/30">
                    {row.rate}%
                  </span>
                </motion.div>

                {/* WhatsApp */}
                <div className="flex items-center text-base">
                  {row.whatsapp ? (
                    <div className="flex items-center gap-2 text-green-400 font-mono">
                      <MessageCircle size={18} />
                      <span>{row.phone}</span>
                    </div>
                  ) : (
                    <div className="text-gray-600">-</div>
                  )}
                </div>
              </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
