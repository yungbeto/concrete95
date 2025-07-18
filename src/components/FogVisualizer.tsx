
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

    const createShape = (id: string) => {
      if (!canvasRef.current) return null;
      const canvas = canvasRef.current;
      
      const maxRadius = 40;
      // Ensure canvas has dimensions before creating a shape
      if (canvas.width === 0 || canvas.height === 0) return null;

      const x = Math.random() * (canvas.width - maxRadius * 2) + maxRadius;
      const y = Math.random() * (canvas.height - maxRadius * 2) + maxRadius;

      const sides = Math.floor(Math.random() * (8 - 4 + 1)) + 4;
      const vertices = [];
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

      const newShape = { id, x, y, vertices, color: randomColor, radius: maxRadius };
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
        // We'll use the center and max radius for a simpler hit detection
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
        const currentWidth = container.clientWidth;
        const currentHeight = container.clientHeight;

        if (canvas.width !== currentWidth || canvas.height !== currentHeight) {
          canvas.width = currentWidth;
          canvas.height = currentHeight;
        }
      };

      let animationFrameId: number;
      
      const render = () => {
        resizeCanvas();
        const context = canvas.getContext('2d');
        if (!context) return;
        
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        shapes.forEach((shape) => {
          if (shape.vertices.length > 0) {
            context.fillStyle = shape.color;
            context.beginPath();
            context.moveTo(shape.vertices[0].x, shape.vertices[0].y);
            for (let i = 1; i < shape.vertices.length; i++) {
              context.lineTo(shape.vertices[i].x, shape.vertices[i].y);
            }
            context.closePath();
            context.fill();
          }
        });
        
        animationFrameId = window.requestAnimationFrame(render);
      };
      
      render();
      
      window.addEventListener('resize', resizeCanvas);

      return () => {
        window.removeEventListener('resize', resizeCanvas);
        window.cancelAnimationFrame(animationFrameId);
      };
    }, [shapes]);

    return <canvas ref={canvasRef} className="absolute inset-0 -z-10" />;
  }
);

FogVisualizer.displayName = 'FogVisualizer';
export default FogVisualizer;
