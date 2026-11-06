/**
 * The page's own cost readings (docs/PERFORMANCE.md): how many feature hooks a
 * pass called, and how many layout reads the frame made. The long-session lane
 * reads them; nothing in the product acts on them.
 */
export interface PassReading {
  measures: number
  syncs: number
}

let readings: PassReading[] = []

export function recordPassReading(reading: PassReading) {
  readings.push(reading)
  // A long lane reads once; a cap keeps a forgotten page from filling memory.
  if (readings.length > 60000) readings.shift()
}

export function readPassReadings(): PassReading[] {
  return readings.slice()
}

export function clearPassReadings() {
  readings = []
}
