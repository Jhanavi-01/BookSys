'use client';

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
  WheelEvent,
} from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export type SeatStatus = 'available' | 'held' | 'sold' | 'blocked' | 'selected';

export interface Seat {
  id: string;
  row: string;
  number: number;
  x: number;
  y: number;
  status: SeatStatus;
  category: string;
  price: number;
  color?: string;
  section?: string;
}

interface SeatMapProps {
  seats: Seat[];
  selectedSeatIds: Set<string>;
  onSeatClick: (seat: Seat) => void;
  width?: number;
  height?: number;
  stageLabel?: string;
}

const STATUS_COLORS: Record<SeatStatus, string> = {
  available: '#3b82f6',
  held: '#f59e0b',
  sold: '#6b7280',
  blocked: '#374151',
  selected: '#a855f7',
};

const STATUS_PATTERNS: Record<SeatStatus, string> = {
  available: '',
  held: 'M-4,-4 L4,4 M-4,4 L4,-4',
  sold: 'M-4,0 L4,0 M0,-4 L0,4',
  blocked: 'M-4,-4 L4,4',
  selected: '',
};

const SEAT_RADIUS = 12;
const SEAT_GAP = 4;

export default function SeatMap({
  seats,
  selectedSeatIds,
  onSeatClick,
  width = 800,
  height = 600,
  stageLabel,
}: SeatMapProps) {
  const t = useTranslations('seats');
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: width, h: height });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [tooltip, setTooltip] = useState<{
    seat: Seat;
    x: number;
    y: number;
  } | null>(null);

  // Calculate bounds from seat data
  const bounds = useMemo(() => {
    if (seats.length === 0) return { minX: 0, minY: 0, maxX: width, maxY: height };
    const pad = SEAT_RADIUS * 3;
    const minX = Math.min(...seats.map((s) => s.x)) - pad;
    const minY = Math.min(...seats.map((s) => s.y)) - pad * 2;
    const maxX = Math.max(...seats.map((s) => s.x)) + pad;
    const maxY = Math.max(...seats.map((s) => s.y)) + pad;
    return { minX, minY, maxX, maxY };
  }, [seats, width, height]);

  useEffect(() => {
    setViewBox({
      x: bounds.minX,
      y: bounds.minY - 40,
      w: bounds.maxX - bounds.minX,
      h: bounds.maxY - bounds.minY + 40,
    });
  }, [bounds]);

  // Zoom with scroll wheel
  const handleWheel = useCallback(
    (e: WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const scale = e.deltaY > 0 ? 1.1 : 0.9;
      setViewBox((vb) => {
        const cx = vb.x + vb.w / 2;
        const cy = vb.y + vb.h / 2;
        const nw = vb.w * scale;
        const nh = vb.h * scale;
        return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
      });
    },
    []
  );

  // Pan with mouse/touch
  const handlePointerDown = useCallback(
    (e: ReactMouseEvent<SVGSVGElement> | ReactTouchEvent<SVGSVGElement>) => {
      const point = 'touches' in e ? e.touches[0] : e;
      setIsPanning(true);
      setPanStart({ x: point.clientX, y: point.clientY });
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: ReactMouseEvent<SVGSVGElement> | ReactTouchEvent<SVGSVGElement>) => {
      if (!isPanning || !svgRef.current) return;
      const point = 'touches' in e ? e.touches[0] : e;
      const svg = svgRef.current;
      const rect = svg.getBoundingClientRect();
      const dx = ((point.clientX - panStart.x) / rect.width) * viewBox.w;
      const dy = ((point.clientY - panStart.y) / rect.height) * viewBox.h;
      setViewBox((vb) => ({ ...vb, x: vb.x - dx, y: vb.y - dy }));
      setPanStart({ x: point.clientX, y: point.clientY });
    },
    [isPanning, panStart, viewBox.w, viewBox.h]
  );

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleZoomIn = () => {
    setViewBox((vb) => {
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      const nw = vb.w * 0.8;
      const nh = vb.h * 0.8;
      return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
    });
  };

  const handleZoomOut = () => {
    setViewBox((vb) => {
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      const nw = vb.w * 1.25;
      const nh = vb.h * 1.25;
      return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
    });
  };

  const handleResetView = () => {
    setViewBox({
      x: bounds.minX,
      y: bounds.minY - 40,
      w: bounds.maxX - bounds.minX,
      h: bounds.maxY - bounds.minY + 40,
    });
  };

  const handleSeatHover = useCallback(
    (seat: Seat, e: ReactMouseEvent<SVGCircleElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setTooltip({
          seat,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top - 60,
        });
      }
    },
    []
  );

  const handleSeatLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  // Group seats by status for efficient SVG rendering
  const seatsByStatus = useMemo(() => {
    const grouped: Record<string, Seat[]> = {};
    for (const seat of seats) {
      const status = selectedSeatIds.has(seat.id) ? 'selected' : seat.status;
      if (!grouped[status]) grouped[status] = [];
      grouped[status].push(seat);
    }
    return grouped;
  }, [seats, selectedSeatIds]);

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-dark-900/80 backdrop-blur-sm">
      {/* Controls */}
      <div className="absolute left-3 top-3 z-10 flex flex-col gap-1">
        <button
          onClick={handleZoomIn}
          className="rounded-lg border border-white/10 bg-white/5 p-2 text-sm font-bold text-gray-300 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white"
          title={t('map.zoomIn')}
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="rounded-lg border border-white/10 bg-white/5 p-2 text-sm font-bold text-gray-300 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white"
          title={t('map.zoomOut')}
        >
          -
        </button>
        <button
          onClick={handleResetView}
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-gray-300 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white"
          title={t('map.resetView')}
        >
          {t('map.resetView')}
        </button>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 rounded-lg border border-white/10 bg-dark-900/95 px-3 py-2 text-xs text-gray-200 shadow-lg backdrop-blur-sm"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translateX(-50%)' }}
        >
          <div className="font-semibold text-gray-100">
            {t('tooltip.row')} {tooltip.seat.row}, {t('tooltip.seat')} {tooltip.seat.number}
          </div>
          <div className="text-gray-400">
            {t('tooltip.category')}: {tooltip.seat.category}
          </div>
          <div className="text-accent-400">
            {t('tooltip.price')}: {(tooltip.seat.price || 0).toLocaleString()} VND
          </div>
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className={cn(
          'h-full w-full touch-none select-none',
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        )}
        style={{ minHeight: '400px', maxHeight: '70vh' }}
        onWheel={handleWheel}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        <defs>
          {/* Colorblind patterns */}
          {Object.entries(STATUS_PATTERNS).map(
            ([status, path]) =>
              path && (
                <pattern
                  key={status}
                  id={`pattern-${status}`}
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                >
                  <rect width="8" height="8" fill={STATUS_COLORS[status as SeatStatus]} />
                  <path d={path} stroke="white" strokeWidth="1.5" opacity="0.6" />
                </pattern>
              )
          )}
          {/* Glow filter for selected seats */}
          <filter id="glow-selected">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Stage */}
        <g>
          <rect
            x={bounds.minX + (bounds.maxX - bounds.minX) * 0.2}
            y={bounds.minY - 20}
            width={(bounds.maxX - bounds.minX) * 0.6}
            height={30}
            rx={6}
            fill="#6366f1"
            opacity={0.3}
          />
          <rect
            x={bounds.minX + (bounds.maxX - bounds.minX) * 0.2}
            y={bounds.minY - 20}
            width={(bounds.maxX - bounds.minX) * 0.6}
            height={30}
            rx={6}
            fill="none"
            stroke="#818cf8"
            strokeWidth={1}
            opacity={0.5}
          />
          <text
            x={bounds.minX + (bounds.maxX - bounds.minX) * 0.5}
            y={bounds.minY - 1}
            textAnchor="middle"
            fill="#c7d2fe"
            fontSize="14"
            fontWeight="bold"
          >
            {stageLabel || t('map.stage')}
          </text>
        </g>

        {/* Seats grouped by status for performance */}
        {Object.entries(seatsByStatus).map(([status, statusSeats]) => (
          <g key={status}>
            {statusSeats.map((seat) => {
              const seatStatus = selectedSeatIds.has(seat.id) ? 'selected' : seat.status;
              const color = seatStatus === 'available' && seat.color
                ? seat.color
                : STATUS_COLORS[seatStatus];
              const pattern = STATUS_PATTERNS[seatStatus];
              const isClickable = seat.status === 'available' || selectedSeatIds.has(seat.id);
              const isSelected = selectedSeatIds.has(seat.id);

              return (
                <circle
                  key={seat.id}
                  cx={seat.x}
                  cy={seat.y}
                  r={SEAT_RADIUS}
                  fill={pattern ? `url(#pattern-${seatStatus})` : color}
                  stroke={isSelected ? '#a5b4fc' : 'transparent'}
                  strokeWidth={isSelected ? 3 : 0}
                  filter={isSelected ? 'url(#glow-selected)' : undefined}
                  className={cn(
                    'transition-transform',
                    isClickable ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed'
                  )}
                  style={{ transformOrigin: `${seat.x}px ${seat.y}px` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isClickable) onSeatClick(seat);
                  }}
                  onMouseEnter={(e) => handleSeatHover(seat, e)}
                  onMouseLeave={handleSeatLeave}
                />
              );
            })}
          </g>
        ))}

        {/* Row labels */}
        {(() => {
          const rows = new Map<string, number>();
          for (const seat of seats) {
            if (!rows.has(seat.row)) {
              rows.set(seat.row, seat.y);
            }
          }
          return Array.from(rows.entries()).map(([row, y]) => (
            <text
              key={`label-${row}`}
              x={bounds.minX + 10}
              y={y + 4}
              fontSize="11"
              fill="#9ca3af"
              fontWeight="500"
            >
              {row}
            </text>
          ));
        })()}
      </svg>
    </div>
  );
}
