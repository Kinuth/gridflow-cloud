import { useState, useEffect, useRef } from 'react'
import { fetchDevices, fetchLatestTelemetry, createDevice as apiCreateDevice, fetchTelemetryRange } from '../api'
import { DEFAULT_NODES, jitter, generate24HourData } from '../data/mockData'

export default function useLiveTelemetry(token) {
  const [devices, setDevices] = useState([])
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [latestTelemetry, setLatestTelemetry] = useState(null)
  const [hourlyData, setHourlyData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isSeeding, setIsSeeding] = useState(false)
  const [isSimulated, setIsSimulated] = useState(false)

  // Use a ref to keep track of simulated telemetry so the interval updates it properly
  const telemetryRef = useRef(null)

  // Load devices list
  const loadDevices = async () => {
    if (!token) return
    setLoading(true)
    setError(null)

    // Check if token is the demo bypass token
    if (token === 'DEMO_BYPASS_TOKEN_4451') {
      const mockList = DEFAULT_NODES.map((node, index) => ({
        id: index + 100, // mock ID
        ...node
      }))
      setDevices(mockList)
      if (mockList.length > 0) {
        setSelectedDevice(prev => {
          if (prev) {
            // keep previous selected device if it matches
            const found = mockList.find(d => d.id === prev.id || d.serial_number === prev.serial_number)
            if (found) return found
          }
          return mockList[0]
        })
      }
      setIsSimulated(true)
      setLoading(false)
      return
    }

    try {
      const list = await fetchDevices(token)
      const results = list.results || list
      setDevices(results)
      
      // Select first device by default if none selected
      if (results.length > 0 && !selectedDevice) {
        setSelectedDevice(results[0])
      }
    } catch (err) {
      console.error('Failed to fetch devices, falling back to local simulation:', err)
      const mockList = DEFAULT_NODES.map((node, index) => ({
        id: index + 100, // mock ID
        ...node
      }))
      setDevices(mockList)
      if (mockList.length > 0) {
        setSelectedDevice(prev => {
          if (prev) {
            const found = mockList.find(d => d.id === prev.id || d.serial_number === prev.serial_number)
            if (found) return found
          }
          return mockList[0]
        })
      }
      setIsSimulated(true)
    } finally {
      setLoading(false)
    }
  }

  // Load initial devices list
  useEffect(() => {
    loadDevices()
  }, [token])

  // Seeder to create default nodes in the Django backend if database is empty
  const seedDefaultDevices = async () => {
    if (!token || isSeeding) return
    setIsSeeding(true)
    setError(null)
    if (token === 'DEMO_BYPASS_TOKEN_4451' || isSimulated) {
      // Local seed
      const mockList = DEFAULT_NODES.map((node, index) => ({
        id: index + 100, // mock ID
        ...node
      }))
      localStorage.setItem('gridflow_simulated_devices', JSON.stringify(mockList))
      setDevices(mockList)
      setSelectedDevice(mockList[0])
      setIsSeeding(false)
      return
    }
    try {
      for (const node of DEFAULT_NODES) {
        await apiCreateDevice(token, {
          serial_number: node.serial_number,
          device_type: 'INVERTER',
          data_source: node.data_source,
          provider_device_id: node.provider_device_id,
          provider_station_id: node.provider_station_id,
        })
      }
      await loadDevices()
    } catch (err) {
      console.error('Seeding devices failed:', err)
      setError('Failed to seed default devices in the Django backend: ' + err.message)
    } finally {
      setIsSeeding(false)
    }
  }

  // Fetch telemetry for the selected device
  useEffect(() => {
    if (!token || !selectedDevice) {
      setLatestTelemetry(null)
      setHourlyData([])
      return
    }

    let isMounted = true

    const fetchTelemetryData = async () => {
      try {
        // 1. Fetch latest reading from Django API
        const data = await fetchLatestTelemetry(token, selectedDevice.id)
        
        if (!isMounted) return

        // 2. Fetch history range for chart
        const end = new Date()
        const start = new Date(end.getTime() - 24 * 60 * 60 * 1000)
        const history = await fetchTelemetryRange(token, selectedDevice.id, start.toISOString(), end.toISOString())
        
        if (!isMounted) return

        if (data && Object.keys(data).length > 0 && !data.detail) {
          // Real backend data exists!
          setLatestTelemetry(data)
          setIsSimulated(false)
          telemetryRef.current = data
        } else {
          // No telemetry reading found in Django database. Fall back to simulation.
          // Create initial mock telemetry based on device capacity
          const cap = selectedDevice.capacity_kw || 30.0
          const mockReadings = {
            power_w: cap * 1000 * 0.45,
            energy_today_kwh: cap * 4.2,
            battery_soc: 78,
            battery_power_w: 1200,
            grid_power_w: 1500,
            load_power_w: cap * 1000 * 0.3,
            pv_total_power_w: cap * 1000 * 0.48,
            temperature_c: 41.5,
            timestamp: new Date().toISOString(),
            source: selectedDevice.data_source || 'MANUAL',
            is_simulated_fallback: true
          }
          setLatestTelemetry(mockReadings)
          setIsSimulated(true)
          telemetryRef.current = mockReadings
        }

        if (history && history.length > 0) {
          setHourlyData(history)
        } else {
          // Fall back to generated 24h profiles
          const cap = selectedDevice.capacity_kw || 30.0
          setHourlyData(generate24HourData(cap))
        }
      } catch (err) {
        console.error('Failed to load telemetry, using simulation fallback:', err)
        if (!isMounted) return
        
        // Fall back to simulated state on network/API failure
        const cap = selectedDevice.capacity_kw || 30.0
        const mockReadings = {
          power_w: cap * 1000 * 0.45,
          energy_today_kwh: cap * 4.2,
          battery_soc: 78,
          battery_power_w: 1200,
          grid_power_w: 1500,
          load_power_w: cap * 1000 * 0.3,
          pv_total_power_w: cap * 1000 * 0.48,
          temperature_c: 41.5,
          timestamp: new Date().toISOString(),
          source: selectedDevice.data_source || 'MANUAL',
          is_simulated_fallback: true
        }
        setLatestTelemetry(mockReadings)
        setIsSimulated(true)
        telemetryRef.current = mockReadings
        setHourlyData(generate24HourData(cap))
      }
    }

    fetchTelemetryData()

    // 3-second cycle to simulate live fluctuating IoT telemetry
    const interval = setInterval(() => {
      if (!isMounted) return

      if (telemetryRef.current) {
        // Fluctuating values
        const current = telemetryRef.current
        const cap = selectedDevice.capacity_kw || 30.0

        // Inverter temperature fluctuates slightly
        const temp = jitter(current.temperature_c || 40.0, 1)
        
        // Jitter other metrics depending on state
        const pv = Math.max(0, jitter(current.pv_total_power_w || (cap * 1000 * 0.5), 3))
        const load = Math.max(100, jitter(current.load_power_w || (cap * 1000 * 0.3), 2))
        
        // Recharge battery or discharge based on net power
        let batteryPower = current.battery_power_w
        let soc = current.battery_soc || 50
        
        const net = pv - load
        if (net > 0) {
          batteryPower = jitter(net * 0.5, 4) // Charge
          if (soc < 100 && Math.random() > 0.8) soc = Math.min(100, soc + 1)
        } else {
          batteryPower = jitter(net * 0.7, 4) // Discharge (negative)
          if (soc > 20 && Math.random() > 0.8) soc = Math.max(20, soc - 1)
        }

        const grid = net - batteryPower

        const updated = {
          ...current,
          pv_total_power_w: Number(pv.toFixed(1)),
          load_power_w: Number(load.toFixed(1)),
          battery_soc: soc,
          battery_power_w: Number(batteryPower.toFixed(1)),
          grid_power_w: Number(grid.toFixed(1)),
          power_w: Number((pv - batteryPower).toFixed(1)),
          temperature_c: Number(temp.toFixed(1)),
          timestamp: new Date().toISOString()
        }

        setLatestTelemetry(updated)
        telemetryRef.current = updated
      }
    }, 3000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [token, selectedDevice])

  const createDevice = async (payload) => {
    if (token === 'DEMO_BYPASS_TOKEN_4451' || isSimulated) {
      // Add local
      const stored = localStorage.getItem('gridflow_simulated_devices')
      let list = []
      if (stored) {
        list = JSON.parse(stored)
      } else {
        list = DEFAULT_NODES.map((node, index) => ({
          id: index + 100,
          ...node
        }))
      }
      const newDevice = {
        id: Math.floor(Math.random() * 10000) + 1000,
        status: 'ONLINE',
        ...payload
      }
      list.push(newDevice)
      localStorage.setItem('gridflow_simulated_devices', JSON.stringify(list))
      setDevices(list)
      if (list.length === 1 || !selectedDevice) {
        setSelectedDevice(newDevice)
      }
    } else {
      await apiCreateDevice(token, payload)
      await loadDevices()
    }
  }

  const deleteDevice = async (deviceId) => {
    if (token === 'DEMO_BYPASS_TOKEN_4451' || isSimulated) {
      // Delete local
      const stored = localStorage.getItem('gridflow_simulated_devices')
      if (stored) {
        let list = JSON.parse(stored)
        list = list.filter(d => d.id !== deviceId)
        localStorage.setItem('gridflow_simulated_devices', JSON.stringify(list))
        setDevices(list)
        if (selectedDevice?.id === deviceId) {
          setSelectedDevice(list.length > 0 ? list[0] : null)
        }
      }
    } else {
      try {
        await fetch(`http://localhost:8000/api/devices/${deviceId}/`, {
          method: 'DELETE',
          headers: { Authorization: `Token ${token}` }
        })
        await loadDevices()
      } catch (err) {
        console.error('Delete API error:', err)
      }
    }
  }

  return {
    devices,
    selectedDevice,
    setSelectedDevice,
    latestTelemetry,
    hourlyData,
    loading,
    error,
    isSeeding,
    isSimulated,
    seedDefaultDevices,
    refreshDevices: loadDevices,
    createDevice,
    deleteDevice
  }
}
