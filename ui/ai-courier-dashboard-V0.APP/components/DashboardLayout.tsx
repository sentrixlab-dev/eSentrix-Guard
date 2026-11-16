'use client'

import { motion } from 'framer-motion'
import { useState, useEffect, useRef, useCallback } from 'react'
import { RiskGaugeCard } from './RiskGaugeCard'
import { ScannerCard } from './ScannerCard'
import { LiveResults } from './LiveResults'
import { io, Socket } from 'socket.io-client'

// ─── Sound Synthesizer ────────────────────────────────────────────────────────
function playSynthSound(type: 'generate' | 'success' | 'fail' | 'complete') {
  if (typeof window === 'undefined') return
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
  if (!AudioCtx) return
  
  try {
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    
    if (type === 'generate') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.linearRampToValueAtTime(0, now + 0.1)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.1)
    } else if (type === 'success') {
      const notes = [261.63, 329.63, 392.00, 523.25]
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, now + index * 0.08)
        gain.gain.setValueAtTime(0, now + index * 0.08)
        gain.gain.linearRampToValueAtTime(0.12, now + index * 0.08 + 0.02)
        gain.gain.linearRampToValueAtTime(0, now + index * 0.08 + 0.25)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + index * 0.08)
        osc.stop(now + index * 0.08 + 0.25)
      })
    } else if (type === 'fail') {
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()
      osc1.frequency.setValueAtTime(150, now)
      osc2.frequency.setValueAtTime(152, now)
      gain.gain.setValueAtTime(0.18, now)
      gain.gain.linearRampToValueAtTime(0, now + 0.25)
      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(ctx.destination)
      osc1.start(now)
      osc2.start(now)
      osc1.stop(now + 0.25)
      osc2.stop(now + 0.25)
    } else if (type === 'complete') {
      const notes = [392.00, 523.25, 659.25, 783.99]
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + index * 0.1)
        gain.gain.setValueAtTime(0, now + index * 0.1)
        gain.gain.linearRampToValueAtTime(0.1, now + index * 0.1 + 0.02)
        gain.gain.linearRampToValueAtTime(0, now + index * 0.1 + 0.35)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + index * 0.1)
        osc.stop(now + index * 0.1 + 0.35)
      })
    }
  } catch (e) {
    console.error('Error playing sound:', e)
  }
}

type ScanStatus = 'idle' | 'generating' | 'scanning' | 'checking' | 'matched' | 'no_data'

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

export function DashboardLayout() {
  const RISK_H     = 280
  const GAP_TOP    = 40
  const SCANNER_H  = 660
  const leftColumnContentHeight = RISK_H + GAP_TOP + SCANNER_H // 980

  // ─── Socket.io State ────────────────────────────────────────────────────────
  const [isRunning,       setIsRunning]       = useState(false)
  const [status,          setStatus]          = useState<ScanStatus>('idle')
  const [currentNumber,   setCurrentNumber]   = useState('01XXXXXXXXX')
  const [revealedDigits,  setRevealedDigits]  = useState<boolean[]>(Array(11).fill(true))
  const [numberGlowing,   setNumberGlowing]   = useState(true)
  const [numberColor,     setNumberColor]     = useState<'default' | 'green' | 'red'>('default')
  const [exitDirection,   setExitDirection]   = useState<'up' | null>(null)
  const [isVisible,       setIsVisible]       = useState(true)
  const [queueNumbers,    setQueueNumbers]    = useState<string[]>([])
  const [progress,        setProgress]        = useState(0)
  const [scanCount,       setScanCount]       = useState({ done: 0, total: 0 })
  const [results,         setResults]         = useState({ found: 0, captured: 0 })
  const [speed,           setSpeed]           = useState(0)
  const [manualNumber,    setManualNumber]    = useState('')
  const [totalCount,      setTotalCount]      = useState(0)
  const [unlimitedMode,   setUnlimitedMode]   = useState(false)
  const [liveResults,     setLiveResults]     = useState<ResultRow[]>([])
  const [totals,          setTotals]          = useState({ orders: 0, delivery: 0, cancel: 0 })
  const [displayPercentage, setDisplayPercentage] = useState(0)

  const socketRef = useRef<Socket | null>(null)
  const prevNumberRef = useRef('')

  // ─── Digit Reveal Effect ───────────────────────────────────────────────────
  const revealDigits = useCallback((number: string): Promise<void> => {
    return new Promise(resolve => {
      setRevealedDigits(Array(number.length).fill(false))
      setNumberGlowing(false)
      let i = 0
      const next = () => {
        if (i >= number.length) {
          setTimeout(() => { setNumberGlowing(true); resolve() }, 100)
          return
        }
        setRevealedDigits(prev => {
          const arr = [...prev]; arr[i] = true; return arr
        })
        i++
        setTimeout(next, 45 + Math.random() * 25)
      }
      next()
    })
  }, [])

  // ─── Socket.io Connection & Listeners ──────────────────────────────────────
  useEffect(() => {
    const socketUrl = typeof window !== 'undefined' && window.location.port === '3001'
      ? 'http://localhost:3000'
      : '/'
    
    const socket = io(socketUrl, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Connected to backend Socket.io server')
    })

    socket.on('sync_state', async (data: any) => {
      if (data.isChecking) {
        setIsRunning(true)
        setStatus('checking')
        setScanCount({ done: data.currentIndex, total: data.totalCount })
        setProgress(data.queueLength > 0 ? Math.round((data.currentIndex / data.queueLength) * 100) : 0)
        setQueueNumbers([data.currentNumber])
        setCurrentNumber(data.currentNumber || '01XXXXXXXXX')
        setSpeed(280 + Math.floor(Math.random() * 150))
      } else {
        setIsRunning(false)
        setStatus('idle')
      }
      setUnlimitedMode(!!data.isUnlimited)
      setTotalCount(data.totalCount || 0)
      setResults(data.results || { found: 0, captured: 0 })
      setTotals(data.totals || { orders: 0, delivery: 0, cancel: 0 })
      setLiveResults(data.liveResults || [])
      
      const tOrders = data.totals?.orders || 0
      const tCancel = data.totals?.cancel || 0
      setDisplayPercentage(tOrders > 0 ? Math.round((tCancel / tOrders) * 100) : 0)
    })

    socket.on('status', (data: { message: string }) => {
      console.log('Status update:', data.message)
      if (data.message.includes('started')) {
        setIsRunning(true)
        setStatus('generating')
      } else if (data.message.includes('completed') || data.message.includes('stopped')) {
        setIsRunning(false)
        setStatus('idle')
        setProgress(0)
        setSpeed(0)
        if (data.message.includes('completed')) {
          playSynthSound('complete')
        }
      }
    })

    socket.on('progress', async (data: { current: number; total: number; isUnlimited?: boolean; phone: string; status: string }) => {
      setIsRunning(true)
      setScanCount({ done: data.current - 1, total: data.total })
      setProgress(Math.round(((data.current - 1) / data.total) * 100))
      
      // Update queue view
      setQueueNumbers(prev => {
        if (prev.includes(data.phone)) return prev
        return [data.phone, ...prev.slice(0, 2)]
      })

      if (data.phone !== prevNumberRef.current) {
        prevNumberRef.current = data.phone
        playSynthSound('generate')
        setStatus('generating')
        setIsVisible(true)
        setNumberColor('default')
        setNumberGlowing(false)
        setExitDirection(null)
        setCurrentNumber(data.phone)
        setSpeed(280 + Math.floor(Math.random() * 150))
        await revealDigits(data.phone)
      }

      if (data.status.includes('History')) {
        setStatus('scanning')
      } else if (data.status.includes('WhatsApp')) {
        setStatus('checking')
      }
    })

    socket.on('result', (data: {
      phone: string
      courier: string
      totalOrders: number
      totalDelivery: number
      totalCancel: number
      successRate: string
      hasWhatsApp: boolean
    }) => {
      setNumberColor(data.totalOrders > 0 ? 'green' : 'red')
      setStatus(data.totalOrders > 0 ? 'matched' : 'no_data')
      playSynthSound(data.totalOrders > 0 ? 'success' : 'fail')

      // Add to live results
      const parsedRate = parseInt(data.successRate) || 0
      const newRow: ResultRow = {
        id: Math.random().toString(),
        phone: data.phone,
        courier: data.courier || '-',
        order: String(data.totalOrders),
        delivery: String(data.totalDelivery),
        cancel: String(data.totalCancel),
        rate: parsedRate,
        whatsapp: data.hasWhatsApp
      }
      setLiveResults(prev => [newRow, ...prev.slice(0, 9)])

      // Update local scanner counters
      setResults(prev => {
        const foundInc = data.totalOrders > 0 ? 1 : 0
        const capturedInc = data.hasWhatsApp ? 1 : 0
        return {
          found: prev.found + foundInc,
          captured: prev.captured + capturedInc
        }
      })

      // Update Risk Gauge totals
      setTotals(prev => {
        const nextOrders = prev.orders + data.totalOrders
        const nextDelivery = prev.delivery + data.totalDelivery
        const nextCancel = prev.cancel + data.totalCancel

        // Calculate new overall risk rate percentage
        const overallRisk = nextOrders > 0 ? Math.round((nextCancel / nextOrders) * 100) : 0
        setDisplayPercentage(overallRisk)

        return {
          orders: nextOrders,
          delivery: nextDelivery,
          cancel: nextCancel
        }
      })

      // Animate card slide up
      setTimeout(() => {
        setExitDirection('up')
        setTimeout(() => {
          setIsVisible(false)
        }, 300)
      }, 800)
    })

    return () => {
      socket.disconnect()
    }
  }, [revealDigits])

  // ─── Actions ───────────────────────────────────────────────────────────────
  const handleToggleScanner = useCallback(() => {
    if (!socketRef.current) return
    if (isRunning) {
      socketRef.current.emit('stop_check')
    } else {
      setLiveResults([])
      setTotals({ orders: 0, delivery: 0, cancel: 0 })
      setDisplayPercentage(0)
      setResults({ found: 0, captured: 0 })
      socketRef.current.emit('start_random_check', { count: totalCount || (unlimitedMode ? 20 : 10), unlimited: unlimitedMode })
    }
  }, [isRunning, totalCount, unlimitedMode])

  const handleManualCheck = useCallback(() => {
    if (!socketRef.current || !manualNumber) return
    const num = manualNumber.replace(/\D/g, '')
    if (!/^01\d{9}$/.test(num)) {
      alert('Please enter a valid 11-digit Bangladeshi mobile number.')
      return
    }
    setLiveResults([])
    setTotals({ orders: 0, delivery: 0, cancel: 0 })
    setDisplayPercentage(0)
    setResults({ found: 0, captured: 0 })
    socketRef.current.emit('start_manual_check', { phone: num })
  }, [manualNumber])

  const handleUpload = useCallback(() => {
    if (typeof window === 'undefined') return
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = '.xlsx, .xls'
    fileInput.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return

      const formData = new FormData()
      formData.append('excelFile', file)

      try {
        const uploadUrl = typeof window !== 'undefined' && window.location.port === '3001'
          ? 'http://localhost:3000/api/upload'
          : '/api/upload'

        const res = await fetch(uploadUrl, {
          method: 'POST',
          body: formData
        })
        const data = await res.json()
        if (data.success) {
          alert(data.message)
          // Start the uploaded queue checks
          if (socketRef.current) {
            setLiveResults([])
            setTotals({ orders: 0, delivery: 0, cancel: 0 })
            setDisplayPercentage(0)
            setResults({ found: 0, captured: 0 })
            socketRef.current.emit('start_random_check', { count: data.count })
          }
        } else {
          alert('Upload failed: ' + (data.error || 'Unknown error'))
        }
      } catch (err: any) {
        alert('Error uploading file: ' + err.message)
      }
    }
    fileInput.click()
  }, [])

  return (
    <div className="ml-20 px-6" style={{ paddingTop: '4px', paddingBottom: '0' }}>
      <div
        style={{
          transform: 'scale(0.70)',
          transformOrigin: 'top left',
          marginBottom: `-${Math.round(leftColumnContentHeight * (1 - 0.70))}px`,
          width: `${(100 / 0.70).toFixed(4)}%`,
        }}
      >
        <div className="flex gap-5">

          {/* LEFT COLUMN - 34% */}
          <div className="w-[34%] relative">
            
            {/* Risk Gauge Card */}
            <div style={{ marginBottom: `${GAP_TOP}px` }}>
              <RiskGaugeCard
                displayPercentage={displayPercentage}
                orders={totals.orders}
                delivery={totals.delivery}
                cancel={totals.cancel}
              />
            </div>
            
            {/* Scanner Panel Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              style={{ height: `${SCANNER_H}px` }}
            >
              <ScannerCard
                isRunning={isRunning}
                status={status}
                currentNumber={currentNumber}
                revealedDigits={revealedDigits}
                numberGlowing={numberGlowing}
                numberColor={numberColor}
                exitDirection={exitDirection}
                isVisible={isVisible}
                queueNumbers={queueNumbers}
                progress={progress}
                scanCount={scanCount}
                results={results}
                speed={speed}
                manualNumber={manualNumber}
                setManualNumber={setManualNumber}
                totalCount={totalCount}
                setTotalCount={setTotalCount}
                unlimitedMode={unlimitedMode}
                setUnlimitedMode={setUnlimitedMode}
                onToggleScanner={handleToggleScanner}
                onManualCheck={handleManualCheck}
                onUpload={handleUpload}
              />
            </motion.div>
            
          </div>

          {/* RIGHT COLUMN - 66% */}
          <div className="w-[66%]" style={{ height: `${leftColumnContentHeight}px` }}>
            
            {/* Live Results Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="h-full rounded-2xl flex flex-col"
            >
              <LiveResults results={liveResults} />
            </motion.div>
            
          </div>

        </div>
      </div>
    </div>
  )
}
