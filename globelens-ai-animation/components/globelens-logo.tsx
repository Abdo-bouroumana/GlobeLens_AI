"use client"

import type React from "react"
import { useMemo } from "react"

const CENTER = 200
const PETALS = 8

// Build a single leaf/petal path pointing "up" (outward along +Y in local space)
function petalPath(rin: number, rout: number, width: number) {
  const rmid = (rin + rout) / 2
  return `M 0,${rin} Q ${-width},${rmid} 0,${rout} Q ${width},${rmid} 0,${rin} Z`
}

// Logarithmic spiral arm -> SVG path
function spiralArm(startAngle: number, turns: number, r0: number, b: number, steps = 60) {
  const pts: string[] = []
  const total = turns * Math.PI * 2
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * total
    const r = r0 * Math.exp(b * t)
    const a = startAngle + t
    const x = CENTER + r * Math.cos(a)
    const y = CENTER + r * Math.sin(a)
    pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return pts.join(" ")
}

export function GlobelensLogo() {
  const petalAngles = useMemo(
    () => Array.from({ length: PETALS }, (_, i) => (360 / PETALS) * i),
    [],
  )

  // Inner ring node positions (between/around petals)
  const ringNodes = useMemo(() => {
    const nodes: { x: number; y: number; r: number }[] = []
    const count = 16
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count
      const radius = i % 2 === 0 ? 70 : 86
      nodes.push({
        x: CENTER + radius * Math.cos(a),
        y: CENTER + radius * Math.sin(a),
        r: i % 2 === 0 ? 3.2 : 2.2,
      })
    }
    return nodes
  }, [])

  const spiralArms = useMemo(
    () => Array.from({ length: 6 }, (_, i) => (Math.PI * 2 * i) / 6),
    [],
  )

  return (
    <div
      className="globelens"
      style={
        {
          "--brand-cyan": "#22d3ee",
          "--brand-teal": "#2dd4bf",
          "--brand-blue": "#3b82f6",
          "--brand-node": "#38bdf8",
        } as React.CSSProperties
      }
    >
      <svg
        viewBox="0 0 400 400"
        className="size-[min(80vw,520px)] drop-shadow-[0_0_30px_rgba(45,212,191,0.25)]"
        role="img"
        aria-label="GLOBELENS AI animated emblem"
      >
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--brand-teal)" stopOpacity="0.45" />
            <stop offset="60%" stopColor="var(--brand-cyan)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--brand-cyan)" stopOpacity="0" />
          </radialGradient>
          <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ambient core glow */}
        <circle cx={CENTER} cy={CENTER} r="150" fill="url(#coreGlow)" className="breathe" />

        {/* Outer petal mandala (slow rotation) */}
        <g className="spin-slow" style={{ transformOrigin: "200px 200px" }} filter="url(#soft)">
          {petalAngles.map((deg, i) => (
            <g key={deg} transform={`rotate(${deg} ${CENTER} ${CENTER})`}>
              <g transform={`translate(${CENTER} ${CENTER})`}>
                {/* leaf outline */}
                <path
                  d={petalPath(60, 150, 34)}
                  fill="none"
                  stroke="var(--brand-blue)"
                  strokeWidth="2"
                  opacity="0.85"
                />
                <path
                  d={petalPath(60, 150, 20)}
                  fill="none"
                  stroke="var(--brand-cyan)"
                  strokeWidth="1.2"
                  opacity="0.55"
                />
                {/* tip + side nodes */}
                <circle
                  cx="0"
                  cy="150"
                  r="4.5"
                  fill="var(--brand-cyan)"
                  className="pulse"
                  style={{ animationDelay: `${i * 0.18}s` }}
                />
                <circle cx={-34} cy={105} r="3" fill="var(--brand-node)" className="pulse" style={{ animationDelay: `${i * 0.18 + 0.4}s` }} />
                <circle cx={34} cy={105} r="3" fill="var(--brand-node)" className="pulse" style={{ animationDelay: `${i * 0.18 + 0.6}s` }} />
                <circle cx="0" cy="60" r="3.4" fill="var(--brand-blue)" />
              </g>
            </g>
          ))}
        </g>

        {/* Inner ring of nodes (gentle counter rotation) */}
        <g className="spin-rev" style={{ transformOrigin: "200px 200px" }}>
          {ringNodes.map((n, i) => (
            <circle
              key={i}
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill="var(--brand-cyan)"
              className="pulse"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </g>

        {/* Central swirling spiral (faster counter rotation) */}
        <g className="spin-core" style={{ transformOrigin: "200px 200px" }} filter="url(#soft)">
          {spiralArms.map((a, i) => (
            <path
              key={i}
              d={spiralArm(a, 0.62, 8, 0.45)}
              fill="none"
              stroke={i % 2 === 0 ? "var(--brand-teal)" : "var(--brand-cyan)"}
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.9"
            />
          ))}
          {/* tiny scattered core dots */}
          {Array.from({ length: 7 }).map((_, i) => {
            const a = (Math.PI * 2 * i) / 7
            const r = 18 + (i % 3) * 6
            return (
              <circle
                key={`d${i}`}
                cx={CENTER + r * Math.cos(a)}
                cy={CENTER + r * Math.sin(a)}
                r="2.4"
                fill="var(--brand-teal)"
                className="pulse"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            )
          })}
        </g>
      </svg>

      {/* Wordmark */}
      <div className="-mt-2 text-center">
        <h1 className="glow-text font-sans text-4xl font-light tracking-[0.18em] sm:text-5xl md:text-6xl">
          GLOBELENS AI
        </h1>
        <p className="mt-3 font-mono text-sm tracking-[0.5em] text-[var(--brand-blue)] sm:text-base">
          SINCE 2026
        </p>
      </div>

      <style jsx>{`
        .globelens {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .spin-slow {
          animation: spin 46s linear infinite;
        }
        .spin-rev {
          animation: spin 36s linear infinite reverse;
        }
        .spin-core {
          animation: spin 14s linear infinite reverse;
        }
        .breathe {
          animation: breathe 5s ease-in-out infinite;
          transform-origin: 200px 200px;
        }
        .pulse {
          animation: pulse 2.4s ease-in-out infinite;
        }
        .glow-text {
          color: var(--brand-cyan);
          text-shadow:
            0 0 8px rgba(45, 212, 191, 0.55),
            0 0 22px rgba(34, 211, 238, 0.35);
          animation: textGlow 4s ease-in-out infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes breathe {
          0%,
          100% {
            opacity: 0.55;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.08);
          }
        }
        @keyframes pulse {
          0%,
          100% {
            opacity: 0.45;
          }
          50% {
            opacity: 1;
          }
        }
        @keyframes textGlow {
          0%,
          100% {
            text-shadow:
              0 0 8px rgba(45, 212, 191, 0.45),
              0 0 22px rgba(34, 211, 238, 0.3);
          }
          50% {
            text-shadow:
              0 0 14px rgba(45, 212, 191, 0.75),
              0 0 34px rgba(34, 211, 238, 0.55);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .spin-slow,
          .spin-rev,
          .spin-core,
          .breathe,
          .pulse,
          .glow-text {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}
