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

  const createBody = (x?: number, y?: number) => {
    if (!containerRef.current || !engineRef.current) return;
    const homeDiv = containerRef.current;
    const spawnX = x || Math.random() * homeDiv.clientWidth;
    const spawnY = y || -100; // Start bodies above the top edge
    const sides = Math.floor(Math.random() * (8 - 4 + 1)) + 4;
    const maxRadius = 40;
    const vertices = [];
    for (let i = 0; i < sides; i++) {
      const angle = ((Math.PI * 2) / sides) * i;
      const radius = Math.random() * maxRadius * 0.5 + maxRadius * 0.5;
      vertices.push({
        x: spawnX + radius * Math.cos(angle),
        y: spawnY + radius * Math.sin(angle),
      });
    }

    const colors = ['#fc79bc', '#fcec79', '#fafafa'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const body = Matter.Bodies.fromVertices(
      spawnX,
      spawnY,
      [vertices],
      {
        frictionAir: 0.05,
        inertia: Infinity, // Prevents rotation
        render: {
          fillStyle: randomColor,
          strokeStyle: '#3F3F46',
          lineWidth: 1,
        },
      },
      true
    );

    Matter.Body.setVelocity(body, {
      x: (Math.random() - 0.5) * 0.2,
      y: 2, // Positive y-velocity to simulate dropping
    });

    Matter.World.add(engineRef.current.world, body);
  };

  useImperativeHandle(ref, () => ({
    addBody: () => {
      // Spawn in a random location at the top
      createBody(Math.random() * (containerRef.current?.clientWidth || window.innerWidth), -100);
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const homeDiv = containerRef.current;
    mousePosition.current = {
      x: homeDiv.clientWidth / 2,
      y: homeDiv.clientHeight / 2,
    };

    const engine = Matter.Engine.create({
      gravity: {
        x: 0,
        y: 0.1, // A little gravity to make them drift down
      },
    });
    engineRef.current = engine;

    const render = Matter.Render.create({
      element: homeDiv,
      engine: engine,
      options: {
        width: homeDiv.clientWidth,
        height: homeDiv.clientHeight,
        wireframes: false,
        background: 'transparent',
      },
    });
    renderRef.current = render;

    const createWalls = () => {
      if (!engineRef.current) return;
      // Clear only old walls
      const staticBodies = Matter.Composite.allBodies(engineRef.current.world).filter(b => b.isStatic);
      Matter.Composite.remove(engineRef.current.world, staticBodies);

      const wallOptions = {
        isStatic: true,
        render: { visible: false },
      };
      Matter.World.add(engineRef.current.world, [
        // top
        Matter.Bodies.rectangle(
          homeDiv.clientWidth / 2,
          -25,
          homeDiv.clientWidth,
          50,
          wallOptions
        ),
        // bottom
        Matter.Bodies.rectangle(
          homeDiv.clientWidth / 2,
          homeDiv.clientHeight + 25,
          homeDiv.clientWidth,
          50,
          wallOptions
        ),
        // left
        Matter.Bodies.rectangle(
          -25,
          homeDiv.clientHeight / 2,
          50,
          homeDiv.clientHeight,
          wallOptions
        ),
        // right
        Matter.Bodies.rectangle(
          homeDiv.clientWidth + 25,
          homeDiv.clientHeight / 2,
          50,
          homeDiv.clientHeight,
          wallOptions
        ),
      ]);
    };

    createWalls();

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

    const handleResize = () => {
        if (renderRef.current && containerRef.current && renderRef.current.canvas) {
            renderRef.current.canvas.width = containerRef.current.clientWidth;
            renderRef.current.canvas.height = containerRef.current.clientHeight;
            renderRef.current.options.width = containerRef.current.clientWidth;
            renderRef.current.options.height = containerRef.current.clientHeight;
            createWalls();
        }
    };

    const handleMouseMove = (event: MouseEvent) => {
      mousePosition.current = { x: event.clientX, y: event.clientY };
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('mousemove', handleMouseMove);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousemove', handleMouseMove);
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