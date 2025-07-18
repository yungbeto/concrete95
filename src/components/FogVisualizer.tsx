
'use client';

import {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useState,
} from 'react';

type Vertex = { x: number; y: number };

export type Shape = {
  id: string;
  x: number;
  y: number;
  vertices: Vertex[];
  color: string;
  // We need to know the rough "size" for click detection
  radius: number;
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

    const createShape = (id: string): Shape | null => {
      const canvas = canvasRef.current;
      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        console.error('Canvas not ready for shape creation');
        return null;
      }

      const maxRadius = 40;
      const x = Math.random() * (canvas.width - maxRadius * 2) + maxRadius;
      const y = Math.random() * (canvas.height - maxRadius * 2) + maxRadius;

      const sides = Math.floor(Math.random() * (8 - 4 + 1)) + 4;
      const vertices: Vertex[] = [];
      for (let i = 0; i < sides; i++) {
        const angle = ((Math.PI * 2) / sides) * i;
        const radius = Math.random() * maxRadius * 0.5 + maxRadius * 0.5;
        vertices.push({
          x: x + radius * Math.cos(angle),
          y: y + radius * Math.sin(angle),
        });
      }

      const colors = ['#fc79bc', '#fcec79', '#fafafa'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      return { id, x, y, vertices, color: randomColor, radius: maxRadius };
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

    // Effect for resizing the canvas
    useEffect(() => {
      const canvas = canvasRef.current;
      const container = canvas?.parentElement;
      if (!canvas || !container) return;

      const resizeCanvas = () => {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        // After resizing, we need to redraw the scene
        setShapes((s) => [...s]); // Re-trigger the draw effect
      };

      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    // Effect for drawing shapes
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;

      // Clear the canvas every time we redraw
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Draw all shapes
      shapes.forEach((shape) => {
        if (shape.vertices.length > 0) {
          context.beginPath();
          context.moveTo(shape.vertices[0].x, shape.vertices[0].y);
          for (let i = 1; i < shape.vertices.length; i++) {
            context.lineTo(shape.vertices[i].x, shape.vertices[i].y);
          }
          context.closePath();
          context.fillStyle = shape.color;
          context.fill();
        }
      });
    }, [shapes,]); // Redraw whenever shapes change

    // Effect for handling clicks
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const handleClick = (event: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const clickedShape = [...shapes].reverse().find((shape) => {
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
      return () => canvas.removeEventListener('click', handleClick);
    }, [shapes, onShapeClick]);

    return <canvas ref={canvasRef} className="absolute inset-0 -z-10" />;
  }
);

FogVisualizer.displayName = 'FogVisualizer';
export default FogVisualizer;
