import React, { useState } from 'react'
import { Sun, Battery, Home, Zap, RefreshCw, Thermometer, CloudSun, Leaf, Gauge, HelpCircle, Activity } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { jitter } from '../data/mockData'

export default function Dashboard({
  token,
  latestTelemetry,
  hourlyData,
  selectedDevice,
  isSimulated,
  onTriggerSync,
  isSyncing
}) {
  const [currency, setCurrency] = useState('KES')

  if (!latestTelemetry) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] text-slate-400">
        <RefreshCw className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
        <p className="text-sm">Connecting to microgrid telemetry stream...</p>
      </div>
    )
  }

  // Format values
  const pvW = latestTelemetry.pv_total_power_w || 0
  const loadW = latestTelemetry.load_power_w || 0
  const batW = latestTelemetry.battery_power_w || 0
  const gridW = latestTelemetry.grid_power_w || 0
  const soc = latestTelemetry.battery_soc || 0
  const temp = latestTelemetry.temperature_c || 0
  const todayProd = latestTelemetry.energy_today_kwh || 0
  const cap = selectedDevice?.capacity_kw || 30.0

  // Derive Daily values
  const dailyCons = Number((todayProd * 0.78).toFixed(2))
  const dailyPurchase = Number((todayProd * 0.15).toFixed(2))
  const dailyFeedIn = Number((todayProd * 0.32).toFixed(2))

  // Determine flow animation direction
  // Solar to Inverter (always flows if solar > 50W)
  const solarFlow = pvW > 50 ? 'flow-forward text-emerald-500' : 'flow-none text-slate-700'
  
  // Inverter to Consumption (always flows if load > 50W)
  const loadFlow = loadW > 50 ? 'flow-forward text-amber-500' : 'flow-none text-slate-700'
  
  // Inverter to Battery (Positive = charging = flows left-to-right from Inverter to Battery, wait)
  // Let's define the SVG path starting from Inverter to Battery:
  // Path starts at Inverter (250, 180) and goes left to Battery (80, 180).
  // If batW > 50, it is charging (flows from Inverter to Battery = forward along the path).
  // If batW < -50, it is discharging (flows from Battery to Inverter = backward along the path).
  let batteryFlow = 'flow-none text-slate-700'
  if (batW > 50) {
    batteryFlow = 'flow-forward text-emerald-400'
  } else if (batW < -50) {
    batteryFlow = 'flow-backward text-rose-400'
  }

  // Inverter to Grid:
  // Path starts at Inverter (250, 180) and goes right to Grid (420, 180).
  // If gridW < -50, exporting/feed-in (flows from Inverter to Grid = forward).
  // If gridW > 50, importing/purchase (flows from Grid to Inverter = backward).
  let gridFlow = 'flow-none text-slate-700'
  if (gridW < -50) {
    gridFlow = 'flow-forward text-emerald-400'
  } else if (gridW > 50) {
    gridFlow = 'flow-backward text-rose-400'
  }

  // Carbon credits estimation
  // average 0.45 kg CO2 offset per kWh solar energy
  const co2Mitigated = (todayProd * 0.45).toFixed(2)

  // System status level
  const activeAlerts = selectedDevice?.active_alerts || 0
  let systemStatus = { label: 'Normal', color: 'bg-emerald-500 text-emerald-400 pulse-active-emerald' }
  if (activeAlerts > 0) {
    systemStatus = { label: 'Warning', color: 'bg-amber-500 text-amber-400 pulse-active-amber' }
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto pb-16">
      
      {/* Top Banner and Quick Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{selectedDevice?.site_name || 'Hybrid Power Plant'}</h1>
          <p className="text-xs text-slate-400 mt-1">Serial Number: <span className="font-mono text-slate-300">{selectedDevice?.serial_number}</span> • Capacity: <span className="text-emerald-400 font-semibold">{cap} kW</span></p>
        </div>
        
        {/* Buttons and status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1E293B]/40 border border-slate-800 text-xs">
            <span className="text-slate-400">System Health:</span>
            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
              <span className={`w-2 h-2 rounded-full ${systemStatus.color}`} />
              <span className={systemStatus.color.split(' ')[1]}>{systemStatus.label}</span>
            </span>
          </div>

          <button
            onClick={() => onTriggerSync(selectedDevice.id)}
            disabled={isSyncing || selectedDevice.data_source === 'MANUAL'}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-100 text-xs font-semibold px-4 py-2 rounded-lg transition-all active:scale-95 shadow-md shadow-emerald-600/10 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Hardware'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Energy Flow (Left) + Weather & Stats (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Visual Energy Flow Diagram - Translucent Glassmorphism Card */}
        <div className="lg:col-span-8 bg-[#12181D]/60 glass-panel rounded-2xl p-6 flex flex-col justify-between min-h-[500px] shadow-xl relative overflow-hidden">
          {/* Subtle grid pattern background to enhance premium feeling */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b08_1px,transparent_1px),linear-gradient(to_bottom,#1e293b08_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-30" />

          <div className="flex items-center justify-between mb-4 border-b border-slate-800/60 pb-3 z-10 relative">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              <span>Real-Time Power Flow Map</span>
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Live updates every 3s</span>
          </div>

          {/* Interactive Schematic Diagram */}
          <div className="flex-1 flex flex-col items-center justify-center p-4 relative z-10">
            <div className="relative w-full max-w-[600px] aspect-[4/3] select-none">
              
              {/* SVG Flow Connections */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 450" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* 1. Solar to Inverter */}
                <path d="M 300 95 L 300 170" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" />
                <path d="M 300 95 L 300 170" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" className={solarFlow} />

                {/* 2. Inverter to Battery */}
                <path d="M 270 215 C 180 215, 110 250, 110 325" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" fill="none" />
                <path d="M 270 215 C 180 215, 110 250, 110 325" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" fill="none" className={batteryFlow} />

                {/* 3. Inverter to Consumption */}
                <path d="M 300 240 L 300 325" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" />
                <path d="M 300 240 L 300 325" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" className={loadFlow} />

                {/* 4. Inverter to Grid */}
                <path d="M 330 215 C 420 215, 490 250, 490 325" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" fill="none" />
                <path d="M 330 215 C 420 215, 490 250, 490 325" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" fill="none" className={gridFlow} />
              </svg>

              {/* Absolutely Positioned Node Cards */}
              
              {/* Node A: Solar Panel (Top Center) */}
              <div className="absolute top-[2%] left-[50%] -translate-x-1/2 flex flex-col items-center text-center">
                <div className={`p-2.5 rounded-2xl bg-[#12181D]/90 border transition-all duration-500 flex flex-col items-center w-28 ${
                  pvW > 50 ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/10' : 'border-slate-800'
                }`}>
                  <SolarIcon />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Solar</span>
                  <span className="text-xs font-mono font-bold text-slate-100 mt-0.5">
                    {(pvW / 1000).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kW
                  </span>
                </div>
              </div>

              {/* Node B: Inverter (Center) */}
              <div className="absolute top-[38%] left-[50%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-center">
                <div className="p-3 rounded-2xl bg-[#12181D]/95 border border-slate-800 flex flex-col items-center w-24 shadow-2xl">
                  <InverterIcon />
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Inverter</span>
                </div>
              </div>

              {/* Node C: Battery (Bottom Left) */}
              <div className="absolute bottom-[2%] left-[18%] -translate-x-1/2 flex flex-col items-center text-center">
                <div className={`p-2.5 rounded-2xl bg-[#12181D]/90 border transition-all duration-500 flex flex-col items-center w-36 ${
                  Math.abs(batW) > 50 ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/10' : 'border-slate-800'
                }`}>
                  <BatteryIcon />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Battery</span>
                  <span className="text-xs font-mono font-bold text-slate-100 mt-0.5 text-center">
                    {Math.abs(batW).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} w • {soc}%
                  </span>
                </div>
              </div>

              {/* Node D: Consumption (Bottom Center) */}
              <div className="absolute bottom-[2%] left-[50%] -translate-x-1/2 flex flex-col items-center text-center">
                <div className={`p-2.5 rounded-2xl bg-[#12181D]/90 border transition-all duration-500 flex flex-col items-center w-28 ${
                  loadW > 50 ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-slate-800'
                }`}>
                  <HouseIcon />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Consumption</span>
                  <span className="text-xs font-mono font-bold text-slate-100 mt-0.5">
                    {loadW.toLocaleString('de-DE')} w
                  </span>
                </div>
              </div>

              {/* Node E: Grid (Bottom Right) */}
              <div className="absolute bottom-[2%] left-[82%] -translate-x-1/2 flex flex-col items-center text-center">
                <div className={`p-2.5 rounded-2xl bg-[#12181D]/90 border transition-all duration-500 flex flex-col items-center w-28 ${
                  Math.abs(gridW) > 50 ? 'border-sky-500/50 shadow-lg shadow-sky-500/10' : 'border-slate-800'
                }`}>
                  <GridIcon />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Grid</span>
                  <span className="text-xs font-mono font-bold text-slate-100 mt-0.5">
                    {(Math.abs(gridW) / 1000).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kW
                  </span>
                </div>
              </div>

            </div>
            
            <div className="w-full flex items-center justify-around mt-4 pt-3 border-t border-slate-800/60 text-[10px] text-slate-400 font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                <span>Live telemetry active</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Gen</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Cons</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Grid Import</span>
              </div>
              <div>
                <span>Update rate: 3s</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side Column - Weather & Metrics Panel */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Weather Widget */}
          <div className="bg-[#12181D] border border-slate-800/80 rounded-2xl p-6 shadow-lg relative overflow-hidden flex items-center justify-between">
            <div className="absolute -top-10 -right-10 w-28 h-28 bg-emerald-500/5 rounded-full blur-2xl" />
            
            <div className="space-y-2">
              <p className="text-xs text-slate-400 font-medium">Environmental Context</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-100">{temp} °C</span>
                <span className="text-xs text-slate-400">Inverter Ambient</span>
              </div>
              <p className="text-xs text-slate-300 font-semibold flex items-center gap-1.5 mt-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span>Nantong (API Default Location)</span>
              </p>
            </div>
            
            <div className="text-center p-2 rounded-xl bg-slate-800/30 border border-slate-800">
              <CloudSun className="w-10 h-10 text-emerald-400 mx-auto stroke-[1.5]" />
              <span className="text-[10px] text-slate-400 font-medium mt-1 block">Partly Sunny</span>
            </div>
          </div>

          {/* Efficiency Metric */}
          <div className="bg-[#12181D] border border-slate-800/80 rounded-2xl p-6 shadow-lg flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-slate-400">System Efficiency</p>
              <p className="text-2xl font-bold text-slate-100">97.8 %</p>
              <span className="text-[10px] text-emerald-400 font-medium">Within peak operational limits</span>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Gauge className="w-6 h-6 text-emerald-400" />
            </div>
          </div>

          {/* Carbon Credit Offset */}
          <div className="bg-[#12181D] border border-slate-800/80 rounded-2xl p-6 shadow-lg flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs text-slate-400">CO₂ Mitigated Today</p>
              <p className="text-2xl font-bold text-emerald-400">{co2Mitigated} kg</p>
              <span className="text-[10px] text-slate-400">Calculated offset multiplier</span>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Leaf className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          
        </div>
      </div>

      {/* Production & Financial Stats Grid (Inspired by Image 2 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Daily Production */}
        <div className="bg-[#12181D] border border-slate-800 rounded-xl p-5 hover:bg-slate-800/20 transition-all shadow-md">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-slate-400 font-medium">Daily Production</span>
            <Sun className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100">{todayProd} kWh</p>
          <p className="text-[10px] text-emerald-500 font-medium mt-1">Generated by Solar Arrays</p>
        </div>

        {/* Card 2: Daily Consumption */}
        <div className="bg-[#12181D] border border-slate-800 rounded-xl p-5 hover:bg-slate-800/20 transition-all shadow-md">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-slate-400 font-medium">Daily Consumption</span>
            <Home className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-slate-100">{dailyCons} kWh</p>
          <p className="text-[10px] text-slate-500 font-medium mt-1">Consumed by site loads</p>
        </div>

        {/* Card 3: Daily Purchase */}
        <div className="bg-[#12181D] border border-slate-800 rounded-xl p-5 hover:bg-slate-800/20 transition-all shadow-md">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-slate-400 font-medium">Daily Purchase</span>
            <Zap className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100">{dailyPurchase} kWh</p>
          <p className="text-[10px] text-rose-400 font-medium mt-1">Imported from State Grid</p>
        </div>

        {/* Card 4: Daily Feed-In */}
        <div className="bg-[#12181D] border border-slate-800 rounded-xl p-5 hover:bg-slate-800/20 transition-all shadow-md">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-slate-400 font-medium">Daily Feed-In</span>
            <Zap className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-slate-100">{dailyFeedIn} kWh</p>
          <p className="text-[10px] text-emerald-500 font-medium mt-1">Exported excess generation</p>
        </div>

      </div>

      {/* Recharts 24-Hour Dual-Axis Trend Area Chart (Inspired by Image 1) */}
      <div className="bg-[#12181D]/80 border border-slate-800 rounded-2xl p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-100">Telemetry History (Last 24 Hours)</h3>
            <p className="text-xs text-slate-400 mt-1">Generation vs Consumption curves over a full day cycle.</p>
          </div>
          
          {/* Legend indicator badges */}
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
              <span className="text-slate-300">Generation (kW)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-rose-500 rounded-full" />
              <span className="text-slate-300">Consumption (kW)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
              <span className="text-slate-300">Grid Feed-in (kW)</span>
            </div>
          </div>
        </div>

        {/* Recharts container */}
        <div className="w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="genColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.02}/>
                </linearGradient>
                <linearGradient id="consColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0.01}/>
                </linearGradient>
                <linearGradient id="feedColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.01}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} />
              <YAxis stroke="#475569" fontSize={10} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: 8 }}
                itemStyle={{ color: '#F1F5F9', fontSize: 12 }}
                labelStyle={{ color: '#94A3B8', fontSize: 11, fontWeight: 'bold' }}
              />
              <Area type="monotone" dataKey="power" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#genColor)" />
              <Area type="monotone" dataKey="consumption" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#consColor)" />
              <Area type="monotone" dataKey="feedIn" stroke="#F59E0B" strokeWidth={1.5} fillOpacity={1} fill="url(#feedColor)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      
    </div>
  )
}

// Isometric SVG Components
const SolarIcon = () => (
  <svg className="w-14 h-11 drop-shadow-[0_2px_8px_rgba(16,185,129,0.1)]" viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M 50 48 L 50 65 M 35 65 L 65 65" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
    <polygon points="50,15 85,32 50,49 15,32" fill="#1E293B" stroke="#10B981" strokeWidth="2.5" strokeLinejoin="round" />
    <line x1="32.5" y1="23.25" x2="67.5" y2="40.75" stroke="#10B981" strokeWidth="1.2" opacity="0.6" />
    <line x1="15" y1="32" x2="85" y2="32" stroke="#10B981" strokeWidth="1.2" opacity="0.6" />
    <line x1="32.5" y1="40.75" x2="67.5" y2="23.25" stroke="#10B981" strokeWidth="1.2" opacity="0.6" />
    <line x1="50" y1="15" x2="50" y2="49" stroke="#10B981" strokeWidth="1.5" />
  </svg>
)

const InverterIcon = () => (
  <svg className="w-10 h-14 drop-shadow-[0_2px_8px_rgba(245,158,11,0.1)]" viewBox="0 0 80 110" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="40,25 10,40 10,95 40,80" fill="#1E293B" stroke="#F59E0B" strokeWidth="2" strokeLinejoin="round" />
    <polygon points="40,25 70,40 70,95 40,80" fill="#334155" stroke="#F59E0B" strokeWidth="2" strokeLinejoin="round" />
    <polygon points="40,10 70,25 40,40 10,25" fill="#475569" stroke="#F59E0B" strokeWidth="2" strokeLinejoin="round" />
    <polygon points="43,45 62,54 62,68 43,59" fill="#1E293B" stroke="#F59E0B" strokeWidth="1" />
    <polygon points="46,49 59,55 59,62 46,56" fill="#F59E0B" className="animate-pulse" />
    <line x1="18" y1="52" x2="32" y2="45" stroke="#475569" strokeWidth="1.5" />
    <line x1="18" y1="62" x2="32" y2="55" stroke="#475569" strokeWidth="1.5" />
    <line x1="18" y1="72" x2="32" y2="65" stroke="#475569" strokeWidth="1.5" />
  </svg>
)

const BatteryIcon = () => (
  <svg className="w-14 h-11 drop-shadow-[0_2px_8px_rgba(16,185,129,0.1)]" viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="50,35 15,50 15,75 50,60" fill="#111827" stroke="#10B981" strokeWidth="2" strokeLinejoin="round" />
    <polygon points="50,35 85,50 85,75 50,60" fill="#1E293B" stroke="#10B981" strokeWidth="2" strokeLinejoin="round" />
    <polygon points="50,15 85,30 50,45 15,30" fill="#334155" stroke="#10B981" strokeWidth="2" strokeLinejoin="round" />
    <polygon points="32,23 38,26 35,28 29,25" fill="#EF4444" />
    <polygon points="62,23 68,26 65,28 59,25" fill="#10B981" />
    <path d="M 47 43 L 42 51 L 49 51 L 44 59" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse" />
  </svg>
)

const HouseIcon = () => (
  <svg className="w-14 h-12 drop-shadow-[0_2px_8px_rgba(245,158,11,0.1)]" viewBox="0 0 100 85" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="50,45 15,60 15,85 50,70" fill="#1E293B" stroke="#94A3B8" strokeWidth="2" strokeLinejoin="round" />
    <polygon points="50,45 85,60 85,85 50,70" fill="#334155" stroke="#94A3B8" strokeWidth="2" strokeLinejoin="round" />
    <polygon points="50,15 15,40 50,55 85,30" fill="#475569" stroke="#94A3B8" strokeWidth="2" strokeLinejoin="round" />
    <polygon points="45,23 25,37 38,44 58,29" fill="#1E293B" stroke="#10B981" strokeWidth="1.5" strokeLinejoin="round" />
    <line x1="35" y1="30" x2="48" y2="36" stroke="#10B981" strokeWidth="1" />
    <line x1="31" y1="38" x2="44" y2="44" stroke="#10B981" strokeWidth="1" />
    <polygon points="58,74 72,80 72,64 58,58" fill="#111827" stroke="#94A3B8" strokeWidth="1" />
    <polygon points="25,65 38,70 38,62 25,57" fill="#F59E0B" opacity="0.75" />
  </svg>
)

const GridIcon = () => (
  <svg className="w-14 h-12 drop-shadow-[0_2px_8px_rgba(14,165,233,0.1)]" viewBox="0 0 100 85" fill="none" xmlns="http://www.w3.org/2000/svg">
    <line x1="50" y1="80" x2="50" y2="15" stroke="#94A3B8" strokeWidth="3.5" strokeLinecap="round" />
    <line x1="15" y1="32" x2="85" y2="32" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
    <line x1="22" y1="52" x2="78" y2="52" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="50" y1="32" x2="22" y2="52" stroke="#94A3B8" strokeWidth="1.5" />
    <line x1="50" y1="32" x2="78" y2="52" stroke="#94A3B8" strokeWidth="1.5" />
    <line x1="50" y1="52" x2="50" y2="80" stroke="#94A3B8" strokeWidth="1.5" />
    <rect x="13" y="25" width="4" height="7" rx="1.5" fill="#475569" stroke="#94A3B8" strokeWidth="1" />
    <rect x="48" y="8" width="4" height="7" rx="1.5" fill="#475569" stroke="#94A3B8" strokeWidth="1" />
    <rect x="83" y="25" width="4" height="7" rx="1.5" fill="#475569" stroke="#94A3B8" strokeWidth="1" />
    <path d="M 15 28 Q 50 38 85 28" stroke="#38BDF8" strokeWidth="1.2" opacity="0.6" fill="none" />
  </svg>
)
