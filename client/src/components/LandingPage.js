import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const FEATURES = [
  { icon: 'fa-calendar-check', title: 'Reservations & check-in', text: 'Book, confirm and check guests in with room conflicts caught before they happen.' },
  { icon: 'fa-bed', title: 'Live room board', text: 'See which rooms are available, occupied or being cleaned, updated as it changes.' },
  { icon: 'fa-broom', title: 'Housekeeping & maintenance', text: 'Assign cleaning and repairs, and keep rooms out of circulation until they are ready.' },
  { icon: 'fa-comment-sms', title: 'Guest SMS updates', text: 'Confirmations and reminders go to guests automatically at every stage of their stay.' },
  { icon: 'fa-chart-line', title: 'Reports that matter', text: 'Occupancy, revenue and activity at a glance for managers and the board.' },
  { icon: 'fa-wifi', title: 'Works offline', text: 'Keep working when the connection drops; changes sync as soon as it returns.' }
];

function LandingPage() {
  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-brand">
          <img src="/logo256.png" alt="" />
          <span>Nhyiraba</span>
        </div>
        <nav className="lp-nav-actions" aria-label="Account">
          <Link to="/request-access" className="lp-btn lp-btn-ghost lp-btn-sm">Request access</Link>
          <Link to="/login" className="lp-btn lp-btn-primary lp-btn-sm">Log in</Link>
        </nav>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-bg" style={{ background: "url(/hero1.jpg) center 40% / cover no-repeat" }} role="img" aria-label="Nhyiraba Hotel swimming pool at night" />
          <div className="lp-hero-inner">
            <span className="lp-eyebrow"><i className="fas fa-star" aria-hidden="true" /> Hotel management system</span>
            <h1 className="lp-title">Run Nhyiraba Hotel with <em>calm</em> and confidence</h1>
            <p className="lp-lead">
              One place for reservations, rooms, guests, housekeeping and reports, built for the front desk and the team behind it.
            </p>
            <div className="lp-cta">
              <Link to="/login" className="lp-btn lp-btn-primary"><i className="fas fa-right-to-bracket" aria-hidden="true" /> Log in to dashboard</Link>
              <Link to="/request-access" className="lp-btn lp-btn-ghost"><i className="fas fa-user-plus" aria-hidden="true" /> Request access</Link>
            </div>
            <div className="lp-stats">
              <div className="lp-stat"><strong>24/7</strong><span>Front desk ready</span></div>
              <div className="lp-stat"><strong>Real-time</strong><span>Room status</span></div>
              <div className="lp-stat"><strong>Offline</strong><span>Safe to keep working</span></div>
            </div>
          </div>
        </section>

        <section className="lp-section" aria-labelledby="lp-features">
          <div className="lp-section-inner">
            <h2 id="lp-features">Everything the hotel needs, in one system</h2>
            <p className="lp-section-lead">From the first booking to checkout and the reports after, every team works from the same up-to-date picture.</p>
            <div className="lp-grid">
              {FEATURES.map((f) => (
                <article key={f.title} className="lp-card">
                  <div className="lp-icon"><i className={`fas ${f.icon}`} aria-hidden="true" /></div>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-band" aria-label="Get started">
          <div>
            <h2>Part of the team?</h2>
            <p>Sign in to get to today's arrivals, rooms and tasks.</p>
          </div>
          <Link to="/login" className="lp-btn lp-btn-light">Log in</Link>
        </section>
      </main>

      <footer className="lp-foot">
        Powered by <strong>Ecstasy Geospatial Services</strong>
      </footer>
    </div>
  );
}

export default LandingPage;
