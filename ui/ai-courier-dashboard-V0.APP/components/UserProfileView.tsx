'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, CreditCard, Camera, Trash2, ShieldCheck, Mail, PhoneIcon, CheckCircle2 } from 'lucide-react'

interface UserDetails {
  id: number
  username: string
  role: string
  email: string
  phone: string
  plan_name: string
  plan_status: string
  plan_expires: string
  profile_pic: string | null
}

export function UserProfileView() {
  const [profile, setProfile] = useState<UserDetails | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async () => {
    try {
      const url = typeof window !== 'undefined' && window.location.port === '3001'
        ? 'http://localhost:3000/api/profile'
        : '/api/profile'
      const res = await fetch(url)
      const data = await res.json()
      if (data.success && data.user) {
        setProfile(data.user)
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  const handlePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('profilePic', file)

    try {
      const uploadUrl = typeof window !== 'undefined' && window.location.port === '3001'
        ? 'http://localhost:3000/api/profile/upload-pic'
        : '/api/profile/upload-pic'
      const res = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (data.success) {
        setProfile(prev => prev ? { ...prev, profile_pic: data.profile_pic } : null)
        window.dispatchEvent(new CustomEvent('profile_updated', { detail: { profile_pic: data.profile_pic } }))
      }
    } catch (err: any) {
      alert('Pic upload error: ' + err.message)
    }
  }

  const handleRemovePic = async () => {
    if (!confirm('Are you sure you want to remove your profile picture?')) return
    try {
      const url = typeof window !== 'undefined' && window.location.port === '3001'
        ? 'http://localhost:3000/api/profile/remove-pic'
        : '/api/profile/remove-pic'
      const res = await fetch(url, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setProfile(prev => prev ? { ...prev, profile_pic: null } : null)
        window.dispatchEvent(new CustomEvent('profile_updated', { detail: { profile_pic: null } }))
      }
    } catch (err: any) {
      alert('Error removing picture: ' + err.message)
    }
  }

  const handleRenewSubscription = () => {
    alert('Plan renewal simulated: Gateway connection established successfully!')
  }

  if (loading) {
    return (
      <div className="ml-20 px-6 pb-6 h-[calc(100vh-120px)] flex flex-col items-center justify-center gap-3 text-gray-400">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Loading profile details...</span>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="ml-20 px-6 pb-6 h-[calc(100vh-120px)] flex flex-col items-center justify-center text-gray-500">
        <span className="text-sm font-semibold">User profile data unavailable.</span>
      </div>
    )
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
          <User size={24} className="text-purple-500" /> User Profile
        </h1>
        <p className="text-sm text-gray-400 mt-1">Manage your account and subscription details</p>
      </div>

      {/* Grid */}
      <div className="flex-1 min-h-0 grid grid-cols-3 gap-6 items-stretch">
        
        {/* Left: Avatar & subscription details */}
        <div className="col-span-1 flex flex-col gap-6">
          {/* Avatar card */}
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-2xl p-6 flex flex-col items-center gap-4 shadow-2xl text-center">
            <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-teal-600 to-emerald-600 flex items-center justify-center border-2 border-[#333333]">
              {profile.profile_pic ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={typeof window !== 'undefined' && window.location.port === '3001' ? `http://localhost:3000${profile.profile_pic}` : profile.profile_pic}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-bold text-white">{profile.username[0]?.toUpperCase()}</span>
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white leading-none">{profile.username}</h3>
              <span className="inline-block mt-2 px-3 py-1 bg-purple-500/10 text-purple-400 text-xs font-semibold rounded-full border border-purple-500/20 uppercase tracking-wider">
                {profile.role}
              </span>
            </div>
            
            <div className="flex gap-3 mt-2 w-full">
              <button
                onClick={() => document.getElementById('avatar-file-input')?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-800/80 border border-gray-700 hover:bg-gray-700/80 hover:text-white transition-all text-xs font-semibold text-gray-300 rounded-lg cursor-pointer"
              >
                <Camera size={14} /> Change
              </button>
              <button
                onClick={handleRemovePic}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-950/20 hover:bg-red-900/30 text-red-400 border border-red-900/30 transition-all text-xs font-semibold rounded-lg cursor-pointer"
              >
                <Trash2 size={14} /> Remove
              </button>
            </div>
            <input
              type="file"
              id="avatar-file-input"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePicUpload}
            />
          </div>

          {/* Subscription card */}
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-2xl p-6 flex flex-col gap-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-[#333333] pb-3">
              <CreditCard size={16} className="text-purple-400" /> Subscription Details
            </h3>
            <div className="flex flex-col gap-3.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400 font-semibold">Active Plan</span>
                <span className="text-white font-bold">{profile.plan_name || 'Free Trial'}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-gray-400 font-semibold">Status</span>
                <span className="px-2.5 py-0.5 bg-green-500/10 text-green-400 text-xs font-bold rounded-full border border-green-500/20 uppercase">
                  {profile.plan_status}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400 font-semibold">Valid Until</span>
                <span className="text-white font-bold">{profile.plan_expires || '—'}</span>
              </div>
            </div>
            <button
              onClick={handleRenewSubscription}
              className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 rounded-lg text-sm font-bold text-white hover:shadow-lg hover:shadow-teal-500/20 transition-all cursor-pointer mt-2"
            >
              Renew Subscription
            </button>
          </div>
        </div>

        {/* Right: Account Information */}
        <div className="col-span-2 bg-[#1E1E1E] border border-[#333333] rounded-2xl p-6 flex flex-col gap-6 shadow-2xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-[#333333] pb-3">
            <ShieldCheck size={16} className="text-cyan-400" /> Account Information
          </h3>
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3.5 p-4 bg-black/30 rounded-xl border border-[#333333]">
              <div className="p-3 bg-purple-500/10 text-purple-400 rounded-lg">
                <User size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 uppercase font-semibold">Username</span>
                <span className="text-base text-gray-200 font-bold mt-0.5">{profile.username}</span>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-4 bg-black/30 rounded-xl border border-[#333333]">
              <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-lg">
                <Mail size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 uppercase font-semibold">Email Address</span>
                <span className="text-base text-gray-200 font-bold mt-0.5">{profile.email || '—'}</span>
              </div>
            </div>

            <div className="flex items-center gap-3.5 p-4 bg-black/30 rounded-xl border border-[#333333]">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <PhoneIcon size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 uppercase font-semibold">Phone Number</span>
                <span className="text-base text-gray-200 font-bold mt-0.5">{profile.phone || '—'}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  )
}
