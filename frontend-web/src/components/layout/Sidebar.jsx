import React from 'react'
import { LayoutDashboard, Network, Coins, Settings, Database, CloudLightning, Menu, Activity } from 'lucide-react'

export default function Sidebar({ currentView, setView, activeNode, onSignOut }) {
  const menuItems = [
    { id: 'dashboard', name: 'Executive Dashboard', icon: LayoutDashboard },
    { id: 'nodes', name: 'Node Management', icon: Network },
    { id: 'tokenomics', name: 'Tokenomics Ledger', icon: Coins },
    { id: 'iot-config', name: 'Telemetry Controls', icon: Settings },
  ]

  return (
    <aside className="w-72 bg-[#12181D] border-r border-slate-800 flex flex-col h-screen fixed left-0 top-0 z-20">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <CloudLightning className="w-5 h-5 text-slate-900 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="font-semibold text-lg text-slate-100 leading-tight">GridFlow</h1>
            <span className="text-[10px] text-emerald-500 font-medium tracking-wider uppercase">Solar Cloud MVP</span>
          </div>
        </div>
      </div>

      {/* Active Device Indicator */}
      {activeNode && (
        <div className="mx-4 my-4 p-3 rounded-lg bg-[#1E293B]/40 border border-slate-800/80 flex items-center gap-3">
          <div className="relative">
            <div className={`w-2 h-2 rounded-full ${activeNode.status === 'ONLINE' ? 'bg-emerald-500 pulse-active-emerald' : 'bg-rose-500'}`} />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] text-slate-400 uppercase font-medium tracking-wider leading-none">Active Site</p>
            <p className="text-xs text-slate-200 font-semibold truncate mt-1">{activeNode.site_name || activeNode.serial_number}</p>
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {menuItems.map(item => {
          const Icon = item.icon
          const isActive = currentView === item.id
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 border-l-2 border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Profile and Sign Out */}
      <div className="p-4 border-t border-slate-800 bg-[#0B0F12]/60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-emerald-400">
              OP
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-300">Operator Portal</p>
              <p className="text-[10px] text-slate-500">Connected Mode</p>
            </div>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="w-full text-center py-2 px-3 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </aside>
  )
}
