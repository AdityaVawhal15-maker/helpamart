import { useAuth } from '@/context/AuthContext'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function DashboardSettings() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-ivory">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-display-md font-display text-navy mb-8">Settings</h1>
          <div className="bg-white rounded-2xl border border-grey-soft divide-y divide-grey-soft">
            <SettingsRow label="Account" description={user?.email || ''} action={<Link to="/dashboard/profile" className="text-sm text-gold font-medium">Edit</Link>} />
            <SettingsRow label="Notifications" description="Manage email preferences" action={<span className="text-xs text-grey">Coming soon</span>} />
            <SettingsRow label="Become a Mentor" description="Share your experience with others" action={<Link to="/become-a-mentor" className="text-sm text-gold font-medium">Set up</Link>} />
            <SettingsRow
              label="Sign Out"
              description="Sign out of your HELPA account"
              action={
                <button onClick={logout} className="text-sm text-maroon font-medium">Sign Out</button>
              }
            />
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function SettingsRow({ label, description, action }: { label: string; description: string; action: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-5 gap-4">
      <div>
        <p className="text-sm font-semibold text-navy">{label}</p>
        <p className="text-xs text-grey mt-0.5">{description}</p>
      </div>
      {action}
    </div>
  )
}
