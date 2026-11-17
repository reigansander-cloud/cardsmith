let idCounter = 0;
const genId = () => `el_${Date.now()}_${idCounter++}_${Math.random().toString(36).slice(2, 7)}`;

export function getDefaultCollected(cardWidth, cardHeight) {
  // 100 DPI: 1 inch = 100px. Shape dimensions are in card pixel units.
  const inch = (inches) => inches * 100;

  return [
    {
      id: genId(),
      name: 'Shapes',
      type: 'folder',
      elements: [
        { id: genId(), type: 'shape', x: 30, y: 30, width: inch(4.851), height: inch(3.465), shape: 'rectangle', filled: false, strokeWidth: 6, color: '#000000', name: 'Rectangle' },
        { id: genId(), type: 'shape', x: 30, y: 30, width: inch(1.0692), height: inch(1.0692), shape: 'ellipse', filled: false, strokeWidth: 6, color: '#000000', name: 'Circle' },
        { id: genId(), type: 'shape', x: 30, y: 30, width: inch(1.5972), height: inch(1.5972), shape: 'rectangle', filled: false, strokeWidth: 6, color: '#000000', name: 'Square' },
      ],
    },
    {
      id: genId(),
      name: 'Dice',
      type: 'folder',
      elements: [0, 1, 2, 3, 4, 5, 6].map(pips => ({
        id: genId(), type: 'shape', x: 30, y: 30, width: inch(0.66), height: inch(0.66),
        shape: 'rounded', filled: false, strokeWidth: 6, color: '#000000', pips,
      })),
    },
  ];
}

// Migrate legacy percentage-based (0-100) canvas data to pixel coordinates.
// Idempotent: data already tagged coordVersion === 2 is returned unchanged.
export function migrateFreeCanvasData(data) {
  if (!data || data.coordVersion === 2) return data;
  const cardW = data.cardWidth || 360;
  const cardH = data.cardHeight || 504;
  const convertEl = (el) => {
    if (!el || el.type === 'folder') return el;
    const next = { ...el };
    next.x = ((el.x ?? 0) / 100) * cardW;
    next.y = ((el.y ?? 0) / 100) * cardH;
    next.width = ((el.width ?? 0) / 100) * cardW;
    if (el.height != null) next.height = (el.height / 100) * cardH;
    return next;
  };
  const elements = (data.elements || []).map(convertEl);
  const collected = (data.collected || []).map((item) => {
    if (!item || !item.elements) return item;
    return { ...item, elements: item.elements.map(convertEl) };
  });
  return { ...data, elements, collected, coordVersion: 2 };
}