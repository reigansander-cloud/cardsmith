import React, { useRef, useEffect } from 'react';
import { drawGlimpsesCard, preloadGlimpsesImages, getGlimpsesFrameDims } from '@/lib/glimpsesCanvasRenderer';

export default function GlimpsesCanvas({ data }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    const render = async () => {
      await document.fonts.ready;
      await preloadGlimpsesImages(data);
      if (cancelled) return;

      const { w, h } = getGlimpsesFrameDims();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      // Display scaled to fit a reasonable preview width
      const maxDisplayW = 400;
      const displayW = Math.min(w, maxDisplayW);
      canvas.style.width = `${displayW}px`;
      canvas.style.height = `${Math.round(displayW * (h / w))}px`;

      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      drawGlimpsesCard(ctx, data, w, h);
    };

    render();
    return () => { cancelled = true; };
  }, [data]);

  return <canvas ref={canvasRef} className="rounded-lg shadow-xl" />;
}