import React, { useState } from 'react';
import axios from 'axios';
import { Plane, Train, Bus, MapPin, Search, ArrowRight, Clock, Tag } from 'lucide-react';
import {
  BEST_VALUE_WEIGHTS,
  BEST_VALUE_FORMULA_HINT,
  BEST_VALUE_FORMULA_TOOLTIP,
  getMinMax,
  scoreHigherBetter,
  scoreLowerBetter,
  weightedScore,
} from '../utils/valueScore';
import './Transport.css';

const TransportIcon = ({ mode }) => {
  if (mode === 'Flight') return <Plane size={24} />;
  if (mode === 'Train') return <Train size={24} />;
  return <Bus size={24} />;
};

const parseDurationMinutes = (duration) => {
  const value = String(duration || '').toLowerCase();
  const hoursMatch = value.match(/(\d+)\s*h/);
  const minsMatch = value.match(/(\d+)\s*m/);
  const hours = hoursMatch ? Number(hoursMatch[1]) : 0;
  const mins = minsMatch ? Number(minsMatch[1]) : 0;
  const total = (hours * 60) + mins;
  return total > 0 ? total : 180;
};

function Transport() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [travelDate, setTravelDate] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [seatClass, setSeatClass] = useState('Economy');
  const [sortBy, setSortBy] = useState('price');
  const [showCheapestOnly, setShowCheapestOnly] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bookingKey, setBookingKey] = useState('');
  const [bookingMessage, setBookingMessage] = useState('');
  const [bookingError, setBookingError] = useState('');

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  })();

  const routeValue = (route, primary, fallback) => route?.[primary] || route?.[fallback] || '';

  const buildRouteKey = (route) => {
    return [
      routeValue(route, 'from_city', 'from'),
      routeValue(route, 'to_city', 'to'),
      route?.mode || '',
      route?.price || 0,
      route?.operator || '',
    ].join('|');
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setBookingMessage('');
    setBookingError('');
    setLoading(true);
    try {
      const { data } = await axios.get(`/api/transport?from=${from}&to=${to}`);
      setResults(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleBookTicket = async (route) => {
    if (!travelDate) {
      setBookingError('Please select a travel date before booking.');
      setBookingMessage('');
      return;
    }

    const key = buildRouteKey(route);
    const fromCity = routeValue(route, 'from_city', 'from');
    const toCity = routeValue(route, 'to_city', 'to');
    const price = Number(route?.price) || 0;
    const totalAmount = price * Math.max(1, Number(passengers) || 1);

    setBookingKey(key);
    setBookingError('');
    setBookingMessage('');

    try {
      const { data } = await axios.post('/api/bookings', {
        type: 'transport',
        userId: user?.id || null,
        title: `${route?.mode || 'Transport'} ticket: ${fromCity} to ${toCity}`,
        city: toCity || to,
        amount: totalAmount,
        details: {
          from: fromCity,
          to: toCity,
          mode: route?.mode,
          duration: route?.duration,
          operator: route?.operator,
          travelDate,
          passengers,
          seatClass,
          unitPrice: price,
        },
      });

      setBookingMessage(`Ticket booked successfully. Booking ID: #${data?.id}`);
      setBookingError('');
    } catch (err) {
      setBookingError(err?.response?.data?.error || 'Unable to complete ticket booking right now.');
      setBookingMessage('');
    } finally {
      setBookingKey('');
    }
  };

  const prices = results.map((route) => Number(route?.price) || 0);
  const reliabilities = results.map((route) => Number(route?.realityScore) || 0);
  const durations = results.map((route) => parseDurationMinutes(route?.duration));

  const { min: minPrice, max: maxPrice } = getMinMax(prices);
  const { min: minReliability, max: maxReliability } = getMinMax(reliabilities);
  const { min: minDuration, max: maxDuration } = getMinMax(durations);

  const routesWithScore = results.map((route) => {
    const price = Number(route?.price) || 0;
    const reliability = Number(route?.realityScore) || 0;
    const durationMinutes = parseDurationMinutes(route?.duration);

    const priceScore = scoreLowerBetter(price, minPrice, maxPrice);
    const reliabilityScore = scoreHigherBetter(reliability, minReliability, maxReliability);
    const durationScore = scoreLowerBetter(durationMinutes, minDuration, maxDuration);

    const bestValueScore = weightedScore([
      { score: priceScore, weight: BEST_VALUE_WEIGHTS.price },
      { score: reliabilityScore, weight: BEST_VALUE_WEIGHTS.quality },
      { score: durationScore, weight: BEST_VALUE_WEIGHTS.convenience },
    ]);

    return {
      ...route,
      durationMinutes,
      bestValueScore,
    };
  });

  const displayRoutes = [...routesWithScore].sort((a, b) => {
    if (sortBy === 'reliability') {
      return (Number(b?.realityScore) || 0) - (Number(a?.realityScore) || 0);
    }
    if (sortBy === 'duration') {
      return (Number(a?.durationMinutes) || 0) - (Number(b?.durationMinutes) || 0);
    }
    if (sortBy === 'best-value') {
      return (Number(b?.bestValueScore) || 0) - (Number(a?.bestValueScore) || 0);
    }
    return (Number(a?.price) || 0) - (Number(b?.price) || 0);
  });

  const topBestValueRoute = displayRoutes.length > 0
    ? [...displayRoutes].sort((a, b) => (Number(b?.bestValueScore) || 0) - (Number(a?.bestValueScore) || 0))[0]
    : null;

  const cheapestRoutePrice = displayRoutes.length > 0
    ? Math.min(...displayRoutes.map((route) => Number(route?.price) || 0))
    : 0;

  const visibleRoutes = showCheapestOnly
    ? displayRoutes.filter((route) => (Number(route?.price) || 0) === cheapestRoutePrice)
    : displayRoutes;

  return (
    <div className="transport-page section-container">
      <div className="search-section glass-card">
        <h2 className="heading-gradient">Find Your Route</h2>
        <p>Search for the best city-to-city transport options across India.</p>
        <form onSubmit={handleSearch} className="route-form">
          <div className="input-field">
            <MapPin size={22} />
            <input
              type="text"
              placeholder="Origin City (e.g. Delhi)"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              required
            />
          </div>
          <ArrowRight className="divider-icon" />
          <div className="input-field">
            <MapPin size={22} />
            <input
              type="text"
              placeholder="Destination City (e.g. Mumbai)"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="button-primary"><Search size={22} /> Search</button>
        </form>

        <div className="booking-controls">
          <div className="booking-control">
            <label htmlFor="travel-date">Travel Date</label>
            <input
              id="travel-date"
              type="date"
              value={travelDate}
              onChange={(e) => setTravelDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div className="booking-control">
            <label htmlFor="passengers">Passengers</label>
            <input
              id="passengers"
              type="number"
              min="1"
              max="9"
              value={passengers}
              onChange={(e) => setPassengers(Math.max(1, Math.min(9, Number(e.target.value) || 1)))}
            />
          </div>
          <div className="booking-control">
            <label htmlFor="seat-class">Class</label>
            <select id="seat-class" value={seatClass} onChange={(e) => setSeatClass(e.target.value)}>
              <option>Economy</option>
              <option>Premium Economy</option>
              <option>Business</option>
            </select>
          </div>
          <div className="booking-control">
            <label htmlFor="route-sort">Sort routes</label>
            <select id="route-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="price">Lowest price</option>
              <option value="reliability">Most reliable</option>
              <option value="duration">Fastest duration</option>
              <option value="best-value">Best value (price + reliability)</option>
            </select>
          </div>
          <div className="booking-control">
            <label>Compare</label>
            <button
              type="button"
              className={`chip compare-chip ${showCheapestOnly ? 'active' : ''}`}
              onClick={() => setShowCheapestOnly((prev) => !prev)}
            >
              {showCheapestOnly ? 'Showing cheapest only' : 'Show only cheapest'}
            </button>
          </div>
        </div>

        {bookingMessage && <p className="booking-success">{bookingMessage}</p>}
        {bookingError && <p className="booking-error">{bookingError}</p>}
      </div>

      <div className="results-container">
        {displayRoutes.length > 0 && (
          <div className="compare-summary glass-card-sm">
            Compare by price: cheapest route is <strong>Rs {cheapestRoutePrice.toLocaleString('en-IN')}</strong>.
            {topBestValueRoute && (
              <span className="best-value-summary">
                Best value score: <strong>{topBestValueRoute.bestValueScore}/100</strong> ({routeValue(topBestValueRoute, 'from_city', 'from')} to {routeValue(topBestValueRoute, 'to_city', 'to')}).
                <span className="best-value-help" title={BEST_VALUE_FORMULA_TOOLTIP}>How it is scored: {BEST_VALUE_FORMULA_HINT}</span>
              </span>
            )}
          </div>
        )}
        {loading ? <p>Searching routes...</p> : (
          visibleRoutes.length > 0 ? (
            visibleRoutes.map((res, idx) => (
              <div key={idx} className="transport-card glass-card fade-in">
                <div className="mode-badge"><TransportIcon mode={res.mode} /> {res.mode}</div>
                <div className="reality-pill" title="Route reliability score">
                  Reliability {Number(res?.realityScore) || 0}/100
                </div>
                {topBestValueRoute && buildRouteKey(res) === buildRouteKey(topBestValueRoute) && (
                  <div className="best-value-pill" title="Best value route based on price, reliability, and duration">
                    Best value {res.bestValueScore}/100
                  </div>
                )}
                <div className="card-top">
                  <div className="city-info">
                    <h4>{routeValue(res, 'from_city', 'from')}</h4>
                    <p>Departure</p>
                  </div>
                  <div className="journey-info">
                    <div className="line" />
                    <p><Clock size={16} /> {res.duration}</p>
                  </div>
                  <div className="city-info">
                    <h4>{routeValue(res, 'to_city', 'to')}</h4>
                    <p>Arrival</p>
                  </div>
                </div>
                {Array.isArray(res?.riskFactors) && res.riskFactors.length > 0 && (
                  <div className="risk-list">
                    {res.riskFactors.slice(0, 3).map((factor) => (
                      <span key={factor} className="risk-chip">{factor}</span>
                    ))}
                  </div>
                )}
                <div className="card-bottom">
                  <div>
                    <div className="price-tag"><Tag size={18} /> ₹{res.price}</div>
                    <div className="price-compare-row">
                      {(Number(res?.price) || 0) === cheapestRoutePrice ? (
                        <span className="cheapest-chip">Cheapest</span>
                      ) : (
                        <span className="price-delta">+₹{((Number(res?.price) || 0) - cheapestRoutePrice).toLocaleString('en-IN')} vs cheapest</span>
                      )}
                    </div>
                  </div>
                  <button
                    className="button-primary btn-sm"
                    onClick={() => handleBookTicket(res)}
                    disabled={bookingKey === buildRouteKey(res)}
                  >
                    {bookingKey === buildRouteKey(res) ? 'Booking...' : 'Book Ticket'}
                  </button>
                </div>
              </div>
            ))
          ) : !loading && (
            <div className="no-results glass-card">
              <p>{displayRoutes.length === 0 ? 'No direct routes found. Try searching for major cities like Delhi, Mumbai, Goa, or Jaipur.' : 'No routes match the cheapest filter.'}</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default Transport;
