// Lightweight natural-language intent parser.
// "I have a flight at 5 with flight AA 2485. I am at Dallas."
//  -> { location: 'Dallas', leaveBy: '5:00 PM', flight: 'AA2485', deadline: 'flight' }

export type ParsedIntent = {
  location?: string
  leaveBy?: string
  flight?: string
  interests: string[]
  deadline?: 'flight' | 'meeting' | 'dinner' | 'custom'
}

const INTEREST_KEYWORDS: Array<[string, RegExp]> = [
  ['Views', /\b(beach|coast|ocean|sunset|view|viewpoint|scenic|photo|skyline|overlook)\b/i],
  ['Food', /\b(food|eat|dinner|lunch|seafood|restaurant|cocktail|coffee|brunch|foodie)\b/i],
  ['History', /\b(history|historic|museum|culture|cultural|art|gallery|monument|landmark)\b/i],
  ['Family', /\b(kid|kids|family|children|zoo|aquarium|theme park)\b/i],
  ['Quiet spots', /\b(quiet|calm|relax|relaxing|peaceful|garden|park|nature)\b/i],
]

export function parseIntent(text: string): ParsedIntent {
  const interests = INTEREST_KEYWORDS.filter(([, re]) => re.test(text)).map(([label]) => label)

  // Flight number: "flight AA 2485" or a bare "AA2485".
  let flight: string | undefined
  const flightMatch =
    text.match(/flight\s+([A-Za-z]{2,3})\s?(\d{2,4})/i) || text.match(/\b([A-Z]{2})\s?(\d{2,4})\b/)
  if (flightMatch) flight = `${flightMatch[1].toUpperCase()}${flightMatch[2]}`

  // Time: "at 5", "back by 7", "before 5:30 pm".
  let leaveBy: string | undefined
  const timeMatch = text.match(/\b(?:at|by|before|back by|leave by|until)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i)
  if (timeMatch) {
    let hour = Number(timeMatch[1])
    const min = timeMatch[2] ? Number(timeMatch[2]) : 0
    let mer = timeMatch[3]?.toUpperCase()
    if (!mer) mer = hour >= 1 && hour <= 11 ? 'PM' : 'AM' // deadlines skew afternoon/evening
    if (hour === 0) hour = 12
    leaveBy = `${hour}:${String(min).padStart(2, '0')} ${mer}`
  }

  // Location: "I am at/in Dallas", "in Miami", "near Torrey Pines" — letters only, not the time number.
  let location: string | undefined
  const locMatch = text.match(
    /(?:i(?:'m| am)?\s+(?:at|in|near|around)|(?:^|[.,]\s*|\s)(?:at|in|near|around|to|visiting|explore))\s+([A-Za-z][A-Za-z .'-]{1,40}?)(?=\s+(?:at|with|by|before|after|and|for|i\b|on|later|today|tomorrow)|[.,!?]|$)/i,
  )
  if (locMatch) {
    const candidate = locMatch[1].trim().replace(/\s+/g, ' ')
    if (candidate.length > 1 && !/^\d/.test(candidate)) location = candidate
  }

  let deadline: ParsedIntent['deadline']
  if (flight) deadline = 'flight'
  else if (/\bmeeting\b/i.test(text)) deadline = 'meeting'
  else if (/\b(dinner|reservation)\b/i.test(text)) deadline = 'dinner'
  else if (leaveBy) deadline = 'custom'

  return { location, leaveBy, flight, interests, deadline }
}
