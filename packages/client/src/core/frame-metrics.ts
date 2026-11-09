/**
 * The page's own cost readings (docs/PERFORMANCE.md): how many feature hooks a
 * pass called, and how many layout reads the frame made. The long-session lane
 * reads them; nothing in the product acts on them.
 */
/** One feature hook's wall clock inside a pass, rounded to a tenth of a millisecond. */
export interface HookReading {
  readonly measure: number
  readonly sync: number
}

export interface PassReading {
  measures: number
  syncs: number
  /** Wall clock spent in the read phase, rounded to a tenth of a millisecond. */
  measureMs: number
  /** Wall clock spent in the write phase, rounded to a tenth of a millisecond. */
  syncMs: number
  /** Each called handle's own cost in this pass, by the name it registered under. */
  hooks: Record<string, HookReading>
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
