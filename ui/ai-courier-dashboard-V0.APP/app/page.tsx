'use client'

import { useState } from 'react'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { AnnouncementBar } from '@/components/AnnouncementBar'
import { DashboardLayout } from '@/components/DashboardLayout'
import { DatabaseView } from '@/components/DatabaseView'
import { AnalyticsView } from '@/components/AnalyticsView'
import { ApiConfigView } from '@/components/ApiConfigView'
import { UserProfileView } from '@/components/UserProfileView'
import { SettingsView } from '@/components/SettingsView'
import { FooterBar } from '@/components/FooterBar'

export default function Home() {
  const [activeItem, setActiveItem] = useState('Dashboard')

  const renderActiveView = () => {
    switch (activeItem) {
      case 'Dashboard':
        return <DashboardLayout />
      case 'Database':
        return <DatabaseView />
      case 'Analytics':
        return <AnalyticsView />
      case 'API':
        return <ApiConfigView />
      case 'Users':
        return <UserProfileView />
      case 'Settings':
        return <SettingsView />
      default:
        return <DashboardLayout />
    }
  }

  return (
    <div className="min-h-screen bg-[#161616]">
      <Header />
      <Sidebar activeItem={activeItem} setActiveItem={setActiveItem} />
      <div className="ml-20" style={{ paddingTop: '64px', paddingBottom: '4px' }}>
        <AnnouncementBar />
      </div>
      <div className="pb-4">
        {renderActiveView()}
      </div>
      <div className="ml-20">
        <FooterBar />
      </div>
    </div>
  )
}
