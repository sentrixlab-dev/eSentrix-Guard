'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, Database, RotateCcw, ChevronRight, Power, Phone } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ScanStatus = 'idle' | 'generating' | 'scanning' | 'checking' | 'matched' | 'no_data'

// ─── Constants ────────────────────────────────────────────────────────────────

const BD_PREFIXES = ['017', '018', '019', '016', '015', '013', '014']

const STATUS_LABELS: Record<ScanStatus, string> = {
  idle:       'Ready',
  generating: 'Generating Next Number',
  scanning:   'Scanning Database',
  checking:   'Cross-checking',
  matched:    'Match Found',
  no_data:    'No Data Found',
}

function randomPhone(): string {
  const prefix = BD_PREFIXES[Math.floor(Math.random() * BD_PREFIXES.length)]
  const rest = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('')
  return prefix + rest
}

function randomSpeed(): number {
  return 280 + Math.floor(Math.random() * 180)
}

// ─── WhatsApp Logo ─────────────────────────────────────────────────────────────

function WhatsAppIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.737-.98zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
    </svg>
  )
}

// ─── Holographic Equalizer Canvas ─────────────────────────────────────────────

function HoloWave({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef   = useRef<number | null>(null)
  const t         = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height

    // Color sampler: blue (left) → violet (center) → magenta (right)
    const colorAt = (frac: number): [number, number, number] => {
      if (frac < 0.5) {
        const k = frac / 0.5
        return [
          Math.round(59  + (139 - 59)  * k),
          Math.round(130 + (92  - 130) * k),
          Math.round(246 + (246 - 246) * k),
        ]
      }
      const k = (frac - 0.5) / 0.5
      return [
        Math.round(139 + (236 - 139) * k),
        Math.round(92  + (72  - 92)  * k),
        Math.round(246 + (153 - 246) * k),
      ]
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      const speed = active ? 0.045 : 0.012
      const amp   = active ? 1.0   : 0.45
      t.current  += speed

      const baseY = H * 0.52
      const globalOp = active ? 1 : 0.55

      // 1) Vertical holographic particle streaks (matrix rain) — concentrated at edges
      const streakCount = 46
      for (let i = 0; i < streakCount; i++) {
        const fx = i / streakCount
        // bias toward the edges (less behind the number)
        const edgeBias = Math.pow(Math.abs(fx - 0.5) * 2, 1.3)
        const sx = fx * W + Math.sin(i * 2.1) * 4
        const [r, g, b] = colorAt(fx)
        const streakLen = 5 + (i % 6)
        const baseOp = (0.05 + edgeBias * 0.10) * globalOp
        for (let d = 0; d < streakLen; d++) {
          const dotY = ((t.current * (14 + (i % 5) * 4) + i * 13 + d * 7) % H)
          const dotOp = baseOp * (1 - d / streakLen)
          ctx.beginPath()
          ctx.fillStyle = `rgba(${r},${g},${b},${dotOp})`
          ctx.arc(sx, dotY, 0.9, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // 2) Soft particle equalizer wave — dots along flowing sine curves
      const waveBands = [
        { freq: 0.016, ampMul: 0.85, phase: 0.0, yOff: 0,  size: 1.4, op: 0.55 },
        { freq: 0.021, ampMul: 1.0,  phase: 1.4, yOff: 3,  size: 1.6, op: 0.65 },
        { freq: 0.013, ampMul: 0.70, phase: 2.6, yOff: -4, size: 1.2, op: 0.45 },
        { freq: 0.026, ampMul: 1.15, phase: 0.7, yOff: 1,  size: 1.3, op: 0.40 },
      ]
      const step = 5
      waveBands.forEach(({ freq, ampMul, phase, yOff, size, op }) => {
        for (let x = 0; x <= W; x += step) {
          const fx = x / W
          const env = Math.sin(fx * Math.PI) // fade out at edges, peak center
          const a = 22 * amp * ampMul
          const y = baseY + yOff
            + Math.sin(x * freq + t.current + phase)              * a
            + Math.sin(x * freq * 2.1 + t.current * 1.4 + phase) * (a * 0.30)
          const [r, g, b] = colorAt(fx)
          const dotOp = op * env * globalOp
          if (dotOp <= 0.01) continue
          ctx.beginPath()
          ctx.fillStyle = `rgba(${r},${g},${b},${dotOp})`
          ctx.shadowColor = `rgba(${r},${g},${b},${dotOp})`
          ctx.shadowBlur = active ? 5 : 2
          ctx.arc(x, y, size, 0, Math.PI * 2)
          ctx.fill()
        }
      })
      ctx.shadowBlur = 0

      // 3) Single bright core ribbon — thin glowing line through the center of the wave
      ctx.beginPath()
      ctx.lineWidth = 1.4
      const coreGrad = ctx.createLinearGradient(0, 0, W, 0)
      coreGrad.addColorStop(0,   `rgba(59,130,246,${0.55 * globalOp})`)
      coreGrad.addColorStop(0.5, `rgba(139,92,246,${0.65 * globalOp})`)
      coreGrad.addColorStop(1,   `rgba(236,72,153,${0.55 * globalOp})`)
      ctx.strokeStyle = coreGrad
      ctx.shadowColor = `rgba(139,92,246,${0.5 * globalOp})`
      ctx.shadowBlur = active ? 7 : 3
      for (let x = 0; x <= W; x += 2) {
        const fx = x / W
        const env = Math.sin(fx * Math.PI)
        const a = 22 * amp
        const y = baseY
          + Math.sin(x * 0.021 + t.current + 1.4) * a * env
          + Math.sin(x * 0.044 + t.current * 1.4 + 1.4) * (a * 0.30) * env
        if (x === 0) ctx.moveTo(x, y)
        else         ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [active])

  return (
    <canvas
      ref={canvasRef}
      width={540}
      height={120}
      style={{ width: '100%', height: '120px', display: 'block' }}
    />
  )
}

// ─── Digit Slot Machine ────────────────────────────────────────────────────────

function DigitSlot({
  char, revealed, glowColor, textColor,
}: {
  char: string
  revealed: boolean
  glowColor: string
  textColor: string
}) {
  const [display, setDisplay] = useState(char)
  const rafRef   = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  const SPIN_MS  = 500

  useEffect(() => {
    if (!revealed) { setDisplay(char); return }
    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now
      const elapsed = now - startRef.current
      if (elapsed < SPIN_MS) {
        setDisplay(String(Math.floor(Math.random() * 10)))
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setDisplay(char)
        startRef.current = null
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [revealed, char])

  return (
    <span
      style={{
        fontFamily: "'Courier New', 'Lucida Console', monospace",
        fontSize: '44px',
        fontWeight: 900,
        letterSpacing: '2px',
        color: textColor,
        textShadow: glowColor,
        display: 'inline-block',
        minWidth: '27px',
        textAlign: 'center',
        lineHeight: 1,
      }}
    >
      {display}
    </span>
  )
}

// ─── Perspective Rolling Platform ──────────────────────────────────────────────

function PerspectiveQueue({ numbers }: { numbers: string[] }) {
  const rows = numbers.slice(0, 3)
  // Front row largest/brightest, receding rows smaller + dimmer
  const rowStyle = [
    { fontSize: '17px', opacity: 0.70, blur: 0,    color: '230,236,255' },
    { fontSize: '15px', opacity: 0.42, blur: 0.4,  color: '190,200,235' },
    { fontSize: '13px', opacity: 0.22, blur: 0.9,  color: '150,162,205' },
  ]
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '92px',
        perspective: '420px',
        perspectiveOrigin: '50% -10%',
      }}
    >
      {/* Tilted holographic platform surface */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '6px',
          width: '74%',
          height: '96px',
          transform: 'translateX(-50%) rotateX(58deg)',
          transformOrigin: '50% 0%',
          background: 'linear-gradient(180deg, rgba(40,46,80,0.32) 0%, rgba(20,24,46,0.16) 45%, rgba(10,12,24,0) 100%)',
          borderTop: '1px solid rgba(120,140,220,0.25)',
          borderRadius: '4px',
          // Horizontal "rail" lines for mechanical depth
          backgroundImage: 'repeating-linear-gradient(180deg, rgba(120,140,220,0.10) 0px, rgba(120,140,220,0.10) 1px, transparent 1px, transparent 26px)',
        }}
      />
      {/* Rolling number rows */}
      <div style={{ position: 'relative', zIndex: 1, paddingTop: '4px' }}>
        <AnimatePresence initial={false}>
          {rows.map((n, i) => {
            const s = rowStyle[i]
            return (
              <motion.div
                key={n}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: s.opacity, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                style={{
                  fontFamily: "'Courier New', monospace",
                  fontStyle: 'italic',
                  fontSize: s.fontSize,
                  fontWeight: 700,
                  letterSpacing: '5px',
                  color: `rgba(${s.color},${s.opacity})`,
                  textAlign: 'center',
                  lineHeight: '1.7',
                  filter: s.blur ? `blur(${s.blur}px)` : 'none',
                  textShadow: `0 0 6px rgba(99,102,241,${s.opacity * 0.6})`,
                }}
              >
                {n}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Circular Progress ─────────────────────────────────────────────────────────

function CircleProgress({ pct }: { pct: number }) {
  const r    = 17
  const circ = 2 * Math.PI * r
  const dash = circ - (pct / 100) * circ

  return (
    <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
      <motion.circle
        cx="22" cy="22" r={r}
        fill="none"
        stroke="url(#cpGrad)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={circ}
        animate={{ strokeDashoffset: dash }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
      <defs>
        <linearGradient id="cpGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#ec4899" />
          <stop offset="50%"  stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface ScannerCardProps {
  isRunning: boolean
  status: ScanStatus
  currentNumber: string
  revealedDigits: boolean[]
  numberGlowing: boolean
  numberColor: 'default' | 'green' | 'red'
  exitDirection: 'up' | null
  isVisible: boolean
  queueNumbers: string[]
  progress: number
  scanCount: { done: number; total: number }
  results: { found: number; captured: number }
  speed: number
  manualNumber: string
  setManualNumber: (val: string) => void
  totalCount: number
  setTotalCount: (val: number) => void
  unlimitedMode: boolean
  setUnlimitedMode: (val: boolean) => void
  onToggleScanner: () => void
  onManualCheck: () => void
  onUpload: () => void
}

export function ScannerCard({
  isRunning,
  status,
  currentNumber,
  revealedDigits,
  numberGlowing,
  numberColor,
  exitDirection,
  isVisible,
  queueNumbers,
  progress,
  scanCount,
  results,
  speed,
  manualNumber,
  setManualNumber,
  totalCount,
  setTotalCount,
  unlimitedMode,
  setUnlimitedMode,
  onToggleScanner,
  onManualCheck,
  onUpload
}: ScannerCardProps) {
  const [ripples,         setRipples]         = useState<{ id: number; x: number; y: number }[]>([])
  const [loadingDots,     setLoadingDots]     = useState('...')
  const [mounted,         setMounted]         = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setLoadingDots(d => d.length >= 3 ? '.' : d + '.')
    }, 500)
    return () => clearInterval(id)
  }, [])

  const numGlow =
    numberColor === 'green'
      ? '0 0 4px rgba(255,255,255,0.9), 0 0 12px rgba(52,211,153,0.7), 0 0 26px rgba(52,211,153,0.35)'
      : numberColor === 'red'
      ? '0 0 4px rgba(255,255,255,0.9), 0 0 12px rgba(248,113,113,0.7), 0 0 26px rgba(248,113,113,0.35)'
      : numberGlowing
      ? '0 0 4px rgba(255,255,255,0.95), 0 0 11px rgba(191,219,254,0.75), 0 0 24px rgba(99,102,241,0.45), 0 0 44px rgba(59,130,246,0.22)'
      : '0 0 4px rgba(255,255,255,0.55), 0 0 10px rgba(99,102,241,0.18)'

  const numTextColor =
    numberColor === 'green' ? '#86efac'
    : numberColor === 'red' ? '#fca5a5'
    : '#ffffff'

  const pct = scanCount.total > 0 ? Math.round((scanCount.done / scanCount.total) * 100) : 0

  return (
    <div
      className="w-full h-full rounded-2xl flex flex-col overflow-hidden"
      style={{
        // Pure charcoal graphite — zero blue/purple tint
        background: '#141414',
        border: '1px solid rgba(255,255,255,0.09)',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.6), 0 4px 32px rgba(0,0,0,0.70)',
      }}
    >

      {/* ── 1. Statistics Row ──────────────────────────────────────────────────── */}
      <div
        className="flex flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        {[
          { icon: <Terminal size={11} />, label: 'COMMANDS',        value: `${scanCount.done} / ${unlimitedMode ? '∞' : scanCount.total || 0}`, color: '#60a5fa', iconColor: '#60a5fa' },
          { icon: <Database size={11} />,  label: 'DATA CAPTURED',   value: String(results.found),                  color: '#a78bfa', iconColor: '#a78bfa' },
          { icon: <WhatsAppIcon size={12} />, label: 'WHATSAPP CAPTURE', value: String(results.captured),            color: '#4ade80', iconColor: '#4ade80' },
        ].map((s, i) => (
          <div
            key={i}
            className="flex-1 flex flex-col items-center justify-center"
            style={{ borderRight: i < 2 ? '1px solid rgba(255,255,255,0.07)' : 'none', paddingTop: '8px', paddingBottom: '8px' }}
          >
            <div className="flex items-center gap-1.5" style={{ color: s.iconColor, marginBottom: '3px' }}>
              {s.icon}
              <span style={{ fontSize: '9px', color: 'rgba(150,150,180,0.80)', letterSpacing: '0.13em', fontWeight: 600 }}>
                {s.label}
              </span>
            </div>
            <motion.span
              key={s.value}
              initial={{ opacity: 0.5, y: -2 }}
              animate={{ opacity: 1,   y: 0   }}
              transition={{ duration: 0.2 }}
              style={{ fontSize: '18px', fontWeight: 800, color: s.color, letterSpacing: '0.5px', fontVariantNumeric: 'tabular-nums' }}
            >
              {s.value}
            </motion.span>
          </div>
        ))}
      </div>

      {/* ── 2. Holographic Monitor Display ───────────────────────────���────────── */}
      <div
        className="relative mx-2 mt-2 rounded-xl flex-shrink-0 overflow-hidden"
        style={{
          height: '220px',
          background: 'radial-gradient(ellipse 70% 60% at 50% 42%, #11131a 0%, #0c0d12 45%, #0a0a0e 75%, #08080b 100%)',
          border: '1px solid rgba(70,80,120,0.35)',
          boxShadow: 'inset 0 0 60px rgba(30,40,70,0.25), inset 0 1px 0 rgba(120,140,200,0.06)',
        }}
      >
        {/* Scanline overlay — subtle horizontal lines for CRT depth */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,20,0.10) 3px, rgba(0,0,20,0.10) 4px)',
            zIndex: 2,
          }}
        />
        {/* Vignette — darkens corners for depth */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)',
            zIndex: 2,
          }}
        />

        {/* Corner brackets */}
        {([
          { top: 8,    left: 8,   st: { borderTop: '2px solid rgba(99,102,241,0.80)', borderLeft: '2px solid rgba(99,102,241,0.80)' } },
          { top: 8,    right: 8,  st: { borderTop: '2px solid rgba(99,102,241,0.80)', borderRight: '2px solid rgba(99,102,241,0.80)' } },
          { bottom: 8, left: 8,   st: { borderBottom: '2px solid rgba(99,102,241,0.80)', borderLeft: '2px solid rgba(99,102,241,0.80)' } },
          { bottom: 8, right: 8,  st: { borderBottom: '2px solid rgba(99,102,241,0.80)', borderRight: '2px solid rgba(99,102,241,0.80)' } },
        ] as const).map((c, i) => (
          <div
            key={i}
            className="absolute"
            style={{ ...c.st, width: 16, height: 16, top: 'top' in c ? c.top : undefined, bottom: 'bottom' in c ? c.bottom : undefined, left: 'left' in c ? c.left : undefined, right: 'right' in c ? c.right : undefined }}
          />
        ))}

        {/* AI Scanning Active header */}
        <div className="relative z-10 flex items-center justify-center gap-2 pt-2.5">
          <div style={{ height: '1px', width: '36px', background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.75))' }} />
          <div className="flex items-center gap-1.5">
            <motion.div
              animate={isRunning ? { opacity: [0.4, 1, 0.4] } : { opacity: 0.45 }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{ width: 5, height: 5, borderRadius: '50%', background: isRunning ? '#818cf8' : '#4b5563' }}
            />
            <span style={{ fontSize: '8px', letterSpacing: '0.22em', color: 'rgba(165,170,220,0.85)', fontWeight: 700 }}>
              AI SCANNING ACTIVE
            </span>
            <motion.div
              animate={isRunning ? { opacity: [0.4, 1, 0.4] } : { opacity: 0.45 }}
              transition={{ duration: 1.2, repeat: Infinity, delay: 0.6 }}
              style={{ width: 5, height: 5, borderRadius: '50%', background: isRunning ? '#818cf8' : '#4b5563' }}
            />
          </div>
          <div style={{ height: '1px', width: '36px', background: 'linear-gradient(90deg, rgba(99,102,241,0.75), transparent)' }} />
        </div>

        {/* Wave — z-index 3, sits BEHIND number (number is z-10) */}
        <div
          className="absolute left-0 right-0"
          style={{
            top: '30px',
            bottom: '0px',
            opacity: isRunning ? 1 : 0.35,
            transition: 'opacity 1.0s ease',
            zIndex: 3,
          }}
        >
          <HoloWave active={isRunning} />
        </div>

        {/* Number — positioned in upper portion, z-10 ensures it's above the wave */}
        <div
          className="absolute left-0 right-0 flex flex-col items-center"
          style={{ top: '44px', zIndex: 10 }}
        >
          <AnimatePresence mode="wait">
            {isVisible && (
              <motion.div
                key={currentNumber + numberColor}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0,  opacity: 1 }}
                exit={exitDirection === 'up'
                  ? { y: -36, opacity: 0, transition: { duration: 0.36, ease: 'easeIn' } }
                  : { opacity: 0 }
                }
                transition={{ duration: 0.28, ease: 'easeOut' }}
                style={{ display: 'flex', alignItems: 'center', gap: '0px' }}
              >
                {currentNumber.split('').map((ch, i) => (
                  <DigitSlot
                    key={i}
                    char={ch}
                    revealed={revealedDigits[i] ?? true}
                    glowColor={numGlow}
                    textColor={numTextColor}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Perspective queue — client-only */}
          <div className="w-full px-6" style={{ marginTop: '2px' }}>
            {mounted && <PerspectiveQueue numbers={queueNumbers} />}
          </div>
        </div>
      </div>

      {/* ── 3. Status Panel — visually attached to the scanner display ─────────── */}
      <div
        className="mx-2 mt-1.5 rounded-xl px-3 pt-2 pb-1.5 flex-shrink-0"
        style={{
          background: 'rgba(8,8,14,0.95)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div className="flex items-stretch gap-0">

          {/* Scanning Progress */}
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 flex-shrink-0"
            style={{ minWidth: '112px' }}
          >
            <div className="relative flex-shrink-0" style={{ width: 44, height: 44 }}>
              <CircleProgress pct={pct} />
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ fontSize: '9.5px', fontWeight: 800, color: '#e2e8f0' }}
              >
                {pct}%
              </div>
            </div>
            <div className="flex flex-col">
              <span style={{ fontSize: '8px', color: 'rgba(120,120,160,0.75)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
                Scanning Progress
              </span>
              <motion.span
                key={scanCount.done}
                initial={{ opacity: 0.4 }}
                animate={{ opacity: 1 }}
                style={{ fontSize: '15px', fontWeight: 800, color: '#f472b6', fontVariantNumeric: 'tabular-nums' }}
              >
                {scanCount.done}/{unlimitedMode ? '∞' : scanCount.total || 0}
              </motion.span>
            </div>
          </div>

          {/* Status — rounded pill, horizontal layout */}
          <div className="flex-1 flex items-center px-2">
            <div
              className="w-full flex items-center justify-between rounded-full px-3 py-2"
              style={{
                background: 'rgba(255,255,255,0.035)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M2 12h3l2-6 4 12 3-9 2 3h6" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: '9px', color: 'rgba(140,145,180,0.85)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>
                  Status
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#22d3ee', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {STATUS_LABELS[status]}
                </span>
                <div className="flex gap-0.5 items-center">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      style={{ width: 3, height: 3, borderRadius: '50%', background: '#22d3ee' }}
                      animate={isRunning ? { opacity: [0.2, 1, 0.2] } : { opacity: 0.5 }}
                      transition={{ duration: 1.0, delay: i * 0.22, repeat: Infinity }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Speed */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0"
            style={{ minWidth: '88px' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="9" stroke="#22d3ee" strokeWidth="1.6"/>
              <path d="M12 7v5l3.5 2" stroke="#22d3ee" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            <div className="flex flex-col">
              <span style={{ fontSize: '8px', color: 'rgba(120,120,160,0.75)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
                Speed
              </span>
              <motion.span
                key={speed}
                initial={{ opacity: 0.5, y: -2 }}
                animate={{ opacity: 1,   y: 0   }}
                transition={{ duration: 0.18 }}
                style={{ fontSize: '14px', fontWeight: 800, color: '#22d3ee', fontVariantNumeric: 'tabular-nums' }}
              >
                {speed}°/s
              </motion.span>
            </div>
          </div>
        </div>

        {/* Gradient loading bar — thin, rounded, diagonal RGB stripes, soft glow */}
        <div
          className="mt-2 w-full overflow-hidden rounded-full"
          style={{ height: '7px', background: 'rgba(255,255,255,0.05)' }}
        >
          <motion.div
            className="h-full rounded-full relative overflow-hidden"
            style={{
              background: 'linear-gradient(90deg, #ec4899 0%, #c084fc 22%, #818cf8 42%, #06b6d4 66%, #10b981 88%, #a3e635 100%)',
              boxShadow: '0 0 10px rgba(168,85,247,0.6), 0 0 18px rgba(6,182,212,0.4)',
            }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            {/* Animated diagonal stripe overlay */}
            <motion.div
              className="absolute inset-0"
              style={{
                backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 2px, transparent 2px, transparent 7px)',
              }}
              animate={{ backgroundPositionX: ['0px', '14px'] }}
              transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
            />
          </motion.div>
        </div>

        {/* Loading status text */}
        <div className="flex justify-center mt-1.5 mb-0.5">
          <span style={{ fontSize: '8.5px', color: 'rgba(34,211,238,0.75)', letterSpacing: '0.08em' }}>
            Loading &amp; Processing Data{loadingDots}
          </span>
        </div>
      </div>

      {/* ── 4. Manual Number Check ─────────────────────────────────────────────── */}
      <style>{`
        .manual-num-input::placeholder {
          font-size: 11px;
          font-weight: 400;
          letter-spacing: 0;
          color: rgba(120,120,150,0.65);
        }
        @keyframes ripple-fx {
          from { transform: scale(0); opacity: 0.45; }
          to   { transform: scale(2.6); opacity: 0; }
        }
      `}</style>
      <div
        className="mx-2 mt-2 rounded-xl px-3 py-3 flex-shrink-0"
        style={{
          background: 'rgba(10,10,14,0.90)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="#9ca3af" strokeWidth="2"/>
            <path d="m21 21-4.35-4.35" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#d1d5db', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
            Manual Number Check
          </span>
        </div>
        <div className="flex gap-2" style={{ marginTop: '9px' }}>
          <div
            className="flex-1 flex items-center gap-2 rounded-lg px-3"
            style={{
              background: 'rgba(255,255,255,0.035)',
              border: '1px solid rgba(255,255,255,0.10)',
              height: '46px',
            }}
          >
            <Phone size={14} style={{ color: 'rgba(120,120,160,0.7)', flexShrink: 0 }} />
            <input
              className="manual-num-input"
              type="text"
              inputMode="numeric"
              placeholder="Enter mobile number (e.g. 01XXXXXXXXX)"
              value={manualNumber}
              onChange={e => setManualNumber(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onManualCheck() }}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '17px',
                fontWeight: 600,
                letterSpacing: '1px',
                lineHeight: '46px',
                color: '#f1f5f9',
                fontFamily: "'Courier New', monospace",
              }}
            />
          </div>
          <motion.button
            className="flex items-center justify-center gap-2 flex-shrink-0 relative overflow-hidden"
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect()
              const id = Date.now()
              setRipples(prev => [...prev, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }])
              setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 600)
              onManualCheck()
            }}
            whileHover={{
              filter: 'brightness(1.18)',
              boxShadow: '0 0 22px rgba(168,85,247,0.65), 0 0 40px rgba(168,85,247,0.32)',
            }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{
              height: '46px',
              padding: '0 22px',
              borderRadius: '999px',
              border: 'none',
              background: 'linear-gradient(#0c0c12, #0c0c12) padding-box, linear-gradient(135deg, #22d3ee, #a855f7 55%, #ec4899) border-box',
              borderStyle: 'solid',
              borderWidth: '1.5px',
              borderColor: 'transparent',
              boxShadow: '0 0 16px rgba(168,85,247,0.40), 0 0 28px rgba(34,211,238,0.18)',
              fontSize: '10px',
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '0.12em',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {ripples.map(r => (
              <span
                key={r.id}
                style={{
                  position: 'absolute',
                  left: r.x,
                  top: r.y,
                  width: 40,
                  height: 40,
                  marginLeft: -20,
                  marginTop: -20,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.55)',
                  pointerEvents: 'none',
                  animation: 'ripple-fx 0.6s ease-out forwards',
                }}
              />
            ))}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ position: 'relative', zIndex: 1 }}>
              <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ position: 'relative', zIndex: 1 }}>CHECK NOW</span>
          </motion.button>
          <motion.button
            className="flex items-center justify-center gap-2 flex-shrink-0 relative overflow-hidden"
            onClick={onUpload}
            whileHover={{
              filter: 'brightness(1.18)',
              boxShadow: '0 0 22px rgba(6,182,212,0.65), 0 0 40px rgba(6,182,212,0.32)',
            }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{
              height: '46px',
              padding: '0 22px',
              borderRadius: '999px',
              border: 'none',
              background: 'linear-gradient(#0c0c12, #0c0c12) padding-box, linear-gradient(135deg, #06b6d4, #3b82f6) border-box',
              borderStyle: 'solid',
              borderWidth: '1.5px',
              borderColor: 'transparent',
              boxShadow: '0 0 16px rgba(6,182,212,0.40), 0 0 28px rgba(59,130,246,0.18)',
              fontSize: '10px',
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '0.12em',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <span>UPLOAD EXCEL</span>
          </motion.button>
        </div>
      </div>

      {/* ── 5. Bottom Controls ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-10 pt-6 pb-3 flex-shrink-0">

        {/* Command count pill */}
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={unlimitedMode ? '∞' : totalCount === 0 ? '00' : String(totalCount)}
          disabled={isRunning || unlimitedMode}
          onChange={e => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 3)
            if (val) {
              setTotalCount(parseInt(val))
            } else {
              setTotalCount(0)
            }
          }}
          style={{
            width: '44px', height: '44px',
            background: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '50%',
            textAlign: 'center',
            fontSize: unlimitedMode ? '22px' : totalCount >= 100 ? '11px' : '14px',
            fontWeight: 800,
            color: '#ffffff',
            outline: 'none',
            pointerEvents: (isRunning || unlimitedMode) ? 'none' : 'auto',
          }}
        />

        {/* Main toggle button — stable glow, no continuous pulse */}
        <button
          onClick={onToggleScanner}
          style={{
            width: '92px', height: '92px',
            borderRadius: '50%',
            border: isRunning
              ? '1.5px solid rgba(248,113,113,0.45)'
              : '1.5px solid rgba(45,212,191,0.45)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isRunning
              ? 'linear-gradient(145deg, #dc2626 0%, #991b1b 55%, #7f1d1d 100%)'
              : 'linear-gradient(145deg, #22d3ee 0%, #14b8a6 50%, #10b981 100%)',
            boxShadow: isRunning
              ? '0 0 14px rgba(248,113,113,0.32), 0 0 26px rgba(248,113,113,0.12)'
              : '0 0 13px rgba(34,211,238,0.28), 0 0 24px rgba(16,185,129,0.12)',
            transition: 'background 0.4s ease, box-shadow 0.4s ease, border-color 0.4s ease',
            flexShrink: 0,
          }}
        >
          <AnimatePresence mode="wait">
            {isRunning ? (
              <motion.div
                key="stop"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1,   opacity: 1 }}
                exit={{   scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                <Power
                  size={33}
                  strokeWidth={2.5}
                  style={{
                    color: '#ffffff',
                    filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.6))',
                  }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="start"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1,   opacity: 1 }}
                exit={{   scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                <ChevronRight
                  size={42}
                  strokeWidth={2.5}
                  style={{
                    color: '#ffffff',
                    filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.85))',
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {/* Refresh / loop pill */}
        <div
          onClick={() => { if (!isRunning) setUnlimitedMode(!unlimitedMode) }}
          className="flex items-center justify-center rounded-full"
          style={{
            width: '44px', height: '44px',
            background: unlimitedMode ? 'linear-gradient(145deg, #3730a3, #4338ca)' : '#1a1a1a',
            border: unlimitedMode ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.10)',
            boxShadow: unlimitedMode ? '0 0 12px rgba(99,102,241,0.4)' : 'none',
            cursor: isRunning ? 'default' : 'pointer',
            transition: 'all 0.3s ease',
          }}
        >
          <RotateCcw size={18} style={{ color: unlimitedMode ? '#ffffff' : 'rgba(255,255,255,0.7)' }} />
        </div>
      </div>

    </div>
  )
}
