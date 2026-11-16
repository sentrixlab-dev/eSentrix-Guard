'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Database, Search, RotateCw, FileSpreadsheet, Trash2, Phone, Truck, ClipboardList, CheckCircle, XCircle, MessageSquare } from 'lucide-react'
import { io, Socket } from 'socket.io-client'

interface DBRecord {
  phone: string
  courier: string
  orders: number
  delivery: number
  cancel: number
  success_rate: string
  has_whatsapp: number
  scan_date: string
}

export function DatabaseView() {
  const [records, setRecords] = useState<DBRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const socketRef = useRef<Socket | null>(null)

  const fetchDatabase = async () => {
    setLoading(true)
    try {
      const url = typeof window !== 'undefined' && window.location.port === '3001'
        ? 'http://localhost:3000/api/database'
        : '/api/database'
      const res = await fetch(url)
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        setRecords(data.data)
      }
    } catch (err) {
      console.error('Failed to load database:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDatabase()

    const socketUrl = typeof window !== 'undefined' && window.location.port === '3001'
      ? 'http://localhost:3000'
      : ''
    const socket = io(socketUrl, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Database View connected to socket')
    })

    socket.on('db_updated', () => {
      console.log('Database updated, refreshing...')
      fetchDatabase()
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const handleDelete = async (phone: string) => {
    if (!confirm(`Are you sure you want to delete the record for ${phone}?`)) return
    try {
      const url = typeof window !== 'undefined' && window.location.port === '3001'
        ? `http://localhost:3000/api/database/delete/${phone}`
        : `/api/database/delete/${phone}`
      const res = await fetch(url, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setRecords(prev => prev.filter(r => r.phone !== phone))
      } else {
        alert('Delete failed: ' + (data.error || 'Unknown error'))
      }
    } catch (err: any) {
      alert('Error deleting record: ' + err.message)
    }
  }

  const handleExport = () => {
    const url = typeof window !== 'undefined' && window.location.port === '3001'
      ? 'http://localhost:3000/api/database/export'
      : '/api/database/export'
    window.open(url, '_blank')
  }

  const filteredRecords = records.filter(r => 
    r.phone.includes(searchQuery) || 
    (r.courier && r.courier.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="ml-20 px-6 pb-6 h-[calc(100vh-120px)] flex flex-col gap-6"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Database size={24} className="text-amber-500" /> Historical Database
          </h1>
          <p className="text-sm text-gray-400 mt-1">Browse past records grouped by date</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 rounded-lg text-sm font-semibold text-white hover:shadow-lg hover:shadow-green-500/30 transition-all cursor-pointer"
          >
            <FileSpreadsheet size={16} /> Export Excel
          </button>
          <button
            onClick={fetchDatabase}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-800/80 border border-gray-700 rounded-lg text-sm font-semibold text-gray-300 hover:bg-gray-700/80 transition-all cursor-pointer"
          >
            <RotateCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Main card */}
      <div className="flex-1 min-h-0 bg-[#1E1E1E] rounded-2xl border border-[#333333] flex flex-col overflow-hidden shadow-2xl">
        {/* Search */}
        <div className="p-4 border-b border-[#333333] flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search by phone or courier..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-[#333333] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <span className="text-xs font-semibold text-green-400 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
            {filteredRecords.length} records found
          </span>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-[1.2fr_2.5fr_0.8fr_1fr_1fr_0.8fr_1fr_0.8fr] gap-4 px-6 py-5 bg-[#1A1A1A] border-b border-[#333333] text-sm font-semibold text-gray-400">
          <div className="flex items-center gap-2 text-blue-400"><Phone size={16} className="text-blue-500" /> <span className="text-gray-200">Phone</span></div>
          <div className="flex items-center gap-2 text-orange-400"><Truck size={16} className="text-orange-500" /> <span className="text-gray-200">Courier</span></div>
          <div className="flex items-center gap-2 text-cyan-400"><ClipboardList size={16} className="text-cyan-500" /> <span className="text-gray-200">Order</span></div>
          <div className="flex items-center gap-2 text-green-400"><CheckCircle size={16} className="text-green-500" /> <span className="text-gray-200">Delivery</span></div>
          <div className="flex items-center gap-2 text-red-400"><XCircle size={16} className="text-red-500" /> <span className="text-gray-200">Cancel</span></div>
          <div className="flex items-center gap-2 text-gray-400"><span className="text-gray-400 font-bold">%</span> <span className="text-gray-200">Rate</span></div>
          <div className="flex items-center gap-2 text-green-500"><MessageSquare size={16} className="text-green-500" /> <span className="text-gray-200">WhatsApp</span></div>
          <div className="text-right text-gray-400 pr-4">Action</div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
              <RotateCw size={36} className="animate-spin text-amber-500" />
              <span className="text-sm font-medium">Loading historical data...</span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-2 text-gray-500">
              <span className="text-5xl">📁</span>
              <span className="text-sm font-semibold">No records found</span>
            </div>
          ) : (
            <AnimatePresence>
              {filteredRecords.map((row) => (
                <motion.div
                  key={row.phone}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-[1.2fr_2.5fr_0.8fr_1fr_1fr_0.8fr_1fr_0.8fr] gap-4 px-6 py-4.5 border-b border-[#333333] items-center hover:bg-[#2A2A2A]/40 transition-colors"
                >
                  <div className="text-sm font-mono text-gray-300">{row.phone}</div>
                  <div className="text-sm text-gray-300 whitespace-nowrap overflow-hidden text-ellipsis" title={row.courier || '-'}>{row.courier || '-'}</div>
                  <div className="text-sm text-gray-300">{row.orders}</div>
                  <div>
                    <span className="px-3 py-1 bg-green-500/10 text-green-400 text-xs font-semibold rounded-full border border-green-500/20">
                      ✓ {row.delivery}
                    </span>
                  </div>
                  <div>
                    <span className="px-3 py-1 bg-red-500/10 text-red-400 text-xs font-semibold rounded-full border border-red-500/20">
                      ✕ {row.cancel}
                    </span>
                  </div>
                  <div>
                    <span className="px-3 py-1 bg-purple-500/10 text-purple-400 text-xs font-semibold rounded-full border border-purple-500/20">
                      {row.success_rate}
                    </span>
                  </div>
                  <div className="text-sm font-semibold">
                    {row.has_whatsapp ? (
                      <div className="flex items-center gap-2 text-green-400 font-mono">
                        <MessageSquare size={16} className="text-green-500" />
                        <span>{row.phone}</span>
                      </div>
                    ) : (
                      <span className="text-gray-600">-</span>
                    )}
                  </div>
                  <div className="text-right pr-2">
                    <button
                      onClick={() => handleDelete(row.phone)}
                      className="p-2 text-gray-500 hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/10 cursor-pointer"
                      title="Delete record"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </motion.div>
  )
}
