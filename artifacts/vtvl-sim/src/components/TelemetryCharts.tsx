import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TelemetrySample } from '../hooks/useSimulation';
import { VehicleConfig } from '../lib/physics';

interface TelemetryChartsProps {
  telemetry: TelemetrySample[];
  vehicle: VehicleConfig;
  missionFuel: number;
}

interface ChartDef {
  key: 'altitude' | 'velocity' | 'throttle' | 'fuel';
  label: string;
  color: string;
  unit: string;
  domain?: [number | 'auto', number | 'auto'];
  tickFormat?: (v: number) => string;
}

const CHARTS: ChartDef[] = [
  { key: 'altitude', label: 'Altitude', color: '#f59e0b', unit: 'm' },
  { key: 'velocity', label: 'Vertical Velocity', color: '#60a5fa', unit: 'm/s' },
  {
    key: 'throttle',
    label: 'Throttle',
    color: '#34d399',
    unit: '%',
    domain: [0, 100],
  },
  { key: 'fuel', label: 'Fuel', color: '#fb923c', unit: 'kg' },
];

const tooltipStyle = {
  background: 'rgba(2, 6, 23, 0.95)',
  border: '1px solid rgb(30, 41, 59)',
  borderRadius: 4,
  fontSize: 10,
  fontFamily: 'ui-monospace, Menlo, monospace',
  color: '#e2e8f0',
  padding: '4px 8px',
};

export function TelemetryCharts({ telemetry, vehicle, missionFuel }: TelemetryChartsProps) {
  const [open, setOpen] = useState(true);

  // Project the raw telemetry stream into the four series shown in the panel.
  // Done once per render to keep the recharts components dumb / pure.
  const data = useMemo(() => {
    return telemetry.map((s) => ({
      t: Number(s.t.toFixed(2)),
      altitude: Math.max(0, s.altitude),
      velocity: s.vy,
      throttle: s.throttle * 100,
      fuel: s.fuel,
    }));
  }, [telemetry]);

  const fuelMax = Math.max(missionFuel, vehicle.fuelMass);

  return (
    <div
      className="absolute bottom-6 right-4 z-20 w-[320px] max-w-[calc(100vw-2rem)] bg-black/85 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-md flex flex-col"
      data-testid="panel-telemetry"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between px-4 py-2 border-b border-slate-800 hover:bg-slate-900/40 transition-colors rounded-t-xl"
        data-testid="button-toggle-telemetry"
      >
        <div className="flex flex-col items-start">
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-amber-500/80">
            Flight Recorder
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            {data.length > 0
              ? `${data.length} samples · t=${data[data.length - 1].t.toFixed(1)}s`
              : 'Awaiting launch'}
          </span>
        </div>
        <span className="text-slate-500 text-sm">{open ? '–' : '+'}</span>
      </button>

      {open && (
        <div className="p-3 flex flex-col gap-3">
          {CHARTS.map((chart) => {
            const last = data.length > 0 ? data[data.length - 1][chart.key] : 0;
            const formattedLast =
              chart.key === 'fuel'
                ? Math.round(last as number).toLocaleString()
                : (last as number).toFixed(1);
            const yDomain: [number | 'auto', number | 'auto'] =
              chart.domain ??
              (chart.key === 'fuel'
                ? [0, fuelMax]
                : chart.key === 'altitude'
                ? [0, 'auto']
                : ['auto', 'auto']);

            const ChartImpl = chart.key === 'altitude' || chart.key === 'fuel' ? AreaChart : LineChart;

            return (
              <div key={chart.key} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between text-[10px] font-mono">
                  <span className="text-slate-400 uppercase tracking-wider">{chart.label}</span>
                  <span style={{ color: chart.color }}>
                    {formattedLast}
                    <span className="text-slate-500 ml-1">{chart.unit}</span>
                  </span>
                </div>
                <div className="h-20 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ChartImpl data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`grad-${chart.key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={chart.color} stopOpacity={0.6} />
                          <stop offset="100%" stopColor={chart.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="2 4" />
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        tick={{ fill: '#475569', fontSize: 9, fontFamily: 'ui-monospace' }}
                        tickFormatter={(v) => `${Math.round(v)}s`}
                        stroke="#1e293b"
                        minTickGap={30}
                      />
                      <YAxis
                        domain={yDomain}
                        tick={{ fill: '#475569', fontSize: 9, fontFamily: 'ui-monospace' }}
                        stroke="#1e293b"
                        width={32}
                        tickFormatter={(v: number) => {
                          if (chart.key === 'fuel') {
                            return v >= 1000 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`;
                          }
                          if (chart.key === 'altitude') {
                            return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`;
                          }
                          return Math.round(v).toString();
                        }}
                      />
                      {chart.key === 'velocity' && (
                        <ReferenceLine y={0} stroke="#475569" strokeDasharray="2 2" />
                      )}
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={{ color: '#94a3b8' }}
                        labelFormatter={(v) => `t = ${Number(v).toFixed(1)}s`}
                        formatter={(value: number) => [
                          chart.key === 'fuel'
                            ? Math.round(value).toLocaleString()
                            : Number(value).toFixed(1),
                          chart.label,
                        ]}
                        cursor={{ stroke: '#475569', strokeWidth: 1 }}
                        isAnimationActive={false}
                      />
                      {ChartImpl === AreaChart ? (
                        <Area
                          type="monotone"
                          dataKey={chart.key}
                          stroke={chart.color}
                          strokeWidth={1.5}
                          fill={`url(#grad-${chart.key})`}
                          isAnimationActive={false}
                          dot={false}
                        />
                      ) : (
                        <Line
                          type="monotone"
                          dataKey={chart.key}
                          stroke={chart.color}
                          strokeWidth={1.5}
                          isAnimationActive={false}
                          dot={false}
                        />
                      )}
                    </ChartImpl>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}

          {data.length === 0 && (
            <div className="text-center text-[10px] font-mono text-slate-600 py-4">
              Charts populate once the engines light.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
