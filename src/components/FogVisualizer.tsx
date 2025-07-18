'use client';

import {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useState,
} from 'react';

type Shape = {
  x: number;
  y: number;
  radius: number;
  color: string;
};

export type FogVisualizerHandle = {
  addBody: () => void;
};

const FogVisualizer = forwardRef<FogVisualizerHandle, {}>((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);

  const createShape = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const radius = Math.random() * 20 + 20;
    const x = Math.random() * (canvas.width - radius * 2) + radius;
    const y = Math.random() * (canvas.height - radius * 2) + radius;

    const colors = ['#fc79bc', '#fcec79', '#fafafa'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    return { x, y, radius, color: randomColor };
  };

  useImperativeHandle(ref, () => ({
    addBody: () => {
      const newShape = createShape();
      if (newShape) {
        setShapes((prevShapes) => [...prevShapes, newShape]);
      }
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        
        const context = canvas.getContext('2d');
        if (!context) return;
        
        context.clearRect(0, 0, canvas.width, canvas.height);
        shapes.forEach((shape) => {
            context.fillStyle = shape.color;
            context.beginPath();
            context.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
            context.fill();
        });
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [shapes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    shapes.forEach((shape) => {
        context.beginPath();
        context.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
        context.fillStyle = shape.color;
        context.fill();
    });

  }, [shapes]);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0" />;
});

FogVisualizer.displayName = 'FogVisualizer';
export default FogVisualizer;
