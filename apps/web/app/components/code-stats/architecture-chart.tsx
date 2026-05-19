'use client';

import { useRef, useMemo, useState } from 'react';
import { useInView } from '../animated-cards/use-in-view';
import type { ArchitectureData, ArchNode, ArchEdge } from './types';

interface ArchitectureChartProps {
  data: ArchitectureData;
}

interface SimNode {
  id: string;
  label: string;
  lines: number;
  files: number;
  color: string;
  layer: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

const WIDTH = 800;
const HEIGHT = 500;

// Layer Y targets
const LAYER_Y: Record<string, number> = {
  apps: 100,
  packages: 300,
  infra: 450,
  backend: 450,
};

function computeRadius(lines: number): number {
  const r = Math.sqrt(lines) * 0.08;
  return Math.max(18, Math.min(48, r));
}

function runSimulation(nodes: ArchNode[], edges: ArchEdge[]): SimNode[] {
  // Initialize simulation nodes
  const simNodes: SimNode[] = nodes.map((n, i) => {
    const layerY = LAYER_Y[n.layer] || 250;
    const layerNodes = nodes.filter((nn) => nn.layer === n.layer);
    const layerIdx = layerNodes.indexOf(n);
    const spread = WIDTH / (layerNodes.length + 1);
    return {
      ...n,
      x: spread * (layerIdx + 1),
      y: layerY + (Math.random() - 0.5) * 40,
      vx: 0,
      vy: 0,
      radius: computeRadius(n.lines),
    };
  });

  const nodeMap = new Map(simNodes.map((n) => [n.id, n]));

  // Run iterations
  const iterations = 120;
  const dt = 1;
  const repulsion = 8000;
  const attraction = 0.005;
  const layerGravity = 0.03;
  const damping = 0.85;
  const centerX = WIDTH / 2;

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion between all pairs
    for (let i = 0; i < simNodes.length; i++) {
      for (let j = i + 1; j < simNodes.length; j++) {
        const a = simNodes[i];
        const b = simNodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = a.radius + b.radius + 20;
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;

        // Extra push if overlapping
        if (dist < minDist) {
          const overlap = (minDist - dist) * 0.5;
          a.vx -= (dx / dist) * overlap;
          a.vy -= (dy / dist) * overlap;
          b.vx += (dx / dist) * overlap;
          b.vy += (dy / dist) * overlap;
        }
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const source = nodeMap.get(edge.from);
      const target = nodeMap.get(edge.to);
      if (!source || !target) continue;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = dist * attraction;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    }

    // Layer gravity (pull toward layer Y)
    for (const node of simNodes) {
      const targetY = LAYER_Y[node.layer] || 250;
      node.vy += (targetY - node.y) * layerGravity;
      // Gentle X centering
      node.vx += (centerX - node.x) * 0.002;
    }

    // Apply velocities
    for (const node of simNodes) {
      node.vx *= damping;
      node.vy *= damping;
      node.x += node.vx * dt;
      node.y += node.vy * dt;
      // Boundary constraints
      node.x = Math.max(node.radius + 10, Math.min(WIDTH - node.radius - 10, node.x));
      node.y = Math.max(node.radius + 10, Math.min(HEIGHT - node.radius - 10, node.y));
    }
  }

  return simNodes;
}

export function ArchitectureChart({ data }: ArchitectureChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const simNodes = useMemo(() => runSimulation(data.nodes, data.edges), [data]);

  const nodeMap = useMemo(() => new Map(simNodes.map((n) => [n.id, n])), [simNodes]);

  // Edges connected to hovered node
  const connectedEdges = useMemo(() => {
    if (!hoveredNode) return new Set<number>();
    const set = new Set<number>();
    data.edges.forEach((e, i) => {
      if (e.from === hoveredNode || e.to === hoveredNode) set.add(i);
    });
    return set;
  }, [hoveredNode, data.edges]);

  const connectedNodes = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const set = new Set<string>([hoveredNode]);
    data.edges.forEach((e) => {
      if (e.from === hoveredNode) set.add(e.to);
      if (e.to === hoveredNode) set.add(e.from);
    });
    return set;
  }, [hoveredNode, data.edges]);

  if (!data.nodes.length) return null;

  return (
    <div
      ref={ref}
      className={`rounded-xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:border-amber-300/30 ${
        isInView ? 'animate-fade-in-up' : 'opacity-0'
      }`}
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">架构依赖图</h3>
          <p className="text-sm text-zinc-500">模块间依赖关系 · 节点大小反映代码量</p>
        </div>
        <div className="flex gap-3">
          {['apps', 'packages', 'backend', 'infra'].map((layer) => (
            <span
              key={layer}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-zinc-400"
            >
              {layer}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className={`w-full transition-opacity duration-500 ${isInView ? 'opacity-100' : 'opacity-0'}`}
          style={{ minHeight: 400 }}
        >
          {/* Arrow marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="rgba(255,255,255,0.3)" />
            </marker>
            <marker
              id="arrowhead-highlight"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="rgba(251,191,36,0.8)" />
            </marker>
          </defs>

          {/* Layer background bands */}
          <rect x={0} y={40} width={WIDTH} height={120} fill="rgba(245,158,11,0.03)" rx={8} />
          <rect x={0} y={200} width={WIDTH} height={180} fill="rgba(59,130,246,0.03)" rx={8} />
          <rect x={0} y={400} width={WIDTH} height={90} fill="rgba(132,204,22,0.03)" rx={8} />

          {/* Layer labels */}
          <text x={12} y={60} fill="#64748B" fontSize={10} fontFamily="system-ui" opacity={0.6}>
            Apps
          </text>
          <text x={12} y={220} fill="#64748B" fontSize={10} fontFamily="system-ui" opacity={0.6}>
            Packages
          </text>
          <text x={12} y={420} fill="#64748B" fontSize={10} fontFamily="system-ui" opacity={0.6}>
            Infra
          </text>

          {/* Edges */}
          {data.edges.map((edge, i) => {
            const source = nodeMap.get(edge.from);
            const target = nodeMap.get(edge.to);
            if (!source || !target) return null;

            const isHighlighted = hoveredNode ? connectedEdges.has(i) : false;
            const isDimmed = hoveredNode && !connectedEdges.has(i);

            // Calculate edge endpoint at circle boundary
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const sx = source.x + (dx / dist) * source.radius;
            const sy = source.y + (dy / dist) * source.radius;
            const tx = target.x - (dx / dist) * (target.radius + 8);
            const ty = target.y - (dy / dist) * (target.radius + 8);

            return (
              <line
                key={`edge-${i}`}
                x1={sx}
                y1={sy}
                x2={tx}
                y2={ty}
                stroke={isHighlighted ? 'rgba(251,191,36,0.8)' : source.color}
                strokeWidth={isHighlighted ? 2 : 1}
                strokeOpacity={isDimmed ? 0.1 : isHighlighted ? 1 : 0.3}
                markerEnd={isHighlighted ? 'url(#arrowhead-highlight)' : 'url(#arrowhead)'}
                className="transition-all duration-200"
              />
            );
          })}

          {/* Nodes */}
          {simNodes.map((node) => {
            const isHighlighted = hoveredNode ? connectedNodes.has(node.id) : false;
            const isDimmed = hoveredNode && !connectedNodes.has(node.id);

            return (
              <g
                key={node.id}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer"
              >
                {/* Glow on hover */}
                {isHighlighted && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.radius + 4}
                    fill="none"
                    stroke={node.color}
                    strokeWidth={2}
                    strokeOpacity={0.4}
                  />
                )}
                {/* Main circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.radius}
                  fill={node.color}
                  fillOpacity={isDimmed ? 0.15 : 0.25}
                  stroke={node.color}
                  strokeWidth={isDimmed ? 0.5 : 1.5}
                  strokeOpacity={isDimmed ? 0.2 : 0.8}
                  className="transition-all duration-200"
                />
                {/* Label */}
                <text
                  x={node.x}
                  y={node.y - 2}
                  textAnchor="middle"
                  fill={isDimmed ? '#4B5563' : '#E5E7EB'}
                  fontSize={node.radius > 30 ? 11 : 9}
                  fontFamily="system-ui"
                  fontWeight={500}
                  className="pointer-events-none transition-all duration-200"
                >
                  {node.label}
                </text>
                {/* Lines count */}
                <text
                  x={node.x}
                  y={node.y + 11}
                  textAnchor="middle"
                  fill={isDimmed ? '#374151' : '#9CA3AF'}
                  fontSize={8}
                  fontFamily="system-ui"
                  className="pointer-events-none transition-all duration-200"
                >
                  {node.lines > 1000 ? `${Math.round(node.lines / 1000)}K` : node.lines}
                </text>
                {/* Tooltip on hover */}
                {hoveredNode === node.id && (
                  <g>
                    <rect
                      x={node.x + node.radius + 8}
                      y={node.y - 30}
                      width={130}
                      height={52}
                      rx={6}
                      fill="rgba(15,15,20,0.95)"
                      stroke="rgba(255,255,255,0.15)"
                      strokeWidth={1}
                    />
                    <text
                      x={node.x + node.radius + 16}
                      y={node.y - 12}
                      fill="#F9FAFB"
                      fontSize={11}
                      fontWeight={600}
                      fontFamily="system-ui"
                    >
                      {node.label}
                    </text>
                    <text
                      x={node.x + node.radius + 16}
                      y={node.y + 4}
                      fill="#9CA3AF"
                      fontSize={9}
                      fontFamily="system-ui"
                    >
                      {node.lines.toLocaleString()} 行 · {node.files} 文件
                    </text>
                    <text
                      x={node.x + node.radius + 16}
                      y={node.y + 17}
                      fill="#6B7280"
                      fontSize={9}
                      fontFamily="system-ui"
                    >
                      {data.edges.filter((e) => e.from === node.id).length} 依赖 · {data.edges.filter((e) => e.to === node.id).length} 被依赖
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
