import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SummaryStep } from '../components/review/SummaryStep'

describe('SummaryStep', () => {
  it('shows a count for every kind of action, including waiting follow-ups and Someday decisions', () => {
    render(
      <SummaryStep
        actionCounts={{ organizedInbox: 1, completed: 2, updatedDueDates: 3, archived: 4, followedUp: 5, startedIdeas: 6, droppedIdeas: 7 }}
        notes=""
        onNotesChange={() => {}}
      />
    )
    const tile = (label: string) => screen.getByText(label).parentElement!.textContent
    expect(tile('Inbox tasks given a home')).toBe('1Inbox tasks given a home')
    expect(tile('Tasks completed')).toBe('2Tasks completed')
    expect(tile('Due dates updated')).toBe('3Due dates updated')
    expect(tile('Items archived')).toBe('4Items archived')
    expect(tile('Waiting tasks followed up or closed')).toBe('5Waiting tasks followed up or closed')
    expect(tile('Someday ideas started')).toBe('6Someday ideas started')
    expect(tile('Someday ideas dropped')).toBe('7Someday ideas dropped')
  })
})
