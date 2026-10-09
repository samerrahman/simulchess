import React, { useState, useMemo } from 'react';
import { TrendingUp, Award, ArrowUpRight, ArrowDownRight, Minus, Activity } from 'lucide-react';
import { GLICKO_DEFAULTS } from './glicko2';

export default function RatingHistoryChart({ history = [], currentRating, currentRd }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const points = useMemo(() => {
    if (!history || history.length === 0) return [];
    return history.filter(p => typeof p.rating === 'number');
  }, [history]);

  // Compute peak, lowest, and stats
  const stats = useMemo(() => {
    if (points.length === 0) {
      return {
        peak: currentRating || GLICKO_DEFAULTS.RATING,
        lowest: currentRating || GLICKO_DEFAULTS.RATING,
        totalMatches: 0,
        netChange: 0
      };
    }
    const ratings = points.map(p => p.rating);
    const peak = Math.max(...ratings);
    const lowest = Math.min(...ratings);
    const first = points[0].rating;
    const last = points[points.length - 1].rating;
    return {
      peak,
      lowest,
      totalMatches: points.filter(p => !p.isBaseline).length,
      netChange: last - first
    };
  }, [points, currentRating]);

  // Chart dimensions
  const width = 640;
  const height = 220;
  const padLeft = 55;
  const padRight = 25;
  const padTop = 30;
  const padBottom = 35;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  // Rating range bounds
  const { minR, maxR, yTicks } = useMemo(() => {
    if (points.length === 0) {
      const base = currentRating || GLICKO_DEFAULTS.RATING;
      return { minR: base - 100, maxR: base + 100, yTicks: [base - 100, base, base + 100] };
    }
    const ratings = points.map(p => p.rating);
    let min = Math.min(...ratings);
    let max = Math.max(...ratings);

    if (max - min < 60) {
      const mid = Math.round((max + min) / 2);
      min = mid - 50;
      max = mid + 50;
    } else {
      const margin = Math.max(30, Math.round((max - min) * 0.15));
      min -= margin;
      max += margin;
    }

    const step = Math.round((max - min) / 4 / 25) * 25 || 25;
    const ticks = [];
    const startTick = Math.ceil(min / step) * step;
    for (let t = startTick; t <= max; t += step) {
      ticks.push(t);
    }

    return { minR: min, maxR: max, yTicks: ticks };
  }, [points, currentRating]);

  // Coordinate transforms
  const getX = React.useCallback((idx) => {
    if (points.length <= 1) return padLeft + chartW / 2;
    return padLeft + (idx / (points.length - 1)) * chartW;
  }, [points.length, chartW]);

  const getY = React.useCallback((rating) => {
    if (maxR === minR) return padTop + chartH / 2;
    const normalized = (rating - minR) / (maxR - minR);
    return padTop + chartH - normalized * chartH;
  }, [maxR, minR, chartH]);

  // Generate SVG path strings
  const { linePath, areaPath } = useMemo(() => {
    if (points.length === 0) return { linePath: '', areaPath: '' };
    if (points.length === 1) {
      const x = getX(0);
      const y = getY(points[0].rating);
      return { linePath: `M ${x} ${y}`, areaPath: '' };
    }

    let dLine = `M ${getX(0)} ${getY(points[0].rating)}`;
    for (let i = 1; i < points.length; i++) {
      const prevX = getX(i - 1);
      const prevY = getY(points[i - 1].rating);
      const curX = getX(i);
      const curY = getY(points[i].rating);
      const cX1 = prevX + (curX - prevX) / 2;
      const cY1 = prevY;
      const cX2 = prevX + (curX - prevX) / 2;
      const cY2 = curY;
      dLine += ` C ${cX1} ${cY1}, ${cX2} ${cY2}, ${curX} ${curY}`;
    }

    const firstX = getX(0);
    const lastX = getX(points.length - 1);
    const bottomY = padTop + chartH;
    const dArea = `${dLine} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

    return { linePath: dLine, areaPath: dArea };
  }, [points, getX, getY, chartH]);

  const rdValue = currentRd || points[points.length - 1]?.rd || GLICKO_DEFAULTS.RD;
  const isProvisional = rdValue > GLICKO_DEFAULTS.PROVISIONAL_RD_THRESHOLD;

  return (
    <div className="rating-history-card">
      <div className="rating-history-header">
        <div className="rating-title-group">
          <div className="rating-icon-box">
            <Activity size={20} className="text-accent" />
          </div>
          <div>
            <h3 className="rating-chart-title">Rating Progression</h3>
            <span className="rating-chart-sub">
              Rating over time
            </span>
          </div>
        </div>

        <div className="rating-summary-chips">
          <div className="rating-chip">
            <span className="rating-chip-label">Current</span>
            <span className="rating-chip-val text-primary">
              {currentRating || (points[points.length - 1]?.rating ?? GLICKO_DEFAULTS.RATING)}
              <span className="rd-badge-inline" title="Rating Deviation (uncertainty)">
                ±{rdValue} RD
              </span>
              {isProvisional && (
                <span className="provisional-pill" title="Provisional rating (fewer than ~15 games played)">
                  Provisional
                </span>
              )}
            </span>
          </div>

          <div className="rating-chip">
            <span className="rating-chip-label">Peak</span>
            <span className="rating-chip-val text-emerald">
              {stats.peak}
            </span>
          </div>

          <div className="rating-chip">
            <span className="rating-chip-label">Lowest</span>
            <span className="rating-chip-val text-muted">
              {stats.lowest}
            </span>
          </div>
        </div>
      </div>

      <div className="rating-chart-viewport">
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="rating-svg-canvas"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="ratingAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-blue, #6366f1)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="var(--accent-blue, #6366f1)" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="ratingLineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--accent-blue, #6366f1)" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines */}
          {yTicks.map(tick => {
            const y = getY(tick);
            return (
              <g key={tick} className="grid-tick-group">
                <line 
                  x1={padLeft} 
                  y1={y} 
                  x2={width - padRight} 
                  y2={y} 
                  className="chart-grid-line" 
                />
                <text 
                  x={padLeft - 10} 
                  y={y + 4} 
                  className="chart-axis-label"
                  textAnchor="end"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          {areaPath && (
            <path d={areaPath} fill="url(#ratingAreaGradient)" />
          )}

          {/* Line Path */}
          {linePath && (
            <path 
              d={linePath} 
              fill="none" 
              stroke="url(#ratingLineGradient)" 
              strokeWidth="3" 
              strokeLinecap="round"
              className="chart-stroke-line"
            />
          )}

          {/* Data Points */}
          {points.map((pt, idx) => {
            const cx = getX(idx);
            const cy = getY(pt.rating);
            const isHovered = hoveredPoint?.index === idx;

            return (
              <g 
                key={idx} 
                className="chart-point-group"
                onMouseEnter={() => setHoveredPoint({ ...pt, index: idx, cx, cy })}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                {/* Invisible hover target */}
                <circle cx={cx} cy={cy} r="14" fill="transparent" cursor="pointer" />
                {/* Visible dot */}
                <circle 
                  cx={cx} 
                  cy={cy} 
                  r={isHovered ? 6 : 4} 
                  className={`chart-data-dot ${isHovered ? 'chart-data-dot-active' : ''}`}
                />
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Popover */}
        {hoveredPoint && (
          <div 
            className="chart-tooltip-popover"
            style={{
              left: `${(hoveredPoint.cx / width) * 100}%`,
              top: `${(hoveredPoint.cy / height) * 100}%`
            }}
          >
            <div className="tooltip-header">
              <span className="tooltip-rating">
                {hoveredPoint.rating}
                <span className="tooltip-rd">±{hoveredPoint.rd || GLICKO_DEFAULTS.RD} RD</span>
              </span>
              {typeof hoveredPoint.delta === 'number' && hoveredPoint.delta !== 0 && (
                <span className={`tooltip-delta ${hoveredPoint.delta > 0 ? 'delta-pos' : 'delta-neg'}`}>
                  {hoveredPoint.delta > 0 ? `+${hoveredPoint.delta}` : hoveredPoint.delta}
                </span>
              )}
            </div>

            {hoveredPoint.result && (
              <div className="tooltip-match-meta">
                <span className={`tooltip-result-pill result-${hoveredPoint.result}`}>
                  {hoveredPoint.result.toUpperCase()}
                </span>
                {hoveredPoint.opponentName && (
                  <span className="tooltip-opponent">
                    vs {hoveredPoint.opponentName}
                  </span>
                )}
              </div>
            )}

            <div className="tooltip-time">
              {new Date(hoveredPoint.timestamp).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
        )}
      </div>

      {points.length <= 1 && (
        <div className="chart-empty-hint">
          <span>Play rated matches to build your rating history.</span>
        </div>
      )}
    </div>
  );
}
