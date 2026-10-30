import { addDays, format, parseISO } from 'date-fns'
import type { TaskPriority } from '../types/models'

/**
 * Smart capture: "Telepon vendor besok !high #work @CML" becomes a task with a due date, a priority, a tag
 * and a project. Everything is read from the text itself; nothing is guessed from the words around it.
 *
 *   !high !medium !low (also !h !m !l, !tinggi !sedang !rendah)    priority
 *   #tag                                                           tag (several allowed)
 *   @CML or @"Cloudera Manager"                                    project or area, found by its name
 *   today hari ini  tomorrow besok  lusa  mon..sun  senin..minggu  due date (the next such weekday)
 *   +3d +2w  2026-11-05                                            due date
 *
 * A backslash in front of a word keeps it as plain text: "Rapat \besok" stays "Rapat besok".
 * Only the first date word counts. A word that looks like a marker but matches nothing (an unknown @project)
 * stays in the title and is reported in `unmatched`, so nothing is silently lost.
 */

export interface CaptureTarget {
  id: number
  title: string
  type: 'project' | 'area'
}

export interface ParsedCapture {
  /** The line as typed (bullets removed), so a line that failed can be put back in the box */
  source: string
  title: string
  due_date: string | null
  priority: TaskPriority | null
  tags: string[]
  target: CaptureTarget | null
  /** Markers that were left in the title because they matched nothing, e.g. "@Nope" */
  unmatched: string[]
}

const PRIORITIES: Record<string, TaskPriority> = {
  high: 'high', h: 'high', tinggi: 'high',
  medium: 'medium', m: 'medium', sedang: 'medium',
  low: 'low', l: 'low', rendah: 'low',
}

/** getDay() numbers: 0 = Sunday */
const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0, minggu: 0, ahad: 0,
  mon: 1, monday: 1, senin: 1,
  tue: 2, tues: 2, tuesday: 2, selasa: 2,
  wed: 3, wednesday: 3, rabu: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, kamis: 4,
  fri: 5, friday: 5, jumat: 5, "jum'at": 5,
  sat: 6, saturday: 6, sabtu: 6,
}

const MAX_TAGS = 20
const MAX_TAG_LENGTH = 50
const TITLE_MAX = 200

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

/** The date a bare date word stands for, or null when the word is not a date. Weekdays mean the next one after today. */
export function parseDateWord(word: string, today: string): string | null {
  const w = word.toLowerCase()
  const base = parseISO(today)
  if (w === 'today' || w === 'hariini' || w === 'hr.ini') return today
  if (w === 'tomorrow' || w === 'tmrw' || w === 'besok') return iso(addDays(base, 1))
  if (w === 'lusa') return iso(addDays(base, 2))
  const day = WEEKDAYS[w]
  if (day !== undefined) return iso(addDays(base, ((day - base.getDay() + 6) % 7) + 1))
  const relative = /^\+(\d{1,3})([dw])$/.exec(w)
  if (relative) return iso(addDays(base, Number(relative[1]) * (relative[2] === 'w' ? 7 : 1)))
  const absolute = /^(\d{4})-(\d{2})-(\d{2})$/.exec(w)
  if (absolute) {
    const d = parseISO(w)
    return Number.isNaN(d.getTime()) || iso(d) !== w ? null : w
  }
  return null
}

/** The project or area a name stands for: an exact title, else a whole word of exactly one title, else a substring of exactly one. */
export function findTarget(name: string, targets: CaptureTarget[]): CaptureTarget | null {
  const n = name.trim().toLowerCase()
  if (!n) return null
  const exact = targets.filter((t) => t.title.toLowerCase() === n)
  if (exact.length === 1) return exact[0]
  const words = (t: CaptureTarget) => t.title.toLowerCase().split(/[^\p{L}\p{N}]+/u)
  const wholeWord = targets.filter((t) => words(t).includes(n))
  if (wholeWord.length === 1) return wholeWord[0]
  if (wholeWord.length > 1) return null
  const partial = targets.filter((t) => t.title.toLowerCase().includes(n))
  return partial.length === 1 ? partial[0] : null
}

/** Split into tokens, keeping "@\"quoted name\"" together. */
function tokenize(line: string): string[] {
  return line.match(/@"[^"]*"|\S+/g) ?? []
}

export function parseCapture(line: string, targets: CaptureTarget[], today: string): ParsedCapture {
  const result: ParsedCapture = { source: line.trim(), title: '', due_date: null, priority: null, tags: [], target: null, unmatched: [] }
  const kept: string[] = []

  // "hari ini" is two words
  const tokens = tokenize(line.replace(/\bhari ini\b/gi, 'hariini'))

  for (const token of tokens) {
    if (token.startsWith('\\') && token.length > 1) {
      kept.push(token.slice(1))
      continue
    }
    if (token.startsWith('!') && token.length > 1) {
      const priority = PRIORITIES[token.slice(1).toLowerCase()]
      if (priority && result.priority === null) {
        result.priority = priority
        continue
      }
    } else if (token.startsWith('#') && token.length > 1) {
      const tag = token.slice(1).replace(/[.,;:!?]+$/, '').toLowerCase()
      if (tag && tag.length <= MAX_TAG_LENGTH && result.tags.length < MAX_TAGS) {
        if (!result.tags.includes(tag)) result.tags.push(tag)
        continue
      }
    } else if (token.startsWith('@') && token.length > 1) {
      const name = token.startsWith('@"') ? token.slice(2, -1) : token.slice(1).replace(/[.,;:!?]+$/, '')
      const found = result.target === null ? findTarget(name, targets) : null
      if (found) {
        result.target = found
        continue
      }
      if (result.target === null) result.unmatched.push(token)
    } else if (result.due_date === null) {
      const date = parseDateWord(token.replace(/[.,;:!?]+$/, ''), today)
      if (date) {
        result.due_date = date
        continue
      }
    }
    kept.push(token)
  }

  const title = kept.join(' ').trim()
  result.title = (title || line.trim()).slice(0, TITLE_MAX)
  if (!title) {
    // Only markers were typed: keep the text as the title rather than create a task without one
    result.due_date = null
    result.priority = null
    result.tags = []
    result.target = null
    result.unmatched = []
  }
  return result
}

/** Lines of a pasted block: bullets, numbers and checkboxes at the start are dropped, blank lines are ignored. */
export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*+•]\s+|\d+[.)]\s+|\[[ xX]?\]\s+)+/, '').trim())
    .filter((line) => line.length > 0)
}

export function parseCaptureText(text: string, targets: CaptureTarget[], today: string): ParsedCapture[] {
  return splitLines(text).map((line) => parseCapture(line, targets, today))
}
