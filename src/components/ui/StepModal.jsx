import React, { useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../../styles/StepModal.css';

// Dialog with a step rail on the left, the current step in the middle and an
// action bar at the bottom. Everything stays inside the modal window.
export const StepModal = ({
  isOpen, onClose, isDarkMode, title, steps, current, recap, total,
  onBack, onNext, nextLabel, finalStep, busy, backLabel, children
}) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    // Esc closes an open calendar first, and only then the modal
    const onKey = (e) => {
      if (e.key === 'Escape' && !document.querySelector('.react-datepicker-popper')) onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isFirst = current === 0;
  return (
    <div className="sm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`sm-sheet ${isDarkMode ? 'sm-sheet--dark' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sm-header">
          <div className="sm-brand">Nhyiraba Hotel <span>/ {title}</span></div>
          <button type="button" className="sm-close" onClick={onClose} aria-label="Close">✕ Close</button>
        </div>

        <div className="sm-main">
          <nav className="sm-rail" aria-label="Progress">
            <div className="sm-steps">
              {steps.map((label, i) => (
                <div key={label} className={`sm-step ${i < current ? 'is-done' : ''} ${i === current ? 'is-current' : ''}`} aria-current={i === current ? 'step' : undefined}>
                  <span className="sm-step-dot">{i < current ? '✓' : i + 1}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            {recap && recap.length > 0 && (
              <dl className="sm-recap">
                {recap.map(({ label, value }) => (
                  <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                ))}
              </dl>
            )}
          </nav>

          <div className="sm-content">
            <div className="sm-content-inner" key={current}>{children}</div>
          </div>
        </div>

        <div className="sm-footer">
          <button type="button" className="sm-btn" onClick={isFirst ? onClose : onBack} disabled={busy}>
            {isFirst ? 'Cancel' : (backLabel || 'Back')}
          </button>
          {total && <div className="sm-total">{total.label}<b>{total.value}</b></div>}
          <button type="button" className={`sm-btn ${finalStep ? 'sm-btn--success' : 'sm-btn--primary'}`} onClick={onNext} disabled={busy}>
            {nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const Step = ({ title, lead, children }) => (
  <>
    <h1 className="sm-h1">{title}</h1>
    {lead && <p className="sm-lead">{lead}</p>}
    {children}
  </>
);

export const Field = ({ label, error, hint, span, children }) => (
  <div className={`sm-field ${span ? 'sm-span' : ''} ${error ? 'sm-field--error' : ''}`}>
    {label && <label className="sm-label">{label}</label>}
    {children}
    {error ? <p className="sm-error">{error}</p> : hint ? <p className="sm-hint">{hint}</p> : null}
  </div>
);

export const Counter = ({ name, value, min, max, onChange }) => (
  <div className="sm-counter">
    <button type="button" aria-label={`Decrease ${name}`} disabled={value <= min} onClick={() => onChange(Math.max(min, Number(value) - 1))}>−</button>
    <output>{value}</output>
    <button type="button" aria-label={`Increase ${name}`} disabled={value >= max} onClick={() => onChange(Math.min(max, Number(value) + 1))}>+</button>
  </div>
);

export const RoomCards = ({ rooms, selectedId, onSelect, price, label, meta }) => (
  rooms.length === 0
    ? <div className="sm-empty">No rooms are available right now.</div>
    : (
      <div className="sm-rooms" role="radiogroup" aria-label="Available rooms">
        {rooms.map((room) => (
          <button key={room.id} type="button" role="radio" aria-checked={String(selectedId) === String(room.id)}
            className={`sm-room ${String(selectedId) === String(room.id) ? 'is-selected' : ''}`} onClick={() => onSelect(room.id)}>
            <div className="sm-room-name">{label(room)}</div>
            <div className="sm-room-meta">{meta(room)}</div>
            {price(room) > 0 && <div className="sm-room-price">₵{price(room)}<small> /night</small></div>}
          </button>
        ))}
      </div>
    )
);

export const DateInput = ({ selected, onChange, minDate, error }) => (
  <DatePicker
    selected={selected}
    onChange={onChange}
    minDate={minDate}
    className="sm-input"
    dateFormat="EEE, d MMM yyyy"
    popperProps={{ strategy: 'fixed' }}
    aria-invalid={!!error}
  />
);

export const ReviewList = ({ rows }) => (
  <div className="sm-review">
    {rows.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
  </div>
);
