#!/usr/bin/env node
// Captures every prompt and the final response of each turn into .agent-logs/, one file per session.
// Wired in .claude/settings.json: UserPromptSubmit + Stop write entries; SessionStart + PostModelSwitch track the model.
// Recovery for turns that predate the hook: node .claude/hooks/capture.mjs backfill <transcript.jsonl>
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const LOGS = path.resolve(import.meta.dirname, '../../.agent-logs')
const AUTHOR = 'Shifu34'
const PROJECT = 'amazon-rebuild'

process.on('uncaughtException', (e) => {
  console.error(`agent capture failed: ${e.stack}`)
  process.exit(1) // non-blocking: the turn proceeds, Claude Code shows the error
})

const readJsonl = (file) => {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').flatMap((l) => { try { return [JSON.parse(l)] } catch { return [] } })
  } catch { return [] }
}

const isModel = (e) => e.type === 'assistant' && !e.isSidechain && e.message?.model && e.message.model !== '<synthetic>'
const stateFile = (sid) => path.join(os.tmpdir(), `agent-capture-${sid}.model`)
const currentModel = (sid, transcript) => {
  try { return fs.readFileSync(stateFile(sid), 'utf8') } catch {}
  // ponytail: parses the whole transcript once per session until a model is known; fine for MB-sized transcripts
  const model = readJsonl(transcript).findLast(isModel)?.message.model
  if (model) fs.writeFileSync(stateFile(sid), model)
  return model ?? 'unknown'
}

// ponytail: mkdir lock, gives up waiting after ~2s so a stale lock can never block capture
const withLock = (fn) => {
  const lock = path.join(LOGS, '.lock')
  for (let i = 0; i < 200; i++) {
    try { fs.mkdirSync(lock); break } catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10) }
  }
  try { fn() } finally { fs.rmSync(lock, { recursive: true, force: true }) }
}

function append(sid, type, text, ts, model, note = '') {
  fs.mkdirSync(LOGS, { recursive: true })
  withLock(() => {
    const name = fs.readdirSync(LOGS).find((f) => f.endsWith(`_${sid}.md`))
      ?? `${ts.slice(0, 19).replace('T', '_').replaceAll(':', '-')}_${sid}.md`
    const file = path.join(LOGS, name)
    const raw = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
    const head = raw ? raw.slice(0, raw.indexOf('\n---\n') + 5) : ''
    const get = (k) => head.match(new RegExp(`^${k}: (.*)$`, 'm'))?.[1]
    const short = sid.slice(0, 8)
    const n = Number(get('total_exchanges') ?? 0) + (type === 'PROMPT' ? 1 : 0)
    const first = get('first_prompt_time') ?? ts
    const last = type === 'PROMPT' ? ts : (get('last_prompt_time') ?? ts)

    let body = raw ? raw.slice(head.length)
      : `\n# Session Log - ${first.slice(0, 10)}\n\nSession: \`${short}\` | Project: \`${PROJECT}\` | Author: \`${AUTHOR}\`\n\n---\n\n`
    body += `[LOG_ENTRY type=${type} num=${n} session=${short}]\ntimestamp: ${ts}\nmodel: ${model}\n${note && note + '\n'}\n${text}\n\n\n`
    const front = ['---', `session_id: ${sid}`, `date: ${first.slice(0, 10)}`, `author: ${AUTHOR}`, `model: ${model}`,
      'tool: claude-code', `project: ${PROJECT}`, `total_exchanges: ${n}`, `first_prompt_time: ${first}`, `last_prompt_time: ${last}`, '---', ''].join('\n')
    fs.writeFileSync(`${file}.tmp`, front + body)
    fs.renameSync(`${file}.tmp`, file)
  })
}

function backfill(transcript) {
  const sid = path.basename(transcript, '.jsonl')
  const entries = readJsonl(transcript)
  if (fs.existsSync(LOGS) && fs.readdirSync(LOGS).some((f) => f.endsWith(`_${sid}.md`))) throw new Error(`log for ${sid} already exists`)
  let model = entries.find(isModel)?.message.model ?? 'unknown'
  let final = null
  for (const e of entries) {
    if (e.isSidechain) continue
    if (e.type === 'user' && e.origin?.kind === 'human') {
      if (final) append(sid, 'RESPONSE', final.text, final.ts, final.model)
      final = null
      const c = e.message.content
      append(sid, 'PROMPT', typeof c === 'string' ? c : c.filter((b) => b.type === 'text').map((b) => b.text).join('\n'), e.timestamp, model)
    } else if (e.type === 'user') {
      final = null // tool result or interrupt: the text before it was not the turn's final answer
    } else if (isModel(e)) {
      model = e.message.model
      const text = e.message.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
      if (e.message.content.some((b) => b.type === 'tool_use')) final = null
      else if (text) final = { text: final?.id === e.message.id ? final.text + text : text, id: e.message.id, ts: e.timestamp, model }
    }
  }
  // the transcript's last turn is still running; its Stop hook writes that response
}

if (process.argv[2] === 'backfill') {
  backfill(process.argv[3])
} else {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'))
  const sid = input.session_id
  const now = new Date().toISOString()
  switch (input.hook_event_name) {
    case 'SessionStart':
      if (input.model) fs.writeFileSync(stateFile(sid), String(input.model.id ?? input.model))
      break
    case 'PostModelSwitch':
      fs.writeFileSync(stateFile(sid), input.to_model)
      break
    case 'UserPromptSubmit': {
      const src = input.prompt_source && input.prompt_source !== 'user_input' ? `source: ${input.prompt_source}` : ''
      append(sid, 'PROMPT', input.prompt, now, currentModel(sid, input.transcript_path), src)
      break
    }
    case 'Stop':
      append(sid, 'RESPONSE', input.last_assistant_message ?? '', now, currentModel(sid, input.transcript_path))
      break
  }
}
