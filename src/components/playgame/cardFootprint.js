// Computes the extra horizontal space (in units of card width) that a set of
// cards occupies beyond each card's base width, due to the attachment offsets
// and exhausted-rotation margins applied in CardObject.
//   - Each attachment offsets the card to the right by 0.35 * cardWidth.
//   - An exhausted card adds 0.2 * cardWidth on both sides (0.4 total).
// The returned value is a sum of per-card extra fractions; the shrink-to-fit
// hooks add it to the card count to size cards so they actually fit before
// flex-wrap rolls them to the next row.
import { isCardFaceDown } from './gameUtils';
export function extraSpaceUnits(cards, entries) {
  let sum = 0;
  for (const card of cards || []) {
    const entry = entries?.[card.entry_id];
    const showBack = !entry || isCardFaceDown(card, entries);
    const attCount = card.attachments?.length > 0 && !showBack ? card.attachments.length : 0;
    sum += attCount * 0.35 + (card.exhausted ? 0.4 : 0);
  }
  return sum;
}