// Canvas renderer for the 7 Wonders template.
// Layers: white background -> main artwork (bottom 4/5, behind EVERYTHING)
// -> cost banner (on top of artwork, behind base, shifts with icon count)
// -> base image -> cost icons (inset white border — circular or octagonal; the
// coin is larger with a white circle behind it + a DIN 1451 value) -> ability
// icons row (under the title, no border, with optional value + corner modifiers)
// -> title (Poiret One). The same draw function is used for preview and export.

import { loadImage, getCachedImage } from './domCardCanvasRenderer';

const POIRET = '"Poiret One", sans-serif';
const DIN = "'Alte DIN 1451 Mittelschrift gepraegt', 'DIN 1451', sans-serif";
const REF_H = 709;

const GREEN_BANNER_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/0e4d67779c_07b28f54f_GreenBanner.png';
const COIN_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/a51bc3998c_1e86e7293_Coin2.png';
const WREATH_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/27629e376a_9a6f793ed_VPWreath2.png';
const NEIGHBOR_ARROW_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/aaa380d969_bce818720_NeighborArrow.png';
const DOTTED_ARROW_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/bf004cd53e_b90f6424b_Dottedline.png';
const SLASH_URL = 'https://bybyprzulswlemzhloqu.supabase.co/storage/v1/object/public/uploads/app-assets/500f7f06bd_279dcbe8e_Slash.png';

// Cost icon sizes (fraction of card width). The coin is a little larger.
const COST_ICON_SIZE = 0.115;
const ICON_BORDER_W = 0.07;
// The coin's outer white circle is a little larger than the other cost icons.
const COIN_SCALE = 1.08;
// Thin white ring around the coin.
const COIN_RING = 0.004;

// Cost banner vertical offset, in percentages of the card.
const BANNER_Y_BASE = -19;
const BANNER_STEP = 9;

// Cost icon positions, in percentages of the card.
const ICON_X = 5;
const ICON_Y_BASE = 29;
const ICON_STEP = 9;

// Ability icons row (under the title): y as fraction of h, size as fraction of
// w. Icons are NOT resized when multiple are present.
const ABILITY_ICON = { y: 0.085, size: 0.24 };
const ABILITY_GAP = 0.12;
const MODIFIER_SIZE = 0.56;
// Value sizes (fraction of the icon they sit on).
const ABILITY_VALUE = 0.7;
const MODIFIER_VALUE = 0.65;
// Modifiers straddle the bottom edge of the ability icon (~2/3 above, × modSize).
const MODIFIER_Y = 0.2;

// Main artwork — bottom 4/5 of the card, full width (cover-cropped).
const ART = { x: 0, y: 0.2, w: 1.0, h: 0.8 };
// Title textbox, in percentages of the card.
const TITLE = { x: 0.20, y: 0.006, w: 0.61, h: 0.08 };

export async function preloadSevenWondersImages(data) {
  const urls = [];
  if (data?.baseImageUrl) urls.push(data.baseImageUrl);
  if (data?.artUrl) urls.push(data.artUrl);
  const costIconList = data?.costIcons || [];
  if (costIconList.length > 0) urls.push(data?.bannerImageUrl || GREEN_BANNER_URL);
  for (let i = 0; i < costIconList.length; i++) {
    if (costIconList[i] && costIconList[i].url) urls.push(costIconList[i].url);
  }
  const arr = data?.abilityIcons || [];
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]?.url) urls.push(arr[i].url);
    if (arr[i]?.coinModifier) urls.push(COIN_URL);
    if (arr[i]?.vpModifier) urls.push(WREATH_URL);
    if (arr[i]?.neighborArrow) urls.push(NEIGHBOR_ARROW_URL);
    if (arr[i]?.played) urls.push(DOTTED_ARROW_URL);
  }
  if (data?.activatedSlash && arr.length > 1) urls.push(SLASH_URL);
  await Promise.all(urls.map(loadImage));
}

function drawImageCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale, dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

// Draws an image centered at (cx, cy) within a box, preserving aspect ratio
// (contain). Optionally mirrored horizontally (for arrows pointing right).
function drawImageContain(ctx, img, cx, cy, boxW, boxH, flip = false) {
  if (!img) return;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  let dw = boxW, dh = boxH;
  if (iw && ih) {
    const ar = iw / ih;
    if (ar > boxW / boxH) { dh = boxW / ar; } else { dw = boxH * ar; }
  }
  const x = cx - dw / 2;
  const y = cy - dh / 2;
  if (flip) {
    ctx.save();
    ctx.translate(x + dw, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, dw, dh);
    ctx.restore();
  } else {
    ctx.drawImage(img, x, y, dw, dh);
  }
}

function octagonPath(ctx, x, y, S) {
  const a = S * 0.2929;
  ctx.beginPath();
  ctx.moveTo(x + a, y);
  ctx.lineTo(x + S - a, y);
  ctx.lineTo(x + S, y + a);
  ctx.lineTo(x + S, y + S - a);
  ctx.lineTo(x + S - a, y + S);
  ctx.lineTo(x + a, y + S);
  ctx.lineTo(x, y + S - a);
  ctx.lineTo(x, y + a);
  ctx.closePath();
}

// Draws a value (number or letter) in DIN 1451: a thin border + a faux-bold
// (thicker) glyph. style 'black' = black fill + white border; 'white' = white
// fill + black border.
function drawValue(ctx, value, cx, cy, numSize, style, thin = false) {
  if (value == null || value === '') return;
  const numStr = String(value);
  const borderColor = style === 'white' ? '#000000' : '#ffffff';
  const fillColor = style === 'white' ? '#ffffff' : '#1A1A1A';
  // Naval (white) numbers: a thinner glyph with a thicker black border.
  const borderW = style === 'white' ? numSize * 0.12 : numSize * 0.09;
  const fauxW = thin ? numSize * 0.02 : (style === 'white' ? numSize * 0.025 : numSize * 0.05);
  ctx.save();
  ctx.font = `${numSize}px ${DIN}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  // Border.
  ctx.lineWidth = borderW;
  ctx.strokeStyle = borderColor;
  ctx.strokeText(numStr, cx, cy);
  // Faux-bold: thicken the glyph with the fill color.
  ctx.lineWidth = fauxW;
  ctx.strokeStyle = fillColor;
  ctx.strokeText(numStr, cx, cy);
  // Fill.
  ctx.fillStyle = fillColor;
  ctx.fillText(numStr, cx, cy);
  ctx.restore();
}

function drawModifier(ctx, url, cx, cy, size, value, style) {
  const img = getCachedImage(url);
  const x = cx - size / 2;
  const y = cy - size / 2;
  if (img) ctx.drawImage(img, x, y, size, size);
  drawValue(ctx, value, cx, cy, size * MODIFIER_VALUE, style);
}

function drawSingleAbilityIcon(ctx, ability, ax, ay, asz) {
  // Shrink the ability icon slightly when modifiers are present so everything fits.
  const hasMod = !!(ability.coinModifier || ability.vpModifier || ability.neighborArrow || ability.played);
  const size = hasMod ? asz * 0.88 : asz;
  const ox = ax + (asz - size) / 2;
  const oy = ay + (asz - size) / 2;
  const acx = ox + size / 2;
  const acy = oy + size / 2;
  const img = getCachedImage(ability.url);
  if (img) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (iw && ih) {
      const ar = iw / ih;
      const dw = ar >= 1 ? size : size * ar;
      const dh = ar >= 1 ? size / ar : size;
      ctx.drawImage(img, ox + (size - dw) / 2, oy + (size - dh) / 2, dw, dh);
    } else {
      ctx.drawImage(img, ox, oy, size, size);
    }
  }
  if (ability.value) drawValue(ctx, ability.value, acx, acy, size * ABILITY_VALUE, ability.valueStyle, true);
  const modSize = size * MODIFIER_SIZE;
  const modCy = oy + size - modSize * MODIFIER_Y;
  if (ability.coinModifier) {
    drawModifier(ctx, COIN_URL, ox + modSize * 0.25, modCy, modSize, ability.coinModifier.value, 'black');
  }
  if (ability.vpModifier) {
    drawModifier(ctx, WREATH_URL, ox + size - modSize * 0.25, modCy, modSize, ability.vpModifier.value, 'black');
  }
  // Neighbor arrow: sits just outside the left/right edge of the icon.
  const arrowBox = size * 0.62;
  if (ability.neighborArrow === 'left' || ability.neighborArrow === 'both') {
    drawImageContain(ctx, getCachedImage(NEIGHBOR_ARROW_URL), ox - arrowBox * 0.5, acy, arrowBox, arrowBox, false);
  }
  if (ability.neighborArrow === 'right' || ability.neighborArrow === 'both') {
    drawImageContain(ctx, getCachedImage(NEIGHBOR_ARROW_URL), ox + size + arrowBox * 0.5, acy, arrowBox, arrowBox, true);
  }
  // Played (dotted arrow): points left-to-right, tip touching the left side
  // ~3/4 up; body extends to the left of the icon.
  if (ability.played) {
    const pImg = getCachedImage(DOTTED_ARROW_URL);
    if (pImg) {
      const iw = pImg.naturalWidth || pImg.width;
      const ih = pImg.naturalHeight || pImg.height;
      const ph = size * 0.26;
      const pw = iw && ih ? ph * (iw / ih) : ph * 2;
      const tipY = oy + size * 0.25;
      ctx.drawImage(pImg, ox - pw + size * 0.08, tipY - ph / 2, pw, ph);
    }
  }
}

function drawAbilityIcons(ctx, abilityIcons, w, h, activatedSlash) {
  const arr = abilityIcons || [];
  if (arr.length === 0) return;
  const asz = ABILITY_ICON.size * w;
  // Widen the gap when slashes are active so the larger slashes fit between icons.
  const gap = asz * (activatedSlash && arr.length > 1 ? 0.48 : ABILITY_GAP);
  const totalW = arr.length * asz + (arr.length - 1) * gap;
  const startX = (w - totalW) / 2;
  const ay = ABILITY_ICON.y * h;
  for (let i = 0; i < arr.length; i++) {
    if (!arr[i] || !arr[i].url) continue;
    drawSingleAbilityIcon(ctx, arr[i], startX + i * (asz + gap), ay, asz);
  }
  // Activated slash: a slash between each pair of adjacent ability icons
  // (icon > slash > icon > slash > icon ...), sized to fit within the gap.
  if (activatedSlash && arr.length > 1) {
    const sImg = getCachedImage(SLASH_URL);
    if (sImg) {
      const iw = sImg.naturalWidth || sImg.width;
      const ih = sImg.naturalHeight || sImg.height;
      const ar = iw && ih ? iw / ih : 0.4;
      let sh = asz * 1.2;
      let sw = sh * ar;
      const maxSw = gap * 0.95;
      if (sw > maxSw) { sw = maxSw; sh = ar ? sw / ar : maxSw; }
      const sCy = ay + asz / 2;
      for (let i = 0; i < arr.length - 1; i++) {
        if (!arr[i]?.url || !arr[i + 1]?.url) continue;
        const right = startX + i * (asz + gap) + asz;
        const left = startX + (i + 1) * (asz + gap);
        const sCx = (right + left) / 2;
        ctx.drawImage(sImg, sCx - sw / 2, sCy - sh / 2, sw, sh);
      }
    }
  }
}

export function drawSevenWondersCard(ctx, data, w, h) {
  const { baseImageUrl = '', artUrl = '', title = '', bannerImageUrl = '', costIcons = [], abilityIcons = [], activatedSlash = false } = data || {};
  const numIcons = costIcons.length;

  // 1. White background.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // 2. Main artwork — bottom 4/5, behind EVERYTHING else (cover-crop).
  if (artUrl) {
    const img = getCachedImage(artUrl);
    if (img) drawImageCover(ctx, img, ART.x * w, ART.y * h, ART.w * w, ART.h * h);
  }

  // 3. Cost banner — on top of the artwork, behind the base, shifts with count.
  if (numIcons > 0) {
    const bannerImg = getCachedImage(bannerImageUrl || GREEN_BANNER_URL);
    if (bannerImg) {
      const bY = ((BANNER_Y_BASE + BANNER_STEP * (numIcons - 1)) / 100) * h;
      ctx.drawImage(bannerImg, 0, bY, w, h);
    }
  }

  // 4. Base image — fills the card 1:1.
  if (baseImageUrl) {
    const img = getCachedImage(baseImageUrl);
    if (img) ctx.drawImage(img, 0, 0, w, h);
  }

  // 5. Cost icons. The coin (has a `value`) is larger, with a white circle
  //    behind it + a DIN 1451 value (nudged up). Other icons get an inset
  //    white border — octagonal for octagon-shaped icons, circular otherwise.
  const iconSize = COST_ICON_SIZE * w;
  for (let i = 0; i < numIcons; i++) {
    const ic = costIcons[i];
    if (!ic || !ic.url) continue;
    const ix = (ICON_X / 100) * w;
    const iy = ((ICON_Y_BASE + ICON_STEP * i) / 100) * h;
    const cx = ix + iconSize / 2;
    const cy = iy + iconSize / 2;
    const bw = ICON_BORDER_W * iconSize;

    if (ic.value != null && ic.value !== '') {
      // Coin: a larger white circle with the coin image inside (thin ring).
      const coinOuter = iconSize * COIN_SCALE;
      const coinImg = coinOuter - 2 * coinOuter * COIN_RING;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.28)';
      ctx.shadowBlur = iconSize * 0.35;
      ctx.shadowOffsetY = iconSize * 0.14;
      ctx.beginPath();
      ctx.arc(cx, cy, coinOuter / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
      const img = getCachedImage(ic.url);
      if (img) ctx.drawImage(img, cx - coinImg / 2, cy - coinImg / 2, coinImg, coinImg);
      drawValue(ctx, ic.value, cx, cy, coinImg * 0.62, 'black');
    } else {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.22)';
      ctx.shadowBlur = iconSize * 0.3;
      ctx.shadowOffsetY = iconSize * 0.12;
      const img = getCachedImage(ic.url);
      if (img) ctx.drawImage(img, ix, iy, iconSize, iconSize);
      ctx.restore();
      if (ic.shape === 'octagon') {
        octagonPath(ctx, ix + bw / 2, iy + bw / 2, iconSize - bw);
        ctx.lineWidth = bw;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(cx, cy, iconSize / 2 - bw / 2, 0, Math.PI * 2);
        ctx.lineWidth = bw;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
    }
  }

  // 6. Ability icons row (under the title).
  drawAbilityIcons(ctx, abilityIcons, w, h, activatedSlash);

  // 7. Title — Poiret One, near the top.
  if (title) {
    const tx = TITLE.x * w, ty = TITLE.y * h, tw = TITLE.w * w, th = TITLE.h * h;
    const fontSize = 22 * (h / REF_H);
    const cx = tx + tw / 2, cy = ty + th / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(tx, ty, tw, th);
    ctx.clip();
    ctx.font = `bold ${fontSize}px ${POIRET}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.letterSpacing = '1px';
    ctx.lineWidth = Math.max(0.3, fontSize * 0.006);
    ctx.strokeStyle = '#000000';
    ctx.strokeText(title, cx, cy);
    ctx.fillStyle = '#000000';
    ctx.fillText(title, cx, cy);
    ctx.restore();
  }
}

export async function renderSevenWondersToCanvas(data, scale = 2) {
  await document.fonts.ready;
  try { await document.fonts.load('22px "Poiret One"'); } catch {}
  try { await document.fonts.load('14px "Alte DIN 1451 Mittelschrift gepraegt"'); } catch {}
  await preloadSevenWondersImages(data);

  const w = data?.cardWidth || 461, h = data?.cardHeight || 709;
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  drawSevenWondersCard(ctx, data, w, h);
  return canvas;
}