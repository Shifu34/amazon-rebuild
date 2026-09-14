'use client'

import Form from 'next/form'

// "N orders placed in [past 3 months]": a GET form that submits when the select changes; the Go button covers no-JS.
export function RangeSelect({ value, options, tab }: { value: string; options: { key: string; label: string }[]; tab: string }) {
  return (
    <Form action="/orders" className="inline-flex items-center gap-1.5">
      {tab !== 'orders' && <input type="hidden" name="tab" value={tab} />}
      <label htmlFor="order-range" className="sr-only">Time period</label>
      <select key={value} id="order-range" name="range" defaultValue={value} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="select-pill">
        {options.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="btn btn-plain">Go</button>
      </noscript>
    </Form>
  )
}
