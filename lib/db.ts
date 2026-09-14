// Postgres access. Neon over HTTP when DATABASE_URL is set (Vercel); otherwise an in-process
// PGlite database persisted to .data/ so the app runs locally with no database server.
// Multi-row writes that must be atomic use a single statement (CTEs): the Neon HTTP driver has no interactive transactions.
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { neon } from '@neondatabase/serverless'

type Row = Record<string, unknown>
type Run = (text: string, params: unknown[]) => Promise<Row[]>

const g = globalThis as typeof globalThis & { __db?: Promise<Run> }

async function connect(): Promise<Run> {
  if (process.env.DATABASE_URL) {
    const sql = neon(process.env.DATABASE_URL)
    return (text, params) => sql.query(text, params) as Promise<Row[]>
  }
  const { PGlite } = await import('@electric-sql/pglite')
  const dir = path.join(process.cwd(), '.data/pglite')
  mkdirSync(dir, { recursive: true })
  const db = new PGlite(dir)
  await db.exec(readFileSync(path.join(process.cwd(), 'db/schema.sql'), 'utf8'))
  return async (text, params) => (await db.query<Row>(text, params)).rows
}

export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  g.__db ??= connect()
  return (await (await g.__db)(text, params)) as T[]
}

export async function one<T = Row>(text: string, params: unknown[] = []): Promise<T | undefined> {
  return (await query<T>(text, params))[0]
}
