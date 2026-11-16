'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Link2, MessageSquareCode, ShieldCheck, Settings, Power } from 'lucide-react'
import { io, Socket } from 'socket.io-client'

export function SettingsView() {
  const [waReady, setWaReady] = useState(false)
  const [waMessage, setWaMessage] = useState('Initializing...')
  const [qrCode, setQrCode] = useState<string | null>(null)

  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const socketUrl = typeof window !== 'undefined' && window.location.port === '3001'
      ? 'http://localhost:3000'
      : '/'
    const socket = io(socketUrl, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Settings View connected to socket')
    })

    socket.on('wa_status', (data: { ready: boolean; message: string }) => {
      setWaReady(data.ready)
      setWaMessage(data.message)
      if (data.ready) {
        setQrCode(null)
      }
    })

    socket.on('qr_code', (qr: string) => {
      setQrCode(qr)
      setWaReady(false)
      setWaMessage('Scan QR to Connect')
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect WhatsApp session?')) return
    try {
      const url = typeof window !== 'undefined' && window.location.port === '3001'
        ? 'http://localhost:3000/api/whatsapp/disconnect'
        : '/api/whatsapp/disconnect'
      const res = await fetch(url, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setWaReady(false)
        setQrCode(null)
        setWaMessage('Disconnected. Refreshing QR...')
      }
    } catch (err: any) {
      alert('Error disconnecting session: ' + err.message)
    }
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
          <Settings size={24} className="text-purple-500" /> System Settings
        </h1>
        <p className="text-sm text-gray-400 mt-1">Manage integrations and platform preferences</p>
      </div>

      {/* Grid */}
      <div className="flex-1 min-h-0 grid grid-cols-3 gap-6 items-stretch">
        
        {/* Left: WhatsApp Checker Integration */}
        <div className="col-span-1 bg-[#1E1E1E] border border-[#333333] rounded-2xl p-6 flex flex-col gap-6 shadow-2xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-[#333333] pb-3">
            <MessageSquareCode size={16} className="text-green-500" /> WhatsApp Checker
          </h3>
          
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center bg-black/30 p-4 rounded-xl border border-[#333333]">
              <div className="flex flex-col">
                <span className="text-xs text-gray-300 font-bold">Enable Service</span>
                <span className="text-[10px] text-gray-500 mt-1">Verify WA accounts using QR Session</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={waReady} readOnly className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
              </label>
            </div>

            {/* WA Status */}
            <div className="bg-black/40 p-4 rounded-xl border border-[#333333] flex flex-col items-center justify-center min-h-[140px] text-center">
              {waReady ? (
                <div className="flex flex-col items-center gap-2 text-green-400">
                  <ShieldCheck size={40} />
                  <span className="text-sm font-bold">{waMessage}</span>
                </div>
              ) : qrCode ? (
                <div className="flex flex-col items-center gap-3">
                  <span className="text-xs text-gray-400 font-semibold">{waMessage}</span>
                  <div className="bg-white p-2 rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrCode)}&size=160x160`}
                      alt="WhatsApp QR Code"
                      className="w-40 h-40"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-semibold">{waMessage}</span>
                </div>
              )}
            </div>

            {(waReady || qrCode || waMessage.includes('Scan') || waMessage.includes('Initializing')) && (
              <button
                onClick={handleDisconnect}
                className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <Power size={14} /> Disconnect WhatsApp Session
              </button>
            )}
          </div>
        </div>

        {/* Right: Custom configs/placeholder */}
        <div className="col-span-2 bg-[#1E1E1E] border border-[#333333] rounded-2xl p-6 flex flex-col gap-6 shadow-2xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-[#333333] pb-3">
            <Link2 size={16} className="text-cyan-400" /> Platform Connections
          </h3>
          <div className="flex flex-col gap-4 text-sm text-gray-400">
            <p>Select different settings options. Custom system settings like operators scan intervals and limits configurations can be added in future patches.</p>
          </div>
        </div>

      </div>
    </motion.div>
  )
}
