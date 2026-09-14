# Capture test

## 1. Tool and model

- **Tool:** Claude Code CLI 2.1.270, terminal, macOS.
- **Model:** Opus 5 with 1M context (`claude-opus-5[1m]`; the transcript and logs record it as `claude-opus-5`). The same model plans and executes. Subagents and workflow agents inherit it; only main-session prompts and final responses are captured, as the brief asks.
- **Automatic mechanism:** yes. Claude Code hooks ([docs](https://code.claude.com/docs/en/hooks)), checked before building anything.

## 2. Mechanism and config

**Config changed:** `.claude/settings.json` (project-level and committed, so every session started in this repo loads it; Claude Code's settings watcher also picked it up live in the session that created it).

**Script:** `.claude/hooks/capture.mjs` (Node, no dependencies).

| Hook | What it does |
|---|---|
| `UserPromptSubmit` (`async: true`) | Appends a `PROMPT` entry with the hook's verbatim `prompt` field, a UTC timestamp and the model. |
| `Stop` | Appends a `RESPONSE` entry with `last_assistant_message`, the final text of the turn. No thinking, tool calls or intermediate text. |
| `PostModelSwitch` | Records `to_model` so a mid-session model switch shows on the entries after it. |

- The model is read from the session transcript (`transcript_path`): the `model` attachment Claude Code writes when a prompt is sent, or `message.model` on assistant messages.
- One file per session: `.agent-logs/YYYY-MM-DD_HH-MM-SS_<session-id>.md`. Entries are append-only. Only the frontmatter (`model`, `total_exchanges`, `last_prompt_time`) is recomputed on each append. Writes are atomic (temp file + rename) under a small lock.
- Failures never block a turn. They go to stderr and to `.agent-logs/capture-errors.log`.

**Backfill, stated plainly:** this session (`d33e7375`) started before the hook existed. Its first six prompts, and the one earlier turn that ended with a final response (num 4), were rebuilt once from the Claude Code transcript with `node .claude/hooks/capture.mjs backfill <transcript.jsonl>` in commit `be1d275`. Prompts 1–3 and 5 are the brief and the capture doc re-sent after interrupts, so those turns have no response. Everything from `RESPONSE num=6` onwards was written live by the hooks.

## 3. Where the canaries landed

| Canary | Session | Log file |
|---|---|---|
| 1 | `d33e7375`, this interactive session, entry num 7 | `.agent-logs/2026-09-14_11-57-04_d33e7375-9310-44d1-a031-01d9ad53c013.md` |
| 2 | `f1edfb32`, a separate new session | `.agent-logs/2026-09-14_12-29-11_f1edfb32-9c46-431a-a066-3f22e0118b3a.md` |

Canary 2 was sent by the agent running `claude -p "<canary>"` from the repo root: a separate process with its own session id that loaded `.claude/settings.json` from disk. It was not typed by hand in a second terminal.

## 4. Canary entries (raw)

### Canary 1

````text
[LOG_ENTRY type=PROMPT num=7 session=d33e7375]
timestamp: 2026-09-14T12:28:57.317Z
model: claude-opus-5

 CAPTURE TEST — 8x assignment, Shafqat Mehmood


[LOG_ENTRY type=RESPONSE num=7 session=d33e7375]
timestamp: 2026-09-14T12:30:06.745Z
model: claude-opus-5

The second session passed. Its log (`f1edfb32`) has both the prompt and the response, each tagged `model: claude-opus-5`. Your canary in this session (`d33e7375`) has its prompt logged as num=7, and its response gets written as soon as this reply ends.

A background watcher is waiting for that response. When it lands I'll write `CAPTURE-TEST.md` with both canaries pasted exactly as logged, then commit and push. After that the capture test is green and I'll start on the Amazon research.
````

### Canary 2

````text
[LOG_ENTRY type=PROMPT num=1 session=f1edfb32]
timestamp: 2026-09-14T12:29:11.577Z
model: claude-opus-5

CAPTURE TEST — 8x assignment, Shafqat Mehmood (second session)


[LOG_ENTRY type=RESPONSE num=1 session=f1edfb32]
timestamp: 2026-09-14T12:29:29.095Z
model: claude-opus-5

The capture hook worked for this second session. Your prompt was saved to a new log file, `.agent-logs/2026-09-14_12-29-11_f1edfb32-9c46-431a-a066-3f22e0118b3a.md`:

- **Session:** `f1edfb32`, logged separately from the first session's file (`d33e7375`).
- **Model:** `claude-opus-5`, so reading the model from the transcript (your latest commit) is working.
- **Prompt:** logged word for word as exchange #1, with its timestamp.

Two things to check:
- **Author** is `Shifu34`, but your git user is `Shafqat Mehmood`. If the log should use your git name, the hook is reading it from somewhere else.
- **Project** is `amazon-rebuild`, but the folder is `8x`. That's fine if you set it on purpose.

The log doesn't have my reply yet, because the response hook only runs after this turn ends. Open the file again afterwards to check it was added and that `total_exchanges` updated.
````

## 5. What did not work first

1. **The setup link.** The brief's "8x agent capture setup" arrived as plain text with no URL, and web search didn't find the page, so I asked for the doc.
2. **GitHub from the sandbox.** `gh api` first failed with `error connecting to api.github.com`. It worked a few minutes later.
3. **Getting the model from `SessionStart`.** A raw stdin dump showed `{"session_id":…,"hook_event_name":"SessionStart","source":"startup"}` with no `model` field, so I dropped that hook.
4. **Reading the transcript straight away in `Stop`.** The transcript is flushed asynchronously, so the first preflight logged `model: unknown` on the response. A probe showed the assistant entry appears about 57ms into the hook, so `Stop` now polls for up to 3s.
5. **A blocking `UserPromptSubmit`.** The transcript doesn't flush while the prompt hook blocks, so the first prompt of a new session waited 2s and still logged `model: unknown`. Fixed by making the prompt hook `async`. `Stop` waits for a per-prompt marker file so `PROMPT` always lands before its `RESPONSE`.
6. **Test harness slips.**
   - zsh doesn't word-split `$H` (exit 127).
   - zsh `echo` turned `\n` into real newlines, which made the JSON invalid. The hook failed without blocking, as designed.
   - macOS has no `timeout` command.
7. **Preflight runs.** The four preflights ran in throwaway temp copies of `.claude/`, so their logs are not in this repo.
