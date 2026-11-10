/** Leitner-box spaced repetition: right answers move a card up a box, wrong ones send it back to box 1. */

export interface Card {
  box: number;
  due: number;
  seen: number;
  correct: number;
}

const MIN = 60_000;
const DAY = 86_400_000;
/** Wait before a card in each box is due again. Box 0 = never seen. */
export const INTERVALS_MS = [0, 1 * MIN, 10 * MIN, 1 * DAY, 3 * DAY, 7 * DAY] as const;
export const MAX_BOX = INTERVALS_MS.length - 1;
/** A word counts as learned ("risen") from this box up. */
export const LEARNED_BOX = 3;

export const newCard = (): Card => ({ box: 0, due: 0, seen: 0, correct: 0 });

export function review(card: Card, correct: boolean, now: number): Card {
  const box = correct ? Math.min(MAX_BOX, card.box + 1) : 1;
  return { box, due: now + (INTERVALS_MS[box] as number), seen: card.seen + 1, correct: card.correct + (correct ? 1 : 0) };
}

export const isLearned = (card: Card | undefined): boolean => (card?.box ?? 0) >= LEARNED_BOX;

/**
 * Next word to practice: the most overdue review, else the next new word,
 * else the review due soonest so a session never runs dry. Avoids showing
 * `avoid` twice in a row when there's any other choice.
 */
export function pickNext(ids: readonly string[], cards: Readonly<Record<string, Card>>, now: number, avoid?: string): string | null {
  const pool = ids.length > 1 && avoid !== undefined ? ids.filter((id) => id !== avoid) : ids;
  if (pool.length === 0) return null;
  let due: string | null = null;
  let dueAt = Infinity;
  let fresh: string | null = null;
  let soonest: string | null = null;
  let soonestAt = Infinity;
  for (const id of pool) {
    const c = cards[id];
    if (!c || c.box === 0) {
      fresh ??= id;
      continue;
    }
    if (c.due <= now && c.due < dueAt) {
      due = id;
      dueAt = c.due;
    }
    if (c.due < soonestAt) {
      soonest = id;
      soonestAt = c.due;
    }
  }
  return due ?? fresh ?? soonest;
}

export function learnedCount(ids: readonly string[], cards: Readonly<Record<string, Card>>): number {
  return ids.filter((id) => isLearned(cards[id])).length;
}
