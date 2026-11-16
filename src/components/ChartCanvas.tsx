import React, { useEffect, useRef } from 'react';
import {
  Chart,
  type ChartConfiguration,
  type ChartType,
  registerables,
} from 'chart.js';

Chart.register(...registerables);

interface ChartCanvasProps<TType extends ChartType = ChartType> {
  config: ChartConfiguration<TType>;
  height?: number;
  className?: string;
}

export function ChartCanvas<TType extends ChartType = ChartType>({
  config,
  height = 280,
  className = '',
}: ChartCanvasProps<TType>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<TType> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    chartRef.current = new Chart(ctx, config);

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [config]);

  return (
    <div className={`relative w-full ${className}`} style={{ height }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
