// Card evaluation for the review page. Computes a single point value for a
// CardEntry based on its cost icons, influence, stats, and keywords.
//
// Formula (per the user's spec):
//   base 9
//   + sum of point values of all cost icons
//   - influence × multiplier
//       multiplier = 3 by default
//       if the card has a Dur stat → multiplier = Dur value
//       if the ability says "Advent" → multiplier = 1 (overrides Dur)
//   - point value of each keyword appearing in the ability
//       a "?" keyword (e.g. "Armored ?") matches "Armored <n>" and its
//       subtraction is multiplied by that <n>
//   - 5 × Pws stat value

function escapeReg(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Strip ability markup tags ([b], [i], [color:..], [icon:url]) to plain text.
function stripMarkup(markup) {
  if (!markup) return '';
  return markup
    .replace(/\[icon:[^\]]*\]/g, ' ')
    .replace(/\[\/?(?:b|i|color:[^\]]*)\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function evaluateCard(entry, iconValueMap, keywordEntries) {
  if (!entry) return 0;
  let total = 9;

  // + cost icons
  for (const url of (entry.cost_icons || [])) {
    total += (iconValueMap && iconValueMap[url]) || 0;
  }

  // - influence × multiplier
  const influence = parseInt(entry.influence) || 0;
  let multiplier = 3;
  const durStat = (entry.stats || []).find((s) => s.name === 'Dur');
  if (durStat && durStat.value !== '' && durStat.value !== undefined && durStat.value !== null) {
    const durVal = parseInt(durStat.value);
    if (!isNaN(durVal)) multiplier = durVal;
  }
  const plainAbility = stripMarkup(entry.ability);
  if (/\badvent\b/i.test(plainAbility)) multiplier = 1;
  total -= influence * multiplier;

  // - keyword values (deduplicated by base word; folder overrides global)
  const keywordMap = {};
  for (const kw of (keywordEntries || [])) {
    const word = kw.word;
    if (!word) continue;
    const isPattern = /\s\?$/.test(word);
    const base = isPattern ? word.replace(/\s\?$/, '').trim() : word.trim();
    if (!base) continue;
    keywordMap[base] = { value: kw.value || 0, isPattern };
  }
  for (const [base, info] of Object.entries(keywordMap)) {
    if (!info.value) continue;
    if (info.isPattern) {
      const re = new RegExp(`\\b${escapeReg(base)}\\s+(\\d+)\\b`, 'gi');
      let match;
      while ((match = re.exec(plainAbility)) !== null) {
        total -= info.value * (parseInt(match[1]) || 1);
      }
    } else {
      const re = new RegExp(`\\b${escapeReg(base)}\\b`, 'gi');
      if (re.test(plainAbility)) total -= info.value;
    }
  }

  // - 5 × Pws
  const pwsStat = (entry.stats || []).find((s) => s.name === 'Pws' || s.name === 'PRWS' || s.name === 'Atk');
  if (pwsStat) {
    const pwsVal = parseInt(pwsStat.value) || 0;
    total -= 5 * pwsVal;
  }

  return total;
}