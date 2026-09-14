'use client'

import Form from 'next/form'

// GET form: changing the select submits (client navigation); without JS the Go button does it.
export function SortSelect({ value, options, keep }: { value: string; options: [string, string][]; keep: Record<string, string> }) {
  return (
    <Form action="/deals" className="flex items-center gap-1.5 text-[13px]">
      {Object.entries(keep).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label htmlFor="deals-sort">Sort by:</label>
      <select key={value} id="deals-sort" name="sort" defaultValue={value} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="select-pill">
        {options.map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="btn btn-plain">Go</button>
      </noscript>
    </Form>
  )
}
