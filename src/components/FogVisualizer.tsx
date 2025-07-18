
'use client';

import { useEffect, useRef } from 'react';
import type { Shape } from '@/lib/types';

interface Layer {
  id: string;
  shape: Shape;
}

interface FogVisualizerProps {
  layers: Layer[];
  onShapeClick: (id: string) => void;
  onReady: (size: { width: number; height: number }) => void;
}

const FogVisualizer = ({ layers, onShapeClick, onReady }: FogVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layersRef = useRef(layers);
  layersRef.current = layers; // Keep a mutable ref to the latest layers for the click handler

  // Main effect for resizing and setting up the animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    let animationFrameId: number;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        const { clientWidth, clientHeight } = container;
        if (canvas.width !== clientWidth || canvas.height !== clientHeight) {
          canvas.width = clientWidth;
          canvas.height = clientHeight;
          // Report the new size back to the parent component
          onReady({ width: clientWidth, height: clientHeight });
        }
      }
    };
    
    const render = () => {
      resizeCanvas(); // Check for resize on each frame
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

    render();

    // Initial resize call
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [onReady]);

  // Effect for handling clicks
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Find the topmost clicked layer
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
};

export default FogVisualizer;
