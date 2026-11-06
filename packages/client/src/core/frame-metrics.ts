/**
 * The page's own cost readings (docs/PERFORMANCE.md): how many feature hooks a
 * pass called, and how many layout reads the frame made. The long-session lane
 * reads them; nothing in the product acts on them.
 */
export interface PassReading {
  measures: number
  syncs: number
}

/** The most readings kept: a long lane reads once, and a forgotten page keeps no more than this. */
const CAP = 60000
/** A ring, so the cap costs one write rather than a copy of every reading behind the oldest. */
let readings: PassReading[] = []
let next = 0

export function recordPassReading(reading: PassReading) {
  if (readings.length < CAP) {
    readings.push(reading)
    return
  }
  readings[next] = reading
  next = (next + 1) % CAP
}

/** The readings in the order they were recorded, oldest first. */
export function readPassReadings(): PassReading[] {
  if (readings.length < CAP) return readings.slice()
  return [...readings.slice(next), ...readings.slice(0, next)]
}

export function clearPassReadings() {
  readings = []
  next = 0
}
