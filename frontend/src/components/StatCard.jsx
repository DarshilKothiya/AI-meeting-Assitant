import React from 'react';

const StatCard = ({ icon, label, value, subtitle, tone = 'blue' }) => {
  return (
    <div className="metric-card">
      <div className={`metric-icon-wrap icon-${tone}`}>
        {icon}
      </div>
      <div className="metric-info">
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
        {subtitle && <div className="metric-subtitle">{subtitle}</div>}
      </div>
    </div>
  );
};

export default StatCard;
