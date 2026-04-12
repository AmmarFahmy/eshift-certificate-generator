'use client';

import { useEffect, useRef, useCallback } from 'react';

export interface CertificateSettings {
  templateUrl: string;
  name: string;
  nameX: number;      // 0–100 (% of canvas width)
  nameY: number;      // 0–100 (% of canvas height)
  fontSize: number;   // px at native resolution
  color: string;      // CSS color string
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  shadow: boolean;
}

interface CertificateCanvasProps extends CertificateSettings {
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  onError?: (msg: string) => void;
  className?: string;
}

export default function CertificateCanvas({
  templateUrl,
  name,
  nameX,
  nameY,
  fontSize,
  color,
  fontFamily,
  bold,
  italic,
  shadow,
  onCanvasReady,
  onError,
  className = '',
}: CertificateCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !templateUrl) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cancelled = false;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onerror = () => {
      if (!cancelled) onError?.('Failed to load template image. Check the URL or try the proxy option.');
    };

    img.onload = async () => {
      if (cancelled) return;
      // Ensure web fonts are ready before drawing
      await document.fonts.ready;
      if (cancelled) return;

      canvas.width = img.width;
      canvas.height = img.height;

      // Draw background template
      ctx.drawImage(img, 0, 0);

      // Build font string
      const fontStyle = [
        italic ? 'italic' : '',
        bold ? 'bold' : '',
        `${fontSize}px`,
        `"${fontFamily}", serif`,
      ]
        .filter(Boolean)
        .join(' ');

      ctx.font = fontStyle;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const posX = (canvas.width * nameX) / 100;
      const posY = (canvas.height * nameY) / 100;
      const maxWidth = canvas.width * 0.8;

      // Optional text shadow for readability
      if (shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = Math.max(4, fontSize * 0.08);
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }

      ctx.fillStyle = color;
      ctx.fillText(name, posX, posY, maxWidth);

      onCanvasReady?.(canvas);
    };

    // Use proxy for external URLs to avoid canvas taint issues
    if (templateUrl.startsWith('http://') || templateUrl.startsWith('https://')) {
      img.src = `/api/proxy-image?url=${encodeURIComponent(templateUrl)}`;
    } else {
      img.src = templateUrl;
    }

    return () => { cancelled = true; };
  }, [templateUrl, name, nameX, nameY, fontSize, color, fontFamily, bold, italic, shadow, onCanvasReady, onError]);

  useEffect(() => {
    return draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={`max-w-full h-auto rounded-lg ${className}`}
      style={{ display: templateUrl ? 'block' : 'none' }}
    />
  );
}
