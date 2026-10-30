import { describe, it, expect } from 'vitest'
import { findTarget, parseCapture, parseCaptureText, parseDateWord, splitLines } from '../utils/capture'
import type { CaptureTarget } from '../utils/capture'

const TODAY = '2026-10-29' // Thursday

const TARGETS: CaptureTarget[] = [
  { id: 1, title: 'Migrasi Runtime Cloudera Machine Learning (CML)', type: 'project' },
  { id: 2, title: 'Migrasi Cloudera Data Science Workbench (CDSW)', type: 'project' },
  { id: 3, title: 'Upgrade Cloudera Manager', type: 'project' },
  { id: 4, title: 'Family', type: 'area' },
  { id: 5, title: 'Family Budget', type: 'project' },
]

const parse = (line: string) => parseCapture(line, TARGETS, TODAY)

describe('parseDateWord', () => {
  it('today, tomorrow and lusa in English and Indonesian', () => {
    expect(parseDateWord('today', TODAY)).toBe('2026-10-29')
    expect(parseDateWord('hariini', TODAY)).toBe('2026-10-29')
    expect(parseDateWord('tomorrow', TODAY)).toBe('2026-10-30')
    expect(parseDateWord('BESOK', TODAY)).toBe('2026-10-30')
    expect(parseDateWord('lusa', TODAY)).toBe('2026-10-31')
  })

  it('a weekday is the next one after today, never today itself', () => {
    expect(parseDateWord('fri', TODAY)).toBe('2026-10-30')
    expect(parseDateWord('jumat', TODAY)).toBe('2026-10-30')
    expect(parseDateWord('thu', TODAY)).toBe('2026-11-05')   // today is Thursday
    expect(parseDateWord('senin', TODAY)).toBe('2026-11-02')
    expect(parseDateWord('minggu', TODAY)).toBe('2026-11-01')
    expect(parseDateWord('wed', TODAY)).toBe('2026-11-04')
  })

  it('+3d, +2w and ISO dates; impossible dates are not dates', () => {
    expect(parseDateWord('+3d', TODAY)).toBe('2026-11-01')
    expect(parseDateWord('+2w', TODAY)).toBe('2026-11-12')
    expect(parseDateWord('2026-12-25', TODAY)).toBe('2026-12-25')
    expect(parseDateWord('2026-02-30', TODAY)).toBeNull()
    expect(parseDateWord('vendor', TODAY)).toBeNull()
  })
})

describe('findTarget', () => {
  it('finds a project by an exact title, a whole word, or a part of the name', () => {
    expect(findTarget('Upgrade Cloudera Manager', TARGETS)?.id).toBe(3)
    expect(findTarget('cml', TARGETS)?.id).toBe(1)
    expect(findTarget('CDSW', TARGETS)?.id).toBe(2)
    expect(findTarget('workben', TARGETS)?.id).toBe(2)
  })

  it('an exact title wins over a longer one that contains it', () => {
    expect(findTarget('Family', TARGETS)?.id).toBe(4)
  })

  it('is not guessed when more than one matches, or none does', () => {
    expect(findTarget('Cloudera', TARGETS)).toBeNull()
    expect(findTarget('migrasi', TARGETS)).toBeNull()
    expect(findTarget('nothing', TARGETS)).toBeNull()
    expect(findTarget('', TARGETS)).toBeNull()
  })
})

describe('parseCapture', () => {
  it('reads priority, tag, project and a date and leaves the rest as the title', () => {
    expect(parse('Telepon vendor besok !high #work @CML')).toEqual({
      source: 'Telepon vendor besok !high #work @CML', title: 'Telepon vendor', due_date: '2026-10-30', priority: 'high', tags: ['work'],
      target: TARGETS[0], unmatched: [],
    })
  })

  it('a plain title is untouched', () => {
    expect(parse('Buy milk')).toEqual({ source: 'Buy milk', title: 'Buy milk', due_date: null, priority: null, tags: [], target: null, unmatched: [] })
  })

  it('markers can be anywhere and tags repeat once', () => {
    const r = parse('#home Fix the tap #home !l fri')
    expect(r).toMatchObject({ title: 'Fix the tap', tags: ['home'], priority: 'low', due_date: '2026-10-30' })
  })

  it('"hari ini" counts as one date word', () => {
    expect(parse('Kirim laporan hari ini')).toMatchObject({ title: 'Kirim laporan', due_date: '2026-10-29' })
  })

  it('a quoted name finds a project with spaces', () => {
    expect(parse('Check logs @"Cloudera Manager"')).toMatchObject({ title: 'Check logs', target: TARGETS[2] })
  })

  it('an unknown @project stays in the title and is reported', () => {
    expect(parse('Call @Nope tomorrow')).toMatchObject({ title: 'Call @Nope', target: null, unmatched: ['@Nope'], due_date: '2026-10-30' })
  })

  it('an ambiguous @project stays in the title too', () => {
    expect(parse('Do it @Cloudera')).toMatchObject({ title: 'Do it @Cloudera', target: null, unmatched: ['@Cloudera'] })
  })

  it('a backslash keeps a word as plain text', () => {
    expect(parse('Rapat \\besok pagi')).toMatchObject({ title: 'Rapat besok pagi', due_date: null })
    expect(parse('Use \\#hashtag')).toMatchObject({ title: 'Use #hashtag', tags: [] })
  })

  it('only the first date word and the first priority count', () => {
    expect(parse('Plan besok senin !high !low')).toMatchObject({ title: 'Plan senin !low', due_date: '2026-10-30', priority: 'high' })
  })

  it('an unknown !word is just text', () => {
    expect(parse('Ship it !urgent')).toMatchObject({ title: 'Ship it !urgent', priority: null })
  })

  it('only markers: the whole line stays as the title, nothing is applied', () => {
    expect(parse('besok !high #work')).toEqual({
      source: 'besok !high #work', title: 'besok !high #work', due_date: null, priority: null, tags: [], target: null, unmatched: [],
    })
  })

  it('tags are lower case, lose trailing punctuation and are limited to 20', () => {
    expect(parse('Do #Work, now').tags).toEqual(['work'])
    const many = Array.from({ length: 25 }, (_, i) => `#t${i}`).join(' ')
    expect(parse(`x ${many}`).tags).toHaveLength(20)
  })

  it('a long title is cut to 200 characters', () => {
    expect(parse('a'.repeat(300)).title).toHaveLength(200)
  })
})

describe('pasted text', () => {
  it('splitLines drops bullets, numbers, checkboxes and blank lines', () => {
    expect(splitLines('- one\n* two\n3. three\n[ ] four\n\n  \n• five\r\nsix')).toEqual(['one', 'two', 'three', 'four', 'five', 'six'])
  })

  it('every line becomes its own parsed task', () => {
    const got = parseCaptureText('- Email Budi besok !high\n- Book room @CML\n\nPlain', TARGETS, TODAY)
    expect(got.map((g) => g.title)).toEqual(['Email Budi', 'Book room', 'Plain'])
    expect(got[0]).toMatchObject({ due_date: '2026-10-30', priority: 'high' })
    expect(got[1].target?.id).toBe(1)
  })
})
