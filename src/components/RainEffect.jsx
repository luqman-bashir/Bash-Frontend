import React, { useEffect, useRef } from "react";

const RainEffect = () => {
  const rainContainerRef = useRef(null);

  useEffect(() => {
    const container = document.createElement("div");
    container.className = "rain-container";
    document.body.appendChild(container);
    rainContainerRef.current = container;

    // Generate raindrops
    const numRaindrops = 100;
    for (let i = 0; i < numRaindrops; i++) {
      let drop = document.createElement("div");
      drop.className = "raindrop";
      drop.style.left = `${Math.random() * 100}vw`;
      drop.style.animationDuration = `${Math.random() * 1.5 + 0.5}s`;
      drop.style.opacity = `${Math.random()}`;
      container.appendChild(drop);
    }

    // Cleanup function to remove rain on unmount
    return () => {
      if (rainContainerRef.current) {
        document.body.removeChild(rainContainerRef.current);
      }
    };
  }, []);

  return (
    <style>
      {`
      .rain-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        overflow: hidden;
        z-index: -1;
      }

      .raindrop {
        position: absolute;
        width: 2px;
        height: 12px;
        background: rgba(255, 255, 255, 0.7);
        animation: fall linear infinite;
      }

      @keyframes fall {
        from {
          transform: translateY(-100vh);
        }
        to {
          transform: translateY(100vh);
        }
      }
      `}
    </style>
  );
};

export default RainEffect;
