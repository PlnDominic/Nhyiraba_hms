import React, { useEffect, useMemo, useState } from 'react';
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

const STATUS_ORDER = ['Available', 'Reserved', 'Occupied', 'Maintenance'];

const statusKey = (status) => {
  const s = String(status || '').toLowerCase();
  return STATUS_ORDER.find(k => k.toLowerCase() === s) || 'Other';
};

// Room picker: every room is colour-coded by availability, searchable, and the
// status legend doubles as a filter. Only available rooms can be selected.
export const RoomCards = ({ rooms, selectedId, onSelect, price, label, meta }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const counts = useMemo(() => {
    const c = { all: rooms.length };
    rooms.forEach(r => { const k = statusKey(r.status); c[k] = (c[k] || 0) + 1; });
    return c;
  }, [rooms]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rooms
      .filter(r => filter === 'all' || statusKey(r.status) === filter)
      .filter(r => !q || [label(r), meta(r), r.status, r.room_number, r.id].some(v => String(v ?? '').toLowerCase().includes(q)))
      .sort((a, b) => {
        const av = statusKey(a.status) === 'Available' ? 0 : 1;
        const bv = statusKey(b.status) === 'Available' ? 0 : 1;
        return av - bv || String(label(a)).localeCompare(String(label(b)), undefined, { numeric: true });
      });
  }, [rooms, query, filter, label, meta]);

  return (
    <div className="sm-picker">
      <div className="sm-picker-bar">
        <input
          className="sm-input sm-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
          placeholder="Search room number, type or status…"
          aria-label="Search rooms"
        />
        <div className="sm-legend" role="group" aria-label="Filter by availability">
          <button type="button" className={`sm-chip ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>
            All <span>{counts.all}</span>
          </button>
          {STATUS_ORDER.filter(k => counts[k]).map(k => (
            <button key={k} type="button" className={`sm-chip sm-chip--${k.toLowerCase()} ${filter === k ? 'is-active' : ''}`} onClick={() => setFilter(filter === k ? 'all' : k)}>
              <i className="sm-dot" />{k} <span>{counts[k]}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="sm-empty">{rooms.length === 0 ? 'No rooms found.' : 'No rooms match your search.'}</div>
      ) : (
        <div className="sm-rooms" role="radiogroup" aria-label="Rooms">
          {visible.map((room) => {
            const key = statusKey(room.status);
            const isFree = key === 'Available';
            const selected = String(selectedId) === String(room.id);
            const p = price(room);
            return (
              <button
                key={room.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-disabled={!isFree}
                disabled={!isFree}
                title={isFree ? `${label(room)} · Available` : `${label(room)} · ${room.status}`}
                className={`sm-room sm-room--${key.toLowerCase()} ${selected ? 'is-selected' : ''}`}
                onClick={() => isFree && onSelect(room.id)}
              >
                <span className="sm-room-head">
                  <span className="sm-room-id"><b>{label(room)}</b><small>{meta(room)}</small></span>
                  {p > 0 && <span className="sm-room-price">GH₵{p}</span>}
                </span>
                {!isFree && <span className="sm-room-chip">{room.status}</span>}
                <i className="sm-dot sm-dot--corner" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

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
