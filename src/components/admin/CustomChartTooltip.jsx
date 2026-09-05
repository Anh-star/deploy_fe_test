import React from 'react';

/**
 * Custom tooltip for Recharts BarChart with indicator dot, formatted value and percentage.
 */
export default function CustomChartTooltip({
  active,
  payload,
  label,
  unit = 'mục',
}) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0];
  const data = item.payload || {};
  const fill = data.fill || item.color || '#007AFF';
  const name = data.name || label || '';
  const value = item.value ?? data.count ?? 0;

  return (
    <div className="custom-chart-tooltip">
      <div className="custom-chart-tooltip-header">{name}</div>
      <div className="custom-chart-tooltip-body">
        <span className="tooltip-indicator" style={{ backgroundColor: fill }} />
        <span className="tooltip-value">
          {Number(value).toLocaleString('vi-VN')} {unit}
        </span>
      </div>
      {data.percentage !== undefined && (
        <div className="tooltip-sub">Tỷ lệ: {data.percentage}%</div>
      )}
      {data.description && (
        <div className="tooltip-sub" style={{ color: '#98A2B3' }}>
          {data.description}
        </div>
      )}
    </div>
  );
}
