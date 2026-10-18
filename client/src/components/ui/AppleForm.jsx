import React from 'react';
import '../../styles/AppleModal.css';

export const Group = ({ mode, children }) => (
  <div className={`apple-group apple-group--${mode}`}>{children}</div>
);

export const Row = ({ label, error, children, align }) => (
  <div className={`apple-row ${error ? 'apple-row--error' : ''}`} style={align ? { alignItems: align } : undefined}>
    {label && <span className="apple-row-label">{label}</span>}
    {children}
  </div>
);

export const Counter = ({ name, value, min, max, onChange }) => (
  <div className="apple-stepper" style={{ marginLeft: 'auto' }}>
    <button type="button" aria-label={`Decrease ${name}`} disabled={value <= min} onClick={() => onChange(Math.max(min, Number(value) - 1))}>−</button>
    <span className="apple-stepper-sep" />
    <button type="button" aria-label={`Increase ${name}`} disabled={value >= max} onClick={() => onChange(Math.min(max, Number(value) + 1))}>+</button>
  </div>
);

export const CloseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M1 1l10 10M11 1L1 11" />
  </svg>
);
