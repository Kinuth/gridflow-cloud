import React, { useState } from 'react'
import { Plus, Server, CheckCircle2, XCircle, RefreshCw, BarChart3, AlertCircle, Trash2 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'

export default function NodeManagement({
  token,
  devices,
  selectedDevice,
  setSelectedDevice,
  latestTelemetry,
  onCreateDevice,
  onDeleteDevice,
  onSeedDefault,
  isSeeding,
  refreshDevices
}) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [serialNumber, setSerialNumber] = useState('')
  const [siteName, setSiteName] = useState('')
  const [capacity, setCapacity] = useState('15.0')
  const [dataSource, setDataSource] = useState('MANUAL')
  const [deviceType, setDeviceType] = useState('INVERTER')
  
  // Modals / Action states
  const [rebootingNode, setRebootingNode] = useState(null)
  const [rebootSuccess, setRebootSuccess] = useState(null)
  const [analyticsNode, setAnalyticsNode] = useState(null)

  const handleAddSubmit = async (e) => {
    e.preventDefault()
    if (!serialNumber || !siteName) return
    try {
      await onCreateDevice({
        serial_number: serialNumber,
        site_name: siteName,
        capacity_kw: parseFloat(capacity),
        device_type: deviceType,
        data_source: dataSource,
        provider_device_id: dataSource !== 'MANUAL' ? `ext-device-${Math.floor(Math.random()*1000)}` : '',
        provider_station_id: dataSource !== 'MANUAL' ? `station-${Math.floor(Math.random()*100)}` : ''
      })
      // Reset
      setSerialNumber('')
      setSiteName('')
      setCapacity('15.0')
      setDataSource('MANUAL')
      setDeviceType('INVERTER')
      setShowAddForm(false)
    } catch (err) {
      alert('Failed to register node: ' + err.message)
    }
  }

  const handleReboot = (device) => {
    setRebootingNode(device)
    setRebootSuccess(null)
    
    // Simulate API command sending to hardware
    setTimeout(() => {
      setRebootingNode(null)
      setRebootSuccess(device.site_name || device.serial_number)
      
      // Clear success notification
      setTimeout(() => {
        setRebootSuccess(null)
      }, 3000)
    }, 2000)
  }

  // Create mini trend chart data for analytics modal
  const miniChartData = Array.from({ length: 8 }, (_, i) => ({
    time: `${i * 3}:00`,
    val: Math.random() * (analyticsNode?.capacity_kw || 20)
  }))

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto pb-16">
      
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Microgrid & Node Network</h1>
          <p className="text-xs text-slate-400 mt-1">Manage individual solar clusters, inverter logs, and hardware sites.</p>
        </div>
        
        <div className="flex gap-3">
          {devices.length === 0 && (
            <button
              onClick={onSeedDefault}
              disabled={isSeeding}
              className="px-4 py-2 border border-slate-700 hover:border-slate-600 bg-slate-850 hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              {isSeeding ? 'Creating Seeding...' : 'Quick Seed Demo Nodes'}
            </button>
          )}

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-slate-100 text-xs font-semibold px-4 py-2 rounded-lg transition-all active:scale-95 shadow-md shadow-emerald-600/10 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddForm ? 'Cancel' : 'Register Solar Node'}</span>
          </button>
        </div>
      </div>

      {/* Reboot Alert Banner */}
      {rebootSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-xs text-emerald-350">Remote reboot command dispatched successfully to node <span className="font-semibold text-slate-100">{rebootSuccess}</span>. Recalibrating connections...</p>
        </div>
      )}

      {/* Add Device Form Card */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="bg-[#12181D] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 max-w-2xl">
          <h3 className="text-sm font-semibold text-slate-200 border-b border-slate-850 pb-2">Register New Solar microgrid Node</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Node Site Name</label>
              <input
                type="text"
                placeholder="e.g. Chama Community Center"
                value={siteName}
                onChange={e => setSiteName(e.target.value)}
                className="w-full bg-[#1E293B]/40 text-slate-250 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none placeholder-slate-650"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Serial Number (SN)</label>
              <input
                type="text"
                placeholder="e.g. SN-GF-10928"
                value={serialNumber}
                onChange={e => setSerialNumber(e.target.value)}
                className="w-full bg-[#1E293B]/40 text-slate-250 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none placeholder-slate-650"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">System Capacity (kW)</label>
              <input
                type="number"
                step="0.1"
                value={capacity}
                onChange={e => setCapacity(e.target.value)}
                className="w-full bg-[#1E293B]/40 text-slate-250 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Data Sync Provider</label>
              <select
                value={dataSource}
                onChange={e => setDataSource(e.target.value)}
                className="w-full bg-[#12181D] text-slate-250 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="MANUAL">Manual (Local Sim)</option>
                <option value="DEYE">Deye Cloud API</option>
                <option value="SOLARMAN">Solarman API</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-lg bg-slate-850 hover:bg-slate-800 text-xs font-semibold text-slate-350 border border-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-slate-100 shadow shadow-emerald-600/10"
            >
              Register Node
            </button>
          </div>
        </form>
      )}

      {/* Nodes List Data Grid */}
      <div className="bg-[#12181D] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-slate-500 space-y-4">
            <Server className="w-12 h-12 stroke-[1.2] text-slate-600" />
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-350">No Solar Nodes Registered</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">Create a node manually or load sample microgrid plants using the buttons above to verify telemetry visualizations.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/40 border-b border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <th className="p-4 pl-6">Node Site Name</th>
                  <th className="p-4">Serial Number</th>
                  <th className="p-4">Capacity</th>
                  <th className="p-4">Source Provider</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {devices.map(device => {
                  const isOnline = device.status === 'ONLINE'
                  const isCurrentActive = selectedDevice?.id === device.id
                  const nodeCap = device.capacity_kw || 15.0

                  return (
                    <tr
                      key={device.id}
                      className={`hover:bg-slate-800/10 transition-colors ${isCurrentActive ? 'bg-emerald-500/5' : ''}`}
                    >
                      {/* Name / Site */}
                      <td className="p-4 pl-6 font-semibold text-slate-200">
                        <div className="flex items-center gap-3">
                          <span
                            onClick={() => setSelectedDevice(device)}
                            className="cursor-pointer hover:underline text-slate-200"
                          >
                            {device.site_name || 'Generic microgrid Node'}
                          </span>
                        </div>
                      </td>
                      
                      {/* SN */}
                      <td className="p-4 font-mono text-slate-400">{device.serial_number}</td>
                      
                      {/* Capacity */}
                      <td className="p-4 font-medium text-slate-300">{nodeCap} kW</td>
                      
                      {/* Data Source */}
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-750 text-[10px] font-semibold tracking-wider text-slate-300">
                          {device.data_source || 'MANUAL'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <span className={isOnline ? 'text-emerald-400 font-medium' : 'text-rose-400'}>
                            {device.status || 'OFFLINE'}
                          </span>
                        </div>
                      </td>

                      {/* Action buttons */}
                      <td className="p-4 text-right pr-6 space-x-2">
                        <button
                          onClick={() => setAnalyticsNode(device)}
                          className="inline-flex items-center justify-center p-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-750 text-slate-300 transition-all hover:text-emerald-400 cursor-pointer"
                          title="View Analytics"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleReboot(device)}
                          disabled={rebootingNode?.id === device.id}
                          className="inline-flex items-center justify-center p-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-750 text-slate-300 transition-all hover:text-emerald-400 disabled:opacity-50 cursor-pointer"
                          title="Remote Reboot"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${rebootingNode?.id === device.id ? 'animate-spin text-emerald-400' : ''}`} />
                        </button>

                        <button
                          onClick={() => {
                            if(confirm(`Are you sure you want to delete node ${device.site_name || device.serial_number}?`)) {
                              onDeleteDevice(device.id)
                            }
                          }}
                          className="inline-flex items-center justify-center p-1.5 rounded bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 text-rose-400 hover:text-white transition-all cursor-pointer"
                          title="Delete Node"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Analytics Modal Dialog */}
      {analyticsNode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12181D] border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-6 relative">
            <button
              onClick={() => setAnalyticsNode(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 text-lg cursor-pointer"
            >
              ✕
            </button>

            <div>
              <h3 className="text-base font-bold text-slate-100">{analyticsNode.site_name || 'Solar Node'}</h3>
              <p className="text-xs text-slate-400 mt-1 font-mono">Serial: {analyticsNode.serial_number} • Capacity: {analyticsNode.capacity_kw || 15} kW</p>
            </div>

            {/* Simulated Live Output Analytics Graph */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-350">Simulated 24h Output Curve (kW)</h4>
              <div className="w-full h-48 bg-slate-900/40 border border-slate-850 rounded-xl p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={miniChartData}>
                    <XAxis dataKey="time" stroke="#475569" fontSize={8} tickLine={false} />
                    <YAxis stroke="#475569" fontSize={8} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: 6 }}
                      itemStyle={{ color: '#F1F5F9', fontSize: 10 }}
                      labelStyle={{ color: '#94A3B8', fontSize: 9 }}
                    />
                    <Line type="monotone" dataKey="val" stroke="#10B981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setAnalyticsNode(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Close Analytics
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rebooting Action Modal Loading */}
      {rebootingNode && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12181D] border border-slate-800 rounded-2xl w-full max-w-sm p-6 text-center space-y-4">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
            <div>
              <h3 className="text-sm font-bold text-slate-200">Dispatching Reboot Command</h3>
              <p className="text-xs text-slate-400 mt-1.5">Sending over-the-air reset signal to microgrid inverter. Please keep connection online...</p>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
