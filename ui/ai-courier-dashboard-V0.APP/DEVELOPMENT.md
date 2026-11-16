# Development Guide - AI Courier Data Analytic Dashboard

## Quick Start for Developers

### Setup
```bash
# Install dependencies
pnpm install

# Start dev server with hot reload
pnpm dev

# Open http://localhost:3000
```

### File Structure Quick Reference

| File | Purpose |
|------|---------|
| `/app/page.tsx` | Main dashboard layout |
| `/components/Header.tsx` | Top navigation bar |
| `/components/Sidebar.tsx` | Left menu with pages |
| `/components/RiskGauge.tsx` | Animated risk circle |
| `/components/ScannerPanel.tsx` | Number generator display |
| `/components/LiveResults.tsx` | Real-time data table |
| `/app/globals.css` | Theme colors and base styles |

## Component API

### RiskGauge
```tsx
<RiskGauge percentage={35} />
```
- Props: `percentage` (0-100)
- Colors: Blue at 0%, transitions through Purple, Orange, Yellow to Red at 100%
- Includes animated stat cards below gauge

### ScannerPanel
```tsx
const [isScanning, setIsScanning] = useState(false);
```
- Generates random 11-digit numbers
- Shows 3D digit rotation animation
- Updates every 800ms when scanning
- Displays Commands, Results Found, Data Captured metrics

### LiveResults
```tsx
const [results, setResults] = useState<ResultRow[]>([]);
```
- Auto-populates with mock data every 2 seconds
- Shows delivery (green) and cancel (red) badges
- WhatsApp indicator (green icon or gray dot)
- Slide-in animation for new rows

## Animation Patterns

### Fade-in Component
```tsx
import { motion } from 'framer-motion'

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
>
  Content
</motion.div>
```

### Pulsing Effect
```tsx
<motion.div
  animate={{ 
    boxShadow: [
      '0 0 20px rgba(168, 85, 247, 0.3)',
      '0 0 40px rgba(168, 85, 247, 0.6)',
      '0 0 20px rgba(168, 85, 247, 0.3)',
    ]
  }}
  transition={{ duration: 1, repeat: Infinity }}
>
  Pulsing content
</motion.div>
```

### Scroll Animation
```tsx
<motion.div
  animate={{ x: ['100%', '-100%'] }}
  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
>
  Scrolling content
</motion.div>
```

## Color System

### CSS Variables (in globals.css)
```css
--background-dark: #161616
--card-dark: #1E1E1E
--border-dark: #333333
--accent-gold: #D4AF37
--neon-blue: #00D9FF
--neon-purple: #A855F7
--neon-orange: #FF8C42
--success-green: #10B981
--danger-red: #EF4444
```

### Tailwind Usage
```tsx
// Background
className="bg-[#161616]"

// Cards
className="bg-[#1E1E1E]"

// Borders
className="border-[#333333]"

// Text colors
className="text-cyan-400"  // Neon blue
className="text-purple-600" // Neon purple
className="text-green-400"  // Success green
```

## State Management

### Current Pattern (useState)
```tsx
const [results, setResults] = useState<ResultRow[]>([])
const [isScanning, setIsScanning] = useState(false)
```

### For Backend Integration
Replace with:
```tsx
// Option 1: React Query
const { data: results } = useQuery('results', fetchResults)

// Option 2: SWR
const { data: results } = useSWR('/api/results', fetcher)

// Option 3: Context + Reducer
const [state, dispatch] = useContext(DashboardContext)
```

## Adding New Features

### Example: Add Command Count Selector
1. Update state in ScannerPanel.tsx:
```tsx
const [commandCount, setCommandCount] = useState(20)
```

2. Add click handler:
```tsx
<select value={commandCount} onChange={(e) => setCommandCount(Number(e.target.value))}>
  <option>10</option>
  <option>20</option>
  <option>50</option>
  <option>100</option>
</select>
```

3. Use in loop:
```tsx
if (isScanning && commandCount > 0) {
  // Generate number
}
```

### Example: Connect to Real API
```tsx
// In ScannerPanel.tsx
useEffect(() => {
  if (!isScanning) return

  const interval = setInterval(async () => {
    try {
      const response = await fetch('/api/scanner/generate')
      const data = await response.json()
      setDigits(data.number.split(''))
    } catch (error) {
      console.error('Failed to generate number', error)
    }
  }, 800)

  return () => clearInterval(interval)
}, [isScanning])
```

## Common Tasks

### Update Risk Percentage
```tsx
// In page.tsx
const [riskPercentage, setRiskPercentage] = useState(35)

// Update on data change
useEffect(() => {
  if (results.length > 0) {
    const risk = calculateRisk(results)
    setRiskPercentage(risk)
  }
}, [results])

return <RiskGauge percentage={riskPercentage} />
```

### Add New Navigation Item
1. Update Sidebar.tsx:
```tsx
const menuItems = [
  { icon: Home, label: 'Dashboard', href: '/' },
  { icon: Database, label: 'Database', href: '/database' },
  // Add new item:
  { icon: Settings, label: 'Reports', href: '/reports' },
]
```

2. Create page:
```bash
mkdir -p app/reports
touch app/reports/page.tsx
```

3. Add layout:
```tsx
export default function ReportsPage() {
  return <Dashboard>
    {/* Your reports content */}
  </Dashboard>
}
```

## Performance Tips

1. **Memoize Components**:
```tsx
export const RiskGauge = memo(function RiskGauge({ percentage }) {
  return (...)
})
```

2. **Use useCallback for Handlers**:
```tsx
const handleScannerStart = useCallback(() => {
  setIsScanning(true)
}, [])
```

3. **Lazy Load Heavy Components**:
```tsx
const ScannerPanel = dynamic(() => import('./ScannerPanel'), {
  loading: () => <Skeleton />
})
```

4. **Optimize Images**:
```tsx
import Image from 'next/image'
<Image src="/logo.png" alt="Logo" width={32} height={32} />
```

## Debugging

### Debug Animation
```tsx
// Add console.log to Framer Motion
<motion.div
  animate={{ opacity: [0, 1] }}
  onAnimationComplete={() => console.log('Animation done!')}
>
  Content
</motion.div>
```

### Debug State
```tsx
// Add in useEffect
useEffect(() => {
  console.log('[v0] Results updated:', results)
}, [results])
```

### Browser DevTools
- React DevTools: Inspect component tree, props, hooks
- Performance tab: Check 60fps for animations
- Network tab: Monitor API calls to /api/*
- Console: Check for errors and warnings

## Testing Checklist Before Deployment

- [ ] All animations run at 60fps (use Performance tab)
- [ ] No console errors or warnings
- [ ] Start button toggles to Stop and back
- [ ] Scanner generates new numbers every 800ms when running
- [ ] Live results table updates with new entries
- [ ] Risk gauge animates smoothly
- [ ] Announcement bar scrolls continuously
- [ ] Manual number input accepts text
- [ ] All icons render correctly
- [ ] Colors match the reference design
- [ ] Responsive on desktop (1920x1080+)
- [ ] No memory leaks (check DevTools)
- [ ] Page title and metadata correct

## Deployment

### To Vercel
```bash
# Connect GitHub repo
vercel link

# Deploy
vercel deploy
```

### Environment Variables
Create `.env.local`:
```
NEXT_PUBLIC_API_URL=https://your-api.com
NEXT_PUBLIC_ANALYTICS_ID=your-id
```

### Build Optimization
```bash
# Check build size
pnpm build

# Analyze bundle
npx next-bundle-analyzer
```

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Framer Motion Docs](https://www.framer.com/motion/)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Docs](https://react.dev)

## Support & Questions

For questions about specific components or animations, check the individual component files for inline comments and JSDoc documentation.

---

**Happy coding! 🚀**
