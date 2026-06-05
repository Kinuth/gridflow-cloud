import React from 'react'
import { User, Shield, Building2, Mail, KeyRound, LogOut, CheckCircle2 } from 'lucide-react'

export default function Profile({
  token,
  username,
  email,
  accountType,
  orgName,
  orgType,
  onSignOut
}) {
  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto pb-16">
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-slate-100">User Account Profile</h1>
        <p className="text-xs text-slate-400 mt-1">Manage credentials, view organization status, and session detail.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Avatar Card */}
        <div className="bg-[#12181D] border border-slate-800 rounded-2xl p-6 text-center shadow-lg space-y-4 flex flex-col items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-3xl shadow-lg shadow-emerald-500/5">
            {username ? username.substring(0, 2).toUpperCase() : 'GF'}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">{username || 'GridFlow Operator'}</h3>
            <p className="text-xs text-slate-400 mt-0.5 font-medium capitalize">{accountType || 'individual'} Owner</p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Active Operator</span>
          </div>

          <div className="w-full pt-4 border-t border-slate-800/80">
            <button
              onClick={onSignOut}
              className="flex items-center justify-center gap-2 w-full bg-rose-500/10 hover:bg-rose-500 text-rose-450 hover:text-white border border-rose-500/20 text-xs font-semibold py-2.5 rounded-xl transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out of Platform</span>
            </button>
          </div>
        </div>

        {/* Right Column: Account Details */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-[#12181D] border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
            <h3 className="text-sm font-semibold text-slate-200 border-b border-slate-850 pb-2">Profile & Identity Details</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Username */}
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-slate-800/50 text-slate-400 border border-slate-750">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider">Username</span>
                  <span className="text-xs font-semibold text-slate-250">{username || 'Not Available'}</span>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-slate-800/50 text-slate-400 border border-slate-750">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider">Email Address</span>
                  <span className="text-xs font-semibold text-slate-250">{email || 'Not Available'}</span>
                </div>
              </div>

              {/* Account Type */}
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-slate-800/50 text-slate-400 border border-slate-750">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider">Account Role</span>
                  <span className="text-xs font-semibold text-slate-250 capitalize">{accountType || 'individual'} Account</span>
                </div>
              </div>

              {/* Organization Type / Name if Organization */}
              {accountType === 'organization' && (
                <>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-slate-800/50 text-slate-400 border border-slate-750">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider">Organization Name</span>
                      <span className="text-xs font-semibold text-slate-250">{orgName || 'Not Specified'}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-slate-800/50 text-slate-400 border border-slate-750">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider">Org Category</span>
                      <span className="text-xs font-semibold text-slate-250 capitalize">{orgType || 'Household'}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Security & Access Token card */}
          <div className="bg-[#12181D] border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 border-b border-slate-850 pb-2 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-400" />
              <span>Platform Security Credentials</span>
            </h3>

            <div className="space-y-2">
              <span className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider">Django REST API Token</span>
              <div className="flex items-center gap-2 bg-slate-950/45 border border-slate-850 p-2.5 rounded-lg">
                <span className="font-mono text-[11px] text-emerald-400 truncate flex-1">{token}</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[9px] text-slate-400 font-bold uppercase">Active</span>
              </div>
              <p className="text-[10px] text-slate-550">This session token authorizes secure background Celery synchronization requests directly to the GridFlow API gateways.</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
