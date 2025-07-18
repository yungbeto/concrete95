
'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import type { Shape } from '@/lib/types';

interface Layer {
  id: string;
  shape: Shape;
}

interface FogVisualizerProps {
  layers: Layer[];
  onShapeClick: (id: string) => void;
}

type FogVisualizerHandle = {
    createShape: (id: string) => Shape | null;
};

const FogVisualizer = forwardRef<FogVisualizerHandle, FogVisualizerProps>(({ layers, onShapeClick }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layersRef = useRef(layers);
  layersRef.current = layers;

  useImperativeHandle(ref, () => ({
    createShape: (id: string): Shape | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const { width, height } = canvas.getBoundingClientRect();
        if (width === 0 || height === 0) return null;

        const radius = Math.random() * 20 + 20;
        const x = Math.random() * (width - radius * 2) + radius;
        const y = Math.random() * (height - radius * 2) + radius;
        const colors = ['#fc79bc', '#fcec79', '#fafafa'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        return { id, x, y, radius, color: randomColor };
    }
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    let animationFrameId: number;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    };

    const render = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);

      layersRef.current.forEach((layer) => {
        const { shape } = layer;
        context.beginPath();
        context.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
        context.fillStyle = shape.color;
        context.fill();
      });

      animationFrameId = window.requestAnimationFrame(render);
    };

    resizeCanvas();
    render();

    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const clickedLayer = [...layersRef.current]
        .reverse()
        .find((layer) => {
          const { shape } = layer;
          const distance = Math.sqrt(
            Math.pow(x - shape.x, 2) + Math.pow(y - shape.y, 2)
          );
          return distance < shape.radius;
        });

      if (clickedLayer) {
        onShapeClick(clickedLayer.id);
      }
    };

    canvas.addEventListener('click', handleClick);
    return () => {
      canvas.removeEventListener('click', handleClick);
    };
  }, [onShapeClick]);

  return <canvas ref={canvasRef} className="absolute inset-0 -z-10" />;
});

FogVisualizer.displayName = 'FogVisualizer';
export default FogVisualizer;
