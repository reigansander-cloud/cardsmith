import React, { useRef, useEffect } from 'react';
import { drawSevenWondersCard, preloadSevenWondersImages } from '@/lib/sevenWondersRenderer';

export default function SevenWondersCanvas({ data }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    const render = async () => {
      await document.fonts.ready;
      try { await document.fonts.load('28px "Poiret One"'); } catch {}
      try { await document.fonts.load('14px "Alte DIN 1451 Mittelschrift gepraegt"'); } catch {}
      await preloadSevenWondersImages(data);
      if (cancelled) return;

      const w = data?.cardWidth || 461, h = data?.cardHeight || 709;
      const dpr = window.devicePixelRatio || 1;
      const maxDisplayW = 400;
      const displayW = Math.min(w, maxDisplayW);
      const displayH = Math.round(displayW * (h / w));

      canvas.width = displayW * dpr;
      canvas.height = displayH * dpr;
      canvas.style.width = `${displayW}px`;
      canvas.style.height = `${displayH}px`;

      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      drawSevenWondersCard(ctx, data, displayW, displayH);
    };

    render();
    return () => { cancelled = true; };
  }, [data]);

  return <canvas ref={canvasRef} className="rounded-lg shadow-xl" />;
}