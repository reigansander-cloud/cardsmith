import React, { useRef, useEffect } from 'react';
import { drawPlayingCard, preloadPlayingCardImages, loadImage } from '@/lib/playingCardCanvasRenderer';

export default function PlayingCardCanvas({ data, bgColor, bgImage }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    const render = async () => {
      await document.fonts.ready;
      await preloadPlayingCardImages(data);
      if (bgImage) await loadImage(bgImage);
      if (cancelled) return;

      const w = 360, h = 504;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      drawPlayingCard(ctx, data, w, h, bgColor, bgImage);
    };

    render();
    return () => { cancelled = true; };
  }, [data, bgColor, bgImage]);

  return <canvas ref={canvasRef} className="rounded-lg shadow-xl" />;
}