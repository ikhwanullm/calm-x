export interface RelativeDateProps {
  date: string // YYYY-MM-DD
}

/** Stub — replaced by full implementation in task 1.4. */
export function RelativeDate({ date }: RelativeDateProps) {
  return (
    <time dateTime={date} title={date} className="underline decoration-dotted">
      {date}
    </time>
  )
}
