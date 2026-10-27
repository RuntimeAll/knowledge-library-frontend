// A request owns its data and loading state only while its ticket is current.
export function createRequestGeneration() {
  let generation = 0
  return {
    start: () => ++generation,
    current: ticket => ticket === generation,
    invalidate: () => { generation++ }
  }
}
