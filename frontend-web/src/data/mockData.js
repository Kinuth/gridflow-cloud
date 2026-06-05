// Jitter helper to add minor random fluctuations (± percentage)
export function jitter(value, maxPercentage = 5) {
  const change = (Math.random() * 2 - 1) * (maxPercentage / 100) * value
  return Number((value + change).toFixed(2))
}

// Generate a 24-hour cycle of power generation and load consumption
export function generate24HourData(capacityKw = 30) {
  const data = []
  for (let hour = 0; hour < 24; hour++) {
    const timeStr = `${hour.toString().padStart(2, '0')}:00`
    
    // Solar generation profile (bell curve peaking around 12:00)
    let solarKw = 0
    if (hour >= 6 && hour <= 18) {
      const x = (hour - 12) / 3 // Standard dev
      solarKw = capacityKw * Math.exp(-0.5 * x * x) // Gaussian bell curve
      solarKw = Math.max(0, solarKw)
    }

    // Load consumption profile (morning peak 8:00, evening peak 19:00)
    let loadKw = 2 + Math.random() * 2 // Base load
    if (hour >= 7 && hour <= 9) {
      loadKw += 8 * Math.exp(-0.5 * Math.pow((hour - 8) / 0.8, 2)) // Morning spike
    } else if (hour >= 18 && hour <= 21) {
      loadKw += 12 * Math.exp(-0.5 * Math.pow((hour - 19) / 1.2, 2)) // Evening spike
    } else if (hour >= 9 && hour <= 17) {
      loadKw += 4 + Math.random() * 2 // Moderate business day load
    }

    // Grid feed-in / purchase balance
    // Positive = feeding into the grid, Negative = buying from grid
    const batterySoc = hour < 6 ? 30 - hour * 2 : hour < 16 ? Math.min(100, 30 + (hour - 6) * 10) : Math.max(30, 100 - (hour - 16) * 7)
    
    // Net energy balance
    const netKw = solarKw - loadKw
    let gridKw = 0
    let batteryPowerKw = 0

    if (netKw > 0) {
      if (batterySoc < 95) {
        batteryPowerKw = Math.min(netKw, capacityKw * 0.3) // Charge battery
        gridKw = netKw - batteryPowerKw
      } else {
        gridKw = netKw // Feed into grid
      }
    } else {
      if (batterySoc > 25) {
        batteryPowerKw = Math.max(netKw, -capacityKw * 0.3) // Discharge battery
        gridKw = netKw - batteryPowerKw
      } else {
        gridKw = netKw // Import from grid
      }
    }

    data.push({
      time: timeStr,
      power: Number(solarKw.toFixed(2)),
      consumption: Number(loadKw.toFixed(2)),
      feedIn: Number(Math.max(0, gridKw).toFixed(2)),
      purchase: Number(Math.max(0, -gridKw).toFixed(2)),
      batteryPower: Number(batteryPowerKw.toFixed(2)),
      batterySoc: Math.round(batterySoc)
    })
  }
  return data
}

// Default 24h dataset
export const DEFAULT_HOURLY_DATA = generate24HourData(30)

// Default list of locations/nodes for Microgrid Network
export const DEFAULT_NODES = [
  {
    serial_number: "SN-GF-08129",
    site_name: "Sharjah Rooftop Site A",
    capacity_kw: 30.0,
    location: "Sharjah, UAE",
    data_source: "DEYE",
    provider_station_id: "station-42",
    provider_device_id: "ext-device-001",
    status: "ONLINE",
    temperature_c: 42.5,
    weather: { temp: 28.5, desc: "Clear", icon: "sun" }
  },
  {
    serial_number: "SN-GF-09551",
    site_name: "Nantong Plant",
    capacity_kw: 15.0,
    location: "Nantong, China",
    data_source: "DEYE",
    provider_station_id: "station-50",
    provider_device_id: "ext-device-021",
    status: "ONLINE",
    temperature_c: 38.2,
    weather: { temp: 20.4, desc: "Partly Cloudy", icon: "cloud-sun" }
  },
  {
    serial_number: "SN-GF-03487",
    site_name: "Chama Community Center",
    capacity_kw: 10.0,
    location: "Kisumu, Kenya",
    data_source: "SOLARMAN",
    provider_station_id: "station-88",
    provider_device_id: "ext-device-109",
    status: "ONLINE",
    temperature_c: 45.1,
    weather: { temp: 25.2, desc: "Showers", icon: "cloud-rain" }
  },
  {
    serial_number: "SN-GF-02209",
    site_name: "SME Agro-Processing",
    capacity_kw: 50.0,
    location: "Eldoret, Kenya",
    data_source: "DEYE",
    provider_station_id: "station-12",
    provider_device_id: "ext-device-085",
    status: "ONLINE",
    temperature_c: 41.8,
    weather: { temp: 22.0, desc: "Clear", icon: "sun" }
  },
  {
    serial_number: "SN-GF-01140",
    site_name: "Suba Dispensary Block B",
    capacity_kw: 8.5,
    location: "Homa Bay, Kenya",
    data_source: "MANUAL",
    provider_station_id: "station-manual-1",
    provider_device_id: "ext-device-manual-1",
    status: "ONLINE",
    temperature_c: 35.6,
    weather: { temp: 26.8, desc: "Sunny", icon: "sun" }
  },
  {
    serial_number: "SN-GF-05562",
    site_name: "Residential Cluster C",
    capacity_kw: 25.0,
    location: "Nairobi, Kenya",
    data_source: "SOLARMAN",
    provider_station_id: "station-90",
    provider_device_id: "ext-device-202",
    status: "OFFLINE",
    temperature_c: 24.0,
    weather: { temp: 19.5, desc: "Cloudy", icon: "cloud" }
  }
]

// Mock alerts for initial state
export const DEFAULT_ALERTS = [
  {
    id: 1,
    alert_code: "E021",
    alert_name: "Grid Overvoltage",
    severity: "WARNING",
    occurred_at: new Date(Date.now() - 4 * 3600000).toISOString(),
    is_active: true
  },
  {
    id: 2,
    alert_code: "E045",
    alert_name: "Inverter Overtemperature",
    severity: "CRITICAL",
    occurred_at: new Date(Date.now() - 12 * 3600000).toISOString(),
    is_active: true
  },
  {
    id: 3,
    alert_code: "I102",
    alert_name: "Battery SoC Low Threshold",
    severity: "INFO",
    occurred_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    is_active: false
  }
]

// Shared Energy Ledger / Tokenomics Transactions
export const DEFAULT_TRANSACTIONS = [
  {
    id: "tx_01a3f9e",
    timestamp: new Date(Date.now() - 10 * 60000).toISOString(),
    node: "Chama Community Center",
    user: "User 102 (Bakery)",
    energy_kwh: 14.5,
    value_kes: 261.0,
    status: "Settled"
  },
  {
    id: "tx_05f2b8d",
    timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
    node: "Residential Cluster C",
    user: "User 208 (Household)",
    energy_kwh: 5.2,
    value_kes: 93.6,
    status: "Settled"
  },
  {
    id: "tx_09e4d7a",
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    node: "Chama Community Center",
    user: "User 105 (Tailor Shop)",
    energy_kwh: 8.8,
    value_kes: 158.4,
    status: "Settled"
  },
  {
    id: "tx_12a3d4f",
    timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
    node: "SME Agro-Processing",
    user: "User 042 (Cold Storage)",
    energy_kwh: 45.0,
    value_kes: 810.0,
    status: "Pending"
  },
  {
    id: "tx_15c9e2b",
    timestamp: new Date(Date.now() - 8 * 3600000).toISOString(),
    node: "Sharjah Rooftop Site A",
    user: "GridFlow Utility Pool",
    energy_kwh: 120.0,
    value_kes: 2160.0,
    status: "Settled"
  },
  {
    id: "tx_18f5d0c",
    timestamp: new Date(Date.now() - 14 * 3600000).toISOString(),
    node: "Suba Dispensary Block B",
    user: "Clinic Vaccine Fridge",
    energy_kwh: 12.4,
    value_kes: 223.2,
    status: "Settled"
  },
  {
    id: "tx_22e9b8a",
    timestamp: new Date(Date.now() - 20 * 3600000).toISOString(),
    node: "Residential Cluster C",
    user: "User 215 (Household)",
    energy_kwh: 3.1,
    value_kes: 55.8,
    status: "Pending"
  }
]
