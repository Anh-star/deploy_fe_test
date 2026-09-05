import React from 'react';

/**
 * Reusable Date Range Filter with custom start/end date inputs ("Từ", "Đến").
 */
export default function ChartDateRangeFilter({
  startDate = '',
  endDate = '',
  onDateChange,
}) {
  const handleStartChange = (e) => {
    onDateChange(e.target.value, endDate);
  };

  const handleEndChange = (e) => {
    onDateChange(startDate, e.target.value);
  };

  const handleClear = () => {
    onDateChange('', '');
  };

  return (
    <div className="chart-date-filter-wrap">
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
