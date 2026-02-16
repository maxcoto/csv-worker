"use client";

interface LinearGraphProps {
  /** Slope (pendiente) */
  m: number;
  /** Y-intercept (ordenada al origen) */
  b: number;
}

/**
 * Renders a clean SVG coordinate plane with a linear function y = mx + b.
 * Shows axes, grid, the line, and labels for the equation, slope, and y-intercept.
 * Designed to fit inside a chat bubble.
 */
export function LinearGraph({ m, b }: LinearGraphProps) {
  // SVG dimensions and coordinate mapping
  const width = 320;
  const height = 280;
  const padding = 40;

  // Visible coordinate range
  const xMin = -6;
  const xMax = 6;
  const yMin = -6;
  const yMax = 6;

  // Map math coordinates to SVG coordinates
  const toSvgX = (x: number) =>
    padding + ((x - xMin) / (xMax - xMin)) * (width - 2 * padding);
  const toSvgY = (y: number) =>
    height - padding - ((y - yMin) / (yMax - yMin)) * (height - 2 * padding);

  // Compute line endpoints (clipped to visible area)
  const lineY = (x: number) => m * x + b;

  // Find intersection with the visible box to draw the line
  const linePoints: Array<{ x: number; y: number }> = [];
  for (let x = xMin - 1; x <= xMax + 1; x += 0.1) {
    const y = lineY(x);
    if (y >= yMin - 1 && y <= yMax + 1) {
      linePoints.push({ x, y });
    }
  }

  const x1 = linePoints.at(0)?.x ?? xMin;
  const x2 = linePoints.at(-1)?.x ?? xMax;

  // Format equation string
  const formatEquation = () => {
    if (m === 0) return `y = ${b}`;
    const mStr = m === 1 ? "" : m === -1 ? "-" : `${m}`;
    if (b === 0) return `y = ${mStr}x`;
    const bSign = b > 0 ? "+" : "-";
    return `y = ${mStr}x ${bSign} ${Math.abs(b)}`;
  };

  return (
    <div className="rounded-lg border border-border bg-background/80 p-2">
      <svg
        className="w-full"
        viewBox={`0 0 ${width} ${height}`}
      >
        <title>{`Gráfico: ${formatEquation()}`}</title>

        {/* Grid lines */}
        {Array.from({ length: xMax - xMin + 1 }, (_, i) => xMin + i).map(
          (x) => (
            <line
              key={`gx-${x}`}
              stroke="currentColor"
              strokeOpacity={x === 0 ? 0.3 : 0.08}
              strokeWidth={x === 0 ? 1.5 : 1}
              x1={toSvgX(x)}
              x2={toSvgX(x)}
              y1={toSvgY(yMin)}
              y2={toSvgY(yMax)}
            />
          )
        )}
        {Array.from({ length: yMax - yMin + 1 }, (_, i) => yMin + i).map(
          (y) => (
            <line
              key={`gy-${y}`}
              stroke="currentColor"
              strokeOpacity={y === 0 ? 0.3 : 0.08}
              strokeWidth={y === 0 ? 1.5 : 1}
              x1={toSvgX(xMin)}
              x2={toSvgX(xMax)}
              y1={toSvgY(y)}
              y2={toSvgY(y)}
            />
          )
        )}

        {/* Axis labels */}
        {Array.from({ length: xMax - xMin + 1 }, (_, i) => xMin + i)
          .filter((x) => x !== 0)
          .map((x) => (
            <text
              key={`lx-${x}`}
              className="fill-muted-foreground"
              dx={0}
              dy={14}
              fontSize={9}
              textAnchor="middle"
              x={toSvgX(x)}
              y={toSvgY(0)}
            >
              {x}
            </text>
          ))}
        {Array.from({ length: yMax - yMin + 1 }, (_, i) => yMin + i)
          .filter((y) => y !== 0)
          .map((y) => (
            <text
              key={`ly-${y}`}
              className="fill-muted-foreground"
              dx={-10}
              dy={3}
              fontSize={9}
              textAnchor="middle"
              x={toSvgX(0)}
              y={toSvgY(y)}
            >
              {y}
            </text>
          ))}

        {/* Axis arrows */}
        <text
          className="fill-muted-foreground font-medium"
          dx={8}
          dy={4}
          fontSize={11}
          x={toSvgX(xMax)}
          y={toSvgY(0)}
        >
          x
        </text>
        <text
          className="fill-muted-foreground font-medium"
          dx={-4}
          dy={-8}
          fontSize={11}
          textAnchor="middle"
          x={toSvgX(0)}
          y={toSvgY(yMax)}
        >
          y
        </text>

        {/* The linear function line */}
        <line
          stroke="#10b981"
          strokeLinecap="round"
          strokeWidth={2.5}
          x1={toSvgX(x1)}
          x2={toSvgX(x2)}
          y1={toSvgY(lineY(x1))}
          y2={toSvgY(lineY(x2))}
        />

        {/* Y-intercept point */}
        {b >= yMin && b <= yMax ? (
          <circle
            cx={toSvgX(0)}
            cy={toSvgY(b)}
            fill="#10b981"
            r={4}
            stroke="white"
            strokeWidth={1.5}
          />
        ) : null}

        {/* Origin marker */}
        <text
          className="fill-muted-foreground"
          dx={-10}
          dy={14}
          fontSize={9}
          textAnchor="middle"
          x={toSvgX(0)}
          y={toSvgY(0)}
        >
          0
        </text>
      </svg>

      {/* Equation label */}
      <div className="mt-1 text-center text-xs font-medium text-matrix-green-700 dark:text-matrix-green-400">
        {formatEquation()}
        {m !== 0 ? (
          <span className="ml-2 text-muted-foreground">
            (m={m}, b={b})
          </span>
        ) : null}
      </div>
    </div>
  );
}
