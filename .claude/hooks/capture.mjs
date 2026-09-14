#!/usr/bin/env node
// Captures every prompt and the final response of each turn into .agent-logs/, one file per session.
// Wired in .claude/settings.json: UserPromptSubmit (async) + Stop write entries; PostModelSwitch tracks model switches.
// Recovery for turns that predate the hook: node .claude/hooks/capture.mjs backfill <transcript.jsonl>
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const LOGS = path.resolve(import.meta.dirname, '../../.agent-logs')
const AUTHOR = 'Shifu34'
const PROJECT = 'amazon-rebuild'

process.on('uncaughtException', (e) => {
  // async hooks have their output ignored, so failures also go to a file that ships with the logs
  try { fs.appendFileSync(path.join(LOGS, 'capture-errors.log'), `${new Date().toISOString()} ${e.stack}\n`) } catch {}
  console.error(`agent capture failed: ${e.stack}`)
  process.exit(1) // non-blocking: the turn proceeds
})

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
const waitFor = (ok, ms) => { for (let t = 0; !ok() && t < ms; t += 50) sleep(50) }
const readJsonl = (file) => {
  try {
    return fs.readFileSync(file, 'utf8').split('\n').flatMap((l) => { try { return [JSON.parse(l)] } catch { return [] } })
  } catch { return [] }
}
const textOf = (e) => e.message.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
const isAssistant = (e) => e.type === 'assistant' && !e.isSidechain && Array.isArray(e.message?.content) && e.message.model !== '<synthetic>'
// the session model is recorded as a "model" attachment when a prompt is sent, and on every assistant message
const modelOf = (e) => (isAssistant(e) ? e.message.model
  : e.type === 'attachment' && e.attachment?.type === 'model' ? e.attachment.identity?.modelId : undefined)?.replace(/\[[^\]]*\]$/, '')

const tmp = (name) => path.join(os.tmpdir(), `agent-capture-${name}`)
// Claude Code flushes the transcript asynchronously, so give it a few seconds to land before reading the model.
const currentModel = (sid, transcript, ready) => {
  try { return fs.readFileSync(tmp(`${sid}.model`), 'utf8') } catch {} // written by PostModelSwitch
  let entries = []
  waitFor(() => ready(entries = readJsonl(transcript)), 3000)
  return entries.map(modelOf).findLast(Boolean) ?? 'unknown'
}

// ponytail: mkdir lock, gives up waiting after ~2s so a stale lock can never block capture
const withLock = (fn) => {
  const lock = path.join(LOGS, '.lock')
  for (let i = 0; i < 200; i++) {
    try { fs.mkdirSync(lock); break } catch { sleep(10) }
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
  let model = entries.map(modelOf).find(Boolean) ?? 'unknown'
  let final = null
  for (const e of entries) {
    if (e.isSidechain) continue
    model = modelOf(e) ?? model
    if (e.type === 'user' && e.origin?.kind === 'human') {
      if (final) append(sid, 'RESPONSE', final.text, final.ts, final.model)
      final = null
      const c = e.message.content
      append(sid, 'PROMPT', typeof c === 'string' ? c : c.filter((b) => b.type === 'text').map((b) => b.text).join('\n'), e.timestamp, model)
    } else if (e.type === 'user') {
      final = null // tool result or interrupt: the text before it was not the turn's final answer
    } else if (isAssistant(e)) {
      const text = textOf(e)
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
    case 'PostModelSwitch':
      fs.writeFileSync(tmp(`${sid}.model`), input.to_model.replace(/\[[^\]]*\]$/, ''))
      break
    case 'UserPromptSubmit': {
      // runs async, so the transcript can flush a brand-new session's model while this waits
      const src = input.prompt_source && input.prompt_source !== 'user_input' ? `source: ${input.prompt_source}` : ''
      const model = currentModel(sid, input.transcript_path, (es) => es.some(modelOf))
      append(sid, 'PROMPT', input.prompt, now, model, src)
      if (input.prompt_id) fs.writeFileSync(tmp(`${input.prompt_id}.logged`), '')
      break
    }
    case 'Stop': {
      // the async prompt hook may still be writing; keep PROMPT ahead of its RESPONSE
      if (input.prompt_id) waitFor(() => fs.existsSync(tmp(`${input.prompt_id}.logged`)), 5000)
      const msg = input.last_assistant_message ?? ''
      const model = currentModel(sid, input.transcript_path, (es) => {
        const a = es.findLast((e) => isAssistant(e) && textOf(e))
        return !msg || (a && msg.endsWith(textOf(a)))
      })
      append(sid, 'RESPONSE', msg, now, model)
      break
    }
  }
}
