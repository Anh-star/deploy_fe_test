import React from 'react';

/**
 * Reusable Date Range Filter with quick presets ("Tất cả", "7 ngày qua", "30 ngày qua")
 * and custom start/end date inputs ("Từ ngày", "Đến ngày").
 */
export default function ChartDateRangeFilter({
  startDate = '',
  endDate = '',
  onDateChange,
  preset = 'ALL',
}) {
  const pad = (n) => String(n).padStart(2, '0');
  const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const handlePreset = (p) => {
    const today = new Date();
    if (p === 'ALL') {
      onDateChange('', '', 'ALL');
    } else if (p === '7DAYS') {
      const past = new Date();
      past.setDate(today.getDate() - 7);
      onDateChange(toDateStr(past), toDateStr(today), '7DAYS');
    } else if (p === '30DAYS') {
      const past = new Date();
      past.setDate(today.getDate() - 30);
      onDateChange(toDateStr(past), toDateStr(today), '30DAYS');
    }
  };

  const handleStartChange = (e) => {
    onDateChange(e.target.value, endDate, 'CUSTOM');
  };

  const handleEndChange = (e) => {
    onDateChange(startDate, e.target.value, 'CUSTOM');
  };

  const handleClear = () => {
    onDateChange('', '', 'ALL');
  };

  return (
    <div className="chart-date-filter-wrap">
      <div className="chart-filter-pills">
        <button
          type="button"
          className={`chart-filter-btn ${preset === 'ALL' ? 'active' : ''}`}
          onClick={() => handlePreset('ALL')}
        >
          Tất cả
        </button>
        <button
          type="button"
          className={`chart-filter-btn ${preset === '7DAYS' ? 'active' : ''}`}
          onClick={() => handlePreset('7DAYS')}
        >
          7 ngày qua
        </button>
        <button
          type="button"
          className={`chart-filter-btn ${preset === '30DAYS' ? 'active' : ''}`}
          onClick={() => handlePreset('30DAYS')}
        >
          30 ngày qua
        </button>
      </div>

      <div className="chart-date-inputs">
        <span className="chart-date-label">Từ:</span>
        <input
          type="date"
          className="chart-date-input"
          value={startDate || ''}
          max={endDate || undefined}
          onChange={handleStartChange}
          aria-label="Từ ngày"
        />
        <span className="chart-date-sep">—</span>
        <span className="chart-date-label">Đến:</span>
        <input
          type="date"
          className="chart-date-input"
          value={endDate || ''}
          min={startDate || undefined}
          onChange={handleEndChange}
          aria-label="Đến ngày"
        />
        {(startDate || endDate) && (
          <button
            type="button"
            className="chart-date-clear-btn"
            onClick={handleClear}
            title="Xóa khoảng ngày đã chọn"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
