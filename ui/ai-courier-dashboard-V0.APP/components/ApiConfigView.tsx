'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Key, Plus, Trash2, ShieldCheck, ShieldAlert, Activity } from 'lucide-react'
import { io, Socket } from 'socket.io-client'

interface ApiKeyRow {
  id: number
  courier_name: string
  key_value: string
  status: string
  usage_count: number
  last_reset_time: string
}

export function ApiConfigView() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([])
  const [courierName, setCourierName] = useState('BD Courier')
  const [keyValue, setKeyValue] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const socketUrl = typeof window !== 'undefined' && window.location.port === '3001'
      ? 'http://localhost:3000'
      : '/'
    const socket = io(socketUrl, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('API Config connected to socket')
      socket.emit('get_api_keys')
    })

    socket.on('api_keys_list', (list: ApiKeyRow[]) => {
      setKeys(list)
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const handleAddKey = (e: React.FormEvent) => {
    e.preventDefault()
    if (!keyValue.trim() || !socketRef.current) return
    setIsAdding(true)
    socketRef.current.emit('add_api_key', { courierName, keyValue })
    setKeyValue('')
    setIsAdding(false)
  }

  const handleDeleteKey = (id: number) => {
    if (!confirm('Are you sure you want to delete this API Key?') || !socketRef.current) return
    socketRef.current.emit('delete_api_key', { keyId: id })
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
          <Key size={24} className="text-purple-500" /> API Keys Configuration
        </h1>
        <p className="text-sm text-gray-400 mt-1">Manage multiple API keys for courier integration rotation pooling</p>
      </div>

      {/* Main Grid */}
      <div className="flex-1 min-h-0 grid grid-cols-3 gap-6 items-stretch">
        
        {/* Left: Add Key Form */}
        <div className="col-span-1 bg-[#1E1E1E] border border-[#333333] rounded-2xl p-6 flex flex-col gap-6 shadow-2xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-[#333333] pb-3">
            <Plus size={16} className="text-purple-400" /> Register API Key
          </h3>
          <form onSubmit={handleAddKey} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-400 font-semibold uppercase">Courier Name</label>
              <select
                value={courierName}
                onChange={e => setCourierName(e.target.value)}
                className="w-full bg-black/40 border border-[#333333] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50"
              >
                <option value="BD Courier">BD Courier</option>
                <option value="Steadfast">Steadfast</option>
                <option value="Redx">Redx</option>
                <option value="Pathao">Pathao</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-xs text-gray-400 font-semibold uppercase">API Key Token</label>
              <input
                type="text"
                placeholder="Enter API Key / Token"
                value={keyValue}
                onChange={e => setKeyValue(e.target.value)}
                required
                className="w-full bg-black/40 border border-[#333333] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <button
              type="submit"
              disabled={isAdding}
              className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 rounded-lg text-sm font-bold text-white hover:shadow-lg hover:shadow-teal-500/20 transition-all cursor-pointer mt-2"
            >
              {isAdding ? 'Adding...' : 'Add API Key'}
            </button>
          </form>
        </div>

        {/* Right: Keys list table */}
        <div className="col-span-2 bg-[#1E1E1E] border border-[#333333] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
          <div className="px-6 py-4 border-b border-[#333333] flex items-center justify-between flex-shrink-0">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity size={16} className="text-cyan-400" /> Active API Keys Pool
            </h3>
            <span className="text-xs font-semibold text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
              {keys.length} Keys Active
            </span>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-5 gap-4 px-6 py-4 bg-[#1A1A1A] border-b border-[#333333] text-xs font-bold text-gray-400 uppercase flex-shrink-0">
            <div>Courier</div>
            <div className="col-span-2">Key Value</div>
            <div>Daily Usage</div>
            <div className="text-right">Action</div>
          </div>

          {/* Table Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {keys.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2 text-gray-500">
                <span className="text-4xl">🔑</span>
                <span className="text-xs font-semibold">No API Keys registered yet</span>
              </div>
            ) : (
              <AnimatePresence>
                {keys.map(key => (
                  <motion.div
                    key={key.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-5 gap-4 px-6 py-4 border-b border-[#333333] items-center hover:bg-[#2A2A2A]/40 transition-colors"
                  >
                    <div className="text-sm font-semibold text-gray-200">{key.courier_name}</div>
                    <div className="col-span-2 text-xs font-mono text-gray-400 truncate pr-4">
                      {key.key_value.substring(0, 15)}••••••••••••
                    </div>
                    <div>
                      <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 text-xs font-semibold rounded-full border border-cyan-500/20">
                        {key.usage_count} / 50
                      </span>
                    </div>
                    <div className="text-right">
                      <button
                        onClick={() => handleDeleteKey(key.id)}
                        className="p-2 text-gray-500 hover:text-red-500 transition-colors rounded-lg hover:bg-red-500/10 cursor-pointer"
                        title="Delete key"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

      </div>
    </motion.div>
  )
}
