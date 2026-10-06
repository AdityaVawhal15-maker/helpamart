import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, AlertCircle, Video, ShieldCheck, RefreshCw } from 'lucide-react'

type StatusResponse = {
  configured: boolean
  accountEmail?: string | null
  reason?: string
  detail?: string
  source?: string
}

export default function AdminMeet() {
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<StatusResponse | null>(null)

  const justConnected = searchParams.get('status') === 'connected'
  const connectedEmail = searchParams.get('email')

  async function checkStatus() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin-meet-status')
      const data = await res.json()
      setStatus(data)
    } catch {
      setStatus({ configured: false, reason: 'network_error', detail: 'Could not contact status endpoint' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkStatus()
  }, [])

  const isConnected = justConnected || status?.configured === true
  const displayEmail = connectedEmail || status?.accountEmail

  function handleConnect() {
    window.location.href = '/api/admin-meet-connect'
  }

  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-lg w-full bg-white rounded-3xl shadow-soft p-8 text-center border border-grey-soft relative overflow-hidden"
      >
        <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-6">
          <Video className="h-8 w-8 text-gold" />
        </div>

        <h1 className="text-display-md font-display text-navy mb-2">
          Central Google Meet Setup
        </h1>
        <p className="text-sm text-grey mb-8 leading-relaxed">
          One-time authorization for the central HELPAMART Google account.
          Every confirmed booking will automatically create a real Google Meet space.
        </p>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="h-6 w-6 text-gold animate-spin" />
            <span className="text-xs text-grey">Checking connection status…</span>
          </div>
        ) : isConnected ? (
          <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-emerald-900">
                    Google Meet Connected
                  </h3>
                  <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                    The central HELPAMART Google account is authorized. Every booking creates a genuine Google Meet room using the Google Meet REST API.
                  </p>
                  {displayEmail && (
                    <div className="mt-3 text-xs bg-white/80 py-1.5 px-3 rounded-lg text-emerald-900 font-mono inline-block">
                      {displayEmail}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-ivory-light rounded-2xl p-4 text-left space-y-2 text-xs text-navy/70">
              <div className="flex items-center gap-2 text-navy font-semibold">
                <ShieldCheck className="h-4 w-4 text-gold" />
                <span>Architecture Verified</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-grey pl-1">
                <li>Direct REST API: <code className="text-navy font-mono">POST https://meet.googleapis.com/v2/spaces</code></li>
                <li>Scope: <code className="text-navy font-mono">meetings.space.created</code></li>
                <li>No Google Calendar dependencies or mentor calendar connections</li>
                <li>Refresh token stored securely server-side</li>
              </ul>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={handleConnect}
                className="px-5 py-2.5 border border-grey-soft text-navy rounded-xl text-xs font-semibold hover:border-gold/40 hover:bg-ivory-light transition-colors"
              >
                Reconnect Google Meet
              </button>
              <button
                onClick={checkStatus}
                className="px-5 py-2.5 bg-navy text-white rounded-xl text-xs font-semibold hover:bg-navy-mid transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Re-check Status
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-left">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-amber-900">
                    Google Meet Not Connected
                  </h3>
                  <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                    Authorization is required before bookings can create Google Meet conferences. Click below to sign in with your central HELPAMART Google account.
                  </p>
                  {status?.detail && (
                    <p className="text-[11px] text-amber-800/80 mt-2 font-mono">
                      {status.detail}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleConnect}
              className="w-full py-4 bg-navy text-white rounded-xl font-semibold hover:bg-navy-mid transition-all hover:shadow-[0_6px_24px_rgba(7,26,53,0.2)] flex items-center justify-center gap-2"
            >
              <Video className="h-4 w-4" />
              Connect HELPAMART Google Meet
            </button>

            <div className="text-left text-xs text-grey space-y-1.5 bg-ivory-light p-4 rounded-2xl">
              <p className="font-semibold text-navy">One-time Authorization Details:</p>
              <p>• Only prompts once for the central HELPAMART Google account.</p>
              <p>• Requests only the direct Google Meet API scope.</p>
              <p>• Refresh token is stored server-side and never exposed to any browser.</p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
