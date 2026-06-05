import React, { useState } from 'react'
import { Coins, CheckCircle, Clock, DollarSign, Plus, ArrowUpRight, TrendingUp } from 'lucide-react'
import { DEFAULT_TRANSACTIONS } from '../data/mockData'

export default function Tokenomics({ devices }) {
  const [transactions, setTransactions] = useState(DEFAULT_TRANSACTIONS)
  const [currency, setCurrency] = useState('KES') // KES or USD
  const [showAddTx, setShowAddTx] = useState(false)
  
  // Form fields
  const [selectedNode, setSelectedNode] = useState(devices[0]?.site_name || 'Chama Community Center')
  const [userLabel, setUserLabel] = useState('')
  const [energyAmount, setEnergyAmount] = useState('10')
  const [txStatus, setTxStatus] = useState('Settled')

  // Constants
  const KES_TO_USD = 0.0076
  const KES_PER_KWH = 18.0

  const handleAddTx = (e) => {
    e.preventDefault()
    if (!userLabel || !energyAmount) return

    const kwh = parseFloat(energyAmount)
    const valKes = kwh * KES_PER_KWH

    const newTx = {
      id: 'tx_' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      node: selectedNode,
      user: userLabel,
      energy_kwh: kwh,
      value_kes: valKes,
      status: txStatus
    }

    setTransactions([newTx, ...transactions])
    setUserLabel('')
    setEnergyAmount('10')
    setShowAddTx(false)
  }

  // Calculate stats
  const totalEnergy = transactions.reduce((acc, curr) => acc + curr.energy_kwh, 0)
  const totalValueKes = transactions.reduce((acc, curr) => acc + (curr.value_kes || 0), 0)
  const pendingCount = transactions.filter(t => t.status === 'Pending').length
  const settledCount = transactions.filter(t => t.status === 'Settled').length

  const formatValue = (kesVal) => {
    if (currency === 'USD') {
      return `$ ${(kesVal * KES_TO_USD).toFixed(2)}`
    }
    return `KES ${kesVal.toLocaleString()}`
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto pb-16">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Chama Shared Energy Ledger</h1>
          <p className="text-xs text-slate-400 mt-1">Audit clean energy token economics, PPA distribution billing, and micro-payments.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Currency Toggle */}
          <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
            <button
              onClick={() => setCurrency('KES')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${currency === 'KES' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              KES
            </button>
            <button
              onClick={() => setCurrency('USD')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${currency === 'USD' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              USD
            </button>
          </div>

          <button
            onClick={() => setShowAddTx(!showAddTx)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-slate-100 text-xs font-semibold px-4 py-2 rounded-lg transition-all active:scale-95 shadow-md shadow-emerald-600/10 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddTx ? 'Cancel' : 'Post Transaction'}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* KPI: Total Energy */}
        <div className="bg-[#12181D] border border-slate-800 rounded-xl p-5 hover:bg-slate-800/20 transition-all shadow-md">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-slate-400 font-medium">Total Shared Volume</span>
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100">{totalEnergy.toFixed(1)} kWh</p>
          <p className="text-[10px] text-slate-400 font-medium mt-1">Transacted microgrid tokens</p>
        </div>

        {/* KPI: Total Value */}
        <div className="bg-[#12181D] border border-slate-800 rounded-xl p-5 hover:bg-slate-800/20 transition-all shadow-md">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-slate-400 font-medium">Estimated Ledger Value</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">{formatValue(totalValueKes)}</p>
          <p className="text-[10px] text-slate-400 font-medium mt-1">PPA revenue collected</p>
        </div>

        {/* KPI: Settled */}
        <div className="bg-[#12181D] border border-slate-800 rounded-xl p-5 hover:bg-slate-800/20 transition-all shadow-md">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-slate-400 font-medium">Settled Payments</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-slate-100">{settledCount}</p>
          <p className="text-[10px] text-emerald-500 font-medium mt-1">Cleared transactions</p>
        </div>

        {/* KPI: Pending */}
        <div className="bg-[#12181D] border border-slate-800 rounded-xl p-5 hover:bg-slate-800/20 transition-all shadow-md">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-slate-400 font-medium">Pending Settlements</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-slate-100">{pendingCount}</p>
          <p className="text-[10px] text-amber-400 font-medium mt-1">Awaiting ledger clearance</p>
        </div>

      </div>

      {/* Wireframe-inspired flow distribution segment blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Daily Production Allocation */}
        <div className="bg-[#12181D]/60 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex justify-between items-center border-b border-slate-850 pb-2">
            <h3 className="text-sm font-semibold text-slate-300">Daily Production Allocation</h3>
            <span className="text-xs font-bold text-slate-200">20.33 kWh</span>
          </div>

          {/* Segmented bar */}
          <div className="h-3 rounded-full flex overflow-hidden bg-slate-800 mt-2">
            <div style={{ width: '24%' }} className="bg-sky-500" />
            <div style={{ width: '42%' }} className="bg-emerald-500" />
            <div style={{ width: '34%' }} className="bg-amber-500" />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-slate-400">
                <span className="w-2 h-2 rounded-full bg-sky-500" />
                <span>Send to Load</span>
              </div>
              <p className="text-sm font-bold text-slate-100">7.35 kWh</p>
              <p className="text-[10px] text-slate-500">24% allocation</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Send to Battery</span>
              </div>
              <p className="text-sm font-bold text-slate-100">2.04 kWh</p>
              <p className="text-[10px] text-slate-500">42% allocation</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-slate-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Send to Grid</span>
              </div>
              <p className="text-sm font-bold text-slate-100">10.94 kWh</p>
              <p className="text-[10px] text-slate-500">34% allocation</p>
            </div>
          </div>
        </div>

        {/* Daily Consumption Sourcing */}
        <div className="bg-[#12181D]/60 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex justify-between items-center border-b border-slate-850 pb-2">
            <h3 className="text-sm font-semibold text-slate-300">Daily Consumption Sourcing</h3>
            <span className="text-xs font-bold text-slate-200">47.58 kWh</span>
          </div>

          {/* Segmented bar */}
          <div className="h-3 rounded-full flex overflow-hidden bg-slate-800 mt-2">
            <div style={{ width: '55%' }} className="bg-emerald-500" />
            <div style={{ width: '27%' }} className="bg-sky-500" />
            <div style={{ width: '18%' }} className="bg-rose-500" />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Solar Direct</span>
              </div>
              <p className="text-sm font-bold text-slate-100">26.17 kWh</p>
              <p className="text-[10px] text-slate-500">55% sourced</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-slate-400">
                <span className="w-2 h-2 rounded-full bg-sky-500" />
                <span>Battery Sourced</span>
              </div>
              <p className="text-sm font-bold text-slate-100">12.85 kWh</p>
              <p className="text-[10px] text-slate-500">27% sourced</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-slate-400">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>State Grid Buy</span>
              </div>
              <p className="text-sm font-bold text-slate-100">8.56 kWh</p>
              <p className="text-[10px] text-slate-500">18% sourced</p>
            </div>
          </div>
        </div>

      </div>

      {/* Add Transaction form block */}
      {showAddTx && (
        <form onSubmit={handleAddTx} className="bg-[#12181D] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 max-w-2xl">
          <h3 className="text-sm font-semibold text-slate-200 border-b border-slate-850 pb-2">Record Shared energy transaction</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Source microgrid Node</label>
              <select
                value={selectedNode}
                onChange={e => setSelectedNode(e.target.value)}
                className="w-full bg-[#12181D] text-slate-250 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer"
              >
                {devices.length > 0 ? (
                  devices.map(d => (
                    <option key={d.id} value={d.site_name || d.serial_number}>
                      {d.site_name || d.serial_number}
                    </option>
                  ))
                ) : (
                  <option value="Chama Community Center">Chama Community Center</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Target Participant / User</label>
              <input
                type="text"
                placeholder="e.g. User 104 (Boda Boda Station)"
                value={userLabel}
                onChange={e => setUserLabel(e.target.value)}
                className="w-full bg-[#1E293B]/40 text-slate-250 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none placeholder-slate-650"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Energy Delivered (kWh)</label>
              <input
                type="number"
                value={energyAmount}
                onChange={e => setEnergyAmount(e.target.value)}
                className="w-full bg-[#1E293B]/40 text-slate-250 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Ledger Settlement Status</label>
              <select
                value={txStatus}
                onChange={e => setTxStatus(e.target.value)}
                className="w-full bg-[#12181D] text-slate-250 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer"
              >
                <option value="Settled">Settled (Tokens Debited)</option>
                <option value="Pending">Pending Audit</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddTx(false)}
              className="px-4 py-2 rounded-lg bg-slate-850 hover:bg-slate-800 text-xs font-semibold text-slate-350 border border-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-slate-100 shadow shadow-emerald-600/10"
            >
              Record Transaction
            </button>
          </div>
        </form>
      )}

      {/* Ledger Table */}
      <div className="bg-[#12181D] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/10">
          <h3 className="text-sm font-semibold text-slate-300">PPA & Transaction Ledger Records</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/40 border-b border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <th className="p-4 pl-6">Transaction ID</th>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Microgrid Node</th>
                <th className="p-4">Participant / User</th>
                <th className="p-4">Energy Amount</th>
                <th className="p-4">Value ({currency})</th>
                <th className="p-4 text-right pr-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {transactions.map(tx => (
                <tr key={tx.id} className="hover:bg-slate-800/10 transition-colors">
                  <td className="p-4 pl-6 font-mono text-emerald-400 font-semibold">{tx.id}</td>
                  <td className="p-4 text-slate-400">{new Date(tx.timestamp).toLocaleString()}</td>
                  <td className="p-4 font-medium text-slate-200">{tx.node}</td>
                  <td className="p-4 text-slate-300">{tx.user}</td>
                  <td className="p-4 font-mono font-bold text-slate-100">{tx.energy_kwh.toFixed(1)} kWh</td>
                  <td className="p-4 font-mono font-semibold text-emerald-400">{formatValue(tx.value_kes)}</td>
                  <td className="p-4 text-right pr-6">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider ${tx.status === 'Settled' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'}`}>
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
