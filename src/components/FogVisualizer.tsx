'use client';

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Matter from 'matter-js';

export type FogVisualizerHandle = {
  addBody: () => void;
};

const FogVisualizer = forwardRef<FogVisualizerHandle, {}>((props, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine>();
  const renderRef = useRef<Matter.Render>();
  const mousePosition = useRef({ x: 0, y: 0 });

  const createBody = () => {
    if (!containerRef.current || !engineRef.current) return;
    const homeDiv = containerRef.current;
    const spawnX = Math.random() * homeDiv.clientWidth;
    const spawnY = -100;
    const radius = Math.random() * 20 + 20;

    const colors = ['#fc79bc', '#fcec79', '#fafafa'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const body = Matter.Bodies.circle(spawnX, spawnY, radius, {
      frictionAir: 0.05,
      restitution: 0.4,
      render: {
        fillStyle: randomColor,
        strokeStyle: '#3F3F46',
        lineWidth: 1,
      },
    });

    Matter.Body.setVelocity(body, {
      x: (Math.random() - 0.5) * 2,
      y: 0,
    });

    Matter.World.add(engineRef.current.world, body);
  };

  useImperativeHandle(ref, () => ({
    addBody: () => {
      createBody();
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const homeDiv = containerRef.current;
    const { clientWidth, clientHeight } = homeDiv;

    mousePosition.current = {
      x: clientWidth / 2,
      y: clientHeight / 2,
    };

    const engine = Matter.Engine.create({
      gravity: {
        x: 0,
        y: 0.1,
      },
    });
    engineRef.current = engine;

    const render = Matter.Render.create({
      element: homeDiv,
      engine: engine,
      options: {
        width: clientWidth,
        height: clientHeight,
        wireframes: false,
        background: 'transparent',
      },
    });
    renderRef.current = render;

    const wallOptions = {
      isStatic: true,
      render: { visible: false },
    };

    Matter.World.add(engine.world, [
      Matter.Bodies.rectangle(clientWidth / 2, -25, clientWidth, 50, wallOptions), // top
      Matter.Bodies.rectangle(clientWidth / 2, clientHeight + 25, clientWidth, 50, wallOptions), // bottom
      Matter.Bodies.rectangle(-25, clientHeight / 2, 50, clientHeight, wallOptions), // left
      Matter.Bodies.rectangle(clientWidth + 25, clientHeight / 2, 50, clientHeight, wallOptions), // right
    ]);

    const applyCursorAttraction = () => {
      const bodies = Matter.Composite.allBodies(engine.world);
      bodies.forEach((body) => {
        if (body.isStatic) return;
        const dx = mousePosition.current.x - body.position.x;
        const dy = mousePosition.current.y - body.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
            const forceMagnitude = 0.00005 * body.mass;
            Matter.Body.applyForce(body, body.position, {
              x: (dx / distance) * forceMagnitude,
              y: (dy / distance) * forceMagnitude,
            });
        }
      });
    };

    Matter.Events.on(engine, 'beforeUpdate', applyCursorAttraction);
    Matter.Engine.run(engine);
    Matter.Render.run(render);

    const handleMouseMove = (event: MouseEvent) => {
      mousePosition.current = { x: event.clientX, y: event.clientY };
    };
    document.addEventListener('mousemove', handleMouseMove);

    const handleResize = () => {
        if (renderRef.current && containerRef.current && renderRef.current.canvas && engineRef.current) {
            const newWidth = containerRef.current.clientWidth;
            const newHeight = containerRef.current.clientHeight;

            renderRef.current.canvas.width = newWidth;
            renderRef.current.canvas.height = newHeight;
            renderRef.current.options.width = newWidth;
            renderRef.current.options.height = newHeight;
            
            // This part is tricky - for now, we'll just let the walls be where they are.
            // A full solution would involve removing old walls and adding new ones.
            // But let's keep it simple to ensure it works first.
        }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (renderRef.current) {
        Matter.Render.stop(renderRef.current);
        if(renderRef.current.canvas) renderRef.current.canvas.remove();
      }
      if (engineRef.current) {
         Matter.Events.off(engineRef.current, 'beforeUpdate', applyCursorAttraction);
         Matter.Engine.clear(engineRef.current);
      }
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 z-0" />;
});

FogVisualizer.displayName = 'FogVisualizer';
export default FogVisualizer;
