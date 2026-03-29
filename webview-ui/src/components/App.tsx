import React, { useMemo, useState } from "react";
import { useTaskGraph, LayoutNode } from "../hooks/useTaskGraph";

// ── Constants ─────────────────────────────────────────────────────────────────
const NODE_W = 160;
const NODE_H = 72;
const PAD = 40;

const STATUS_COLOR: Record<string, string> = {
  pending: "var(--status-pending)",
  running: "var(--status-running)",
  done: "var(--status-done)",
  failed: "var(--status-failed)",
};

const PRIORITY_BADGE: Record<string, string> = {
  low: "var(--priority-low)",
  medium: "var(--priority-medium)",
  high: "var(--priority-high)",
  critical: "var(--priority-critical)",
};

// ── App ───────────────────────────────────────────────────────────────────────
export function App() {
  const { graph, filename, selected, selectTask, layout } = useTaskGraph();
  const [hovered, setHovered] = useState<string | null>(null);

  const nodes = useMemo(() => Array.from(layout.values()), [layout]);

  // Compute SVG canvas size
  const maxX = Math.max(...nodes.map((n) => n.x + NODE_W), 400);
  const maxY = Math.max(...nodes.map((n) => n.y + NODE_H), 300);
  const svgW = maxX + PAD * 2;
  const svgH = maxY + PAD * 2;

  // Build edges
  const edges = useMemo(() => {
    const result: { from: LayoutNode; to: LayoutNode; key: string }[] = [];
    for (const node of nodes) {
      for (const dep of node.task.dependsOn ?? []) {
        const src = layout.get(dep);
        if (src) result.push({ from: src, to: node, key: `${dep}->${node.task.id}` });
      }
    }
    return result;
  }, [nodes, layout]);

  const selectedTask = selected ? layout.get(selected)?.task : null;

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <span className="header-icon">⬡</span>
        <div>
          <h1 className="header-title">Task Graph</h1>
          <p className="header-sub">{filename} · {graph.tasks.length} tasks</p>
        </div>
        {graph.meta?.name && <span className="meta-badge">{graph.meta.name}</span>}
      </header>

      {/* Legend */}
      <div className="legend">
        {(["pending", "running", "done", "failed"] as const).map((s) => (
          <span key={s} className="legend-item">
            <span className="legend-dot" style={{ background: STATUS_COLOR[s] }} />
            {s}
          </span>
        ))}
      </div>

      {/* Graph */}
      <div className="canvas-wrap">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          width={svgW}
          height={svgH}
          className="graph-svg"
          onClick={() => selectTask(null)}
        >
          <defs>
            <marker id="arrow" markerWidth="10" markerHeight="7"
              refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="var(--edge-color)" />
            </marker>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Edges */}
          {edges.map(({ from, to, key }) => {
            const x1 = PAD + from.x + NODE_W;
            const y1 = PAD + from.y + NODE_H / 2;
            const x2 = PAD + to.x;
            const y2 = PAD + to.y + NODE_H / 2;
            const cx = (x1 + x2) / 2;
            const isHighlighted =
              selected === from.task.id || selected === to.task.id ||
              hovered === from.task.id || hovered === to.task.id;
            return (
              <path
                key={key}
                d={`M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`}
                fill="none"
                stroke={isHighlighted ? "var(--edge-highlight)" : "var(--edge-color)"}
                strokeWidth={isHighlighted ? 2 : 1.5}
                strokeDasharray={isHighlighted ? "none" : "5 3"}
                markerEnd="url(#arrow)"
                opacity={isHighlighted ? 1 : 0.5}
                style={{ transition: "all 0.2s" }}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map(({ task, x, y }) => {
            const nx = PAD + x;
            const ny = PAD + y;
            const isSelected = selected === task.id;
            const isHov = hovered === task.id;
            const statusColor = STATUS_COLOR[task.status ?? "pending"];

            return (
              <g
                key={task.id}
                transform={`translate(${nx}, ${ny})`}
                onClick={(e) => { e.stopPropagation(); selectTask(task.id); }}
                onMouseEnter={() => setHovered(task.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}
                filter={isSelected ? "url(#glow)" : undefined}
              >
                {/* Shadow */}
                <rect x={2} y={3} width={NODE_W} height={NODE_H} rx={8}
                  fill="rgba(0,0,0,0.35)" />

                {/* Card background */}
                <rect width={NODE_W} height={NODE_H} rx={8}
                  fill={isSelected ? "var(--node-selected-bg)" : isHov ? "var(--node-hover-bg)" : "var(--node-bg)"}
                  stroke={isSelected ? "var(--node-selected-border)" : "var(--node-border)"}
                  strokeWidth={isSelected ? 2 : 1}
                  style={{ transition: "all 0.18s" }}
                />

                {/* Status bar */}
                <rect x={0} y={NODE_H - 4} width={NODE_W} height={4} rx={4}
                  fill={statusColor} />

                {/* Priority dot */}
                <circle cx={NODE_W - 14} cy={14}
                  r={5}
                  fill={PRIORITY_BADGE[task.priority ?? "medium"]}
                />

                {/* Label */}
                <text x={12} y={26}
                  fill="var(--node-label)" fontSize={13} fontWeight={600}
                  fontFamily="var(--font-mono)"
                >
                  {truncate(task.label, 17)}
                </text>

                {/* ID */}
                <text x={12} y={44}
                  fill="var(--node-id)" fontSize={10}
                  fontFamily="var(--font-mono)" opacity={0.7}
                >
                  #{task.id}
                </text>

                {/* Deps count */}
                {(task.dependsOn?.length ?? 0) > 0 && (
                  <text x={12} y={60}
                    fill="var(--node-meta)" fontSize={9}
                    fontFamily="var(--font-mono)" opacity={0.55}
                  >
                    ← {task.dependsOn!.length} dep{task.dependsOn!.length > 1 ? "s" : ""}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Detail panel */}
      {selectedTask && (
        <aside className="detail-panel" key={selectedTask.id}>
          <button className="detail-close" onClick={() => selectTask(null)}>✕</button>
          <h2 className="detail-title">{selectedTask.label}</h2>
          <p className="detail-id">id: {selectedTask.id}</p>

          <div className="detail-badges">
            <span className="badge" style={{ background: STATUS_COLOR[selectedTask.status ?? "pending"] }}>
              {selectedTask.status ?? "pending"}
            </span>
            <span className="badge" style={{ background: PRIORITY_BADGE[selectedTask.priority ?? "medium"] }}>
              {selectedTask.priority ?? "medium"}
            </span>
          </div>

          {selectedTask.description && (
            <p className="detail-desc">{selectedTask.description}</p>
          )}

          {(selectedTask.dependsOn?.length ?? 0) > 0 && (
            <div className="detail-section">
              <p className="detail-section-title">Depends on</p>
              <ul className="detail-list">
                {selectedTask.dependsOn!.map((d) => (
                  <li key={d}
                    className="detail-list-item"
                    onClick={() => selectTask(d)}
                  >
                    #{d}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
