// Items grouped into shipments by arrival day, earliest first. Used by checkout (client) and the thank-you page (server).
export function shipments<T>(items: T[], arrives: (item: T) => Date) {
  const groups = new Map<number, { date: Date; items: T[] }>()
  for (const item of items) {
    const date = arrives(item)
    const day = Math.floor(date.getTime() / 86_400_000)
    const group = groups.get(day)
    if (group) group.items.push(item)
    else groups.set(day, { date, items: [item] })
  }
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([, g]) => g)
}
