// src/components/AnimatedBottle.jsx
import React from "react";

export default function AnimatedBottle({ logoSrc }) {
  return (
    <div className="relative">
      <style>{`
        @keyframes bob { 0% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(-8px) rotate(1deg); } 100% { transform: translateY(0) rotate(-1deg); } }
        @keyframes slosh { 0% { transform: translateX(0); } 100% { transform: translateX(-120%); } }
      `}</style>

      <svg
        className="h-[320px] w-[160px] animate-[bob_4s_ease-in-out_infinite] sm:h-[360px] sm:w-[180px]"
        viewBox="0 0 180 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Branded water bottle animation"
        role="img"
      >
        <defs>
          <clipPath id="bottle-clip">
            <path d="M90 10c-12 0-22 10-22 22v12c0 6-4 12-10 14C38 64 28 75 28 88v190c0 35 27 64 62 64s62-29 62-64V88c0-13-10-24-30-30-6-2-10-8-10-14V32c0-12-10-22-22-22Z"/>
          </clipPath>
          <linearGradient id="waveFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#7EF1CF" stopOpacity=".9" />
            <stop offset="100%" stopColor="#3CC6FF" stopOpacity=".9" />
          </linearGradient>
          <filter id="glass" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.3" result="blur"/>
            <feBlend in="SourceGraphic" in2="blur" mode="screen"/>
          </filter>
          <linearGradient id="glassGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
          </linearGradient>
        </defs>

        <path
          d="M90 10c-12 0-22 10-22 22v12c0 6-4 12-10 14C38 64 28 75 28 88v190c0 35 27 64 62 64s62-29 62-64V88c0-13-10-24-30-30-6-2-10-8-10-14V32c0-12-10-22-22-22Z"
          fill="url(#glassGrad)"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
          filter="url(#glass)"
        />

        {/* water */}
        <g clipPath="url(#bottle-clip)">
          <rect x="-200" y="150" width="400" height="220" fill="url(#waveFill)" opacity=".85" />
          <g transform="translate(0, 150)">
            <path d="M0 60 Q 30 40 60 60 T 120 60 T 180 60 T 240 60 T 300 60"
                  stroke="rgba(255,255,255,0.35)" strokeWidth="2" fill="none"
                  style={{ animation: "slosh 6s linear infinite" }} />
            <path d="M0 75 Q 30 55 60 75 T 120 75 T 180 75 T 240 75 T 300 75"
                  stroke="rgba(255,255,255,0.25)" strokeWidth="2" fill="none"
                  style={{ animation: "slosh 8s linear infinite" }} />
          </g>
          <rect x="34" y="20" width="10" height="300" fill="white" opacity=".08" />
          <rect x="120" y="40" width="6" height="260" fill="white" opacity=".06" />
        </g>

        {/* cap */}
        <rect x="68" y="0" width="44" height="20" rx="4" fill="#9FE8FF" />
        <rect x="66" y="18" width="48" height="10" rx="3" fill="#79D2FF" opacity=".8" />

        {/* label */}
        <g transform="translate(55, 105)">
          <rect width="70" height="50" rx="8" fill="white" opacity=".95" />
          <image href={logoSrc} x="7" y="7" width="56" height="36" preserveAspectRatio="xMidYMid meet" />
        </g>
      </svg>
    </div>
  );
}
