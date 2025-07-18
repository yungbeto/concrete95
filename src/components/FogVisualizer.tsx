'use client';

import {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useState,
} from 'react';

export type Shape = {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
};

export type FogVisualizerHandle = {
  addBody: (id: string) => Shape | null;
  removeBody: (id: string) => void;
};

interface FogVisualizerProps {
  onShapeClick: (id: string) => void;
}

const FogVisualizer = forwardRef<FogVisualizerHandle, FogVisualizerProps>(
  ({ onShapeClick }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [shapes, setShapes] = useState<Shape[]>([]);

    const createShape = (id: string) => {
      if (!canvasRef.current) return null;
      const canvas = canvasRef.current;
      const radius = Math.random() * 20 + 20;
      const x = Math.random() * (canvas.width - radius * 2) + radius;
      const y = Math.random() * (canvas.height - radius * 2) + radius;

      const colors = ['#fc79bc', '#fcec79', '#fafafa'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const newShape = { id, x, y, radius, color: randomColor };
      return newShape;
    };

    useImperativeHandle(ref, () => ({
      addBody: (id: string) => {
        const newShape = createShape(id);
        if (newShape) {
          setShapes((prevShapes) => [...prevShapes, newShape]);
        }
        return newShape;
      },
      removeBody: (id: string) => {
        setShapes((prevShapes) =>
          prevShapes.filter((shape) => shape.id !== id)
        );
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const handleClick = (event: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Find the topmost shape that was clicked
        const clickedShape = [...shapes]
          .reverse()
          .find((shape) => {
            const distance = Math.sqrt(
              Math.pow(x - shape.x, 2) + Math.pow(y - shape.y, 2)
            );
            return distance < shape.radius;
          });

        if (clickedShape) {
          onShapeClick(clickedShape.id);
        }
      };

      canvas.addEventListener('click', handleClick);
      return () => {
        canvas.removeEventListener('click', handleClick);
      };
    }, [shapes, onShapeClick]);

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

    return <canvas ref={canvasRef} className="absolute inset-0 z-0" />;
  }
);

FogVisualizer.displayName = 'FogVisualizer';
export default FogVisualizer;