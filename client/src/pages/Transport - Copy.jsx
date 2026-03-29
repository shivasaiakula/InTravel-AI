import React, { useState } from 'react';
import axios from 'axios';
import { Plane, Train, Bus, MapPin, Search, ArrowRight, Clock, Tag } from 'lucide-react';
import './Transport.css';

const TransportIcon = ({ mode }) => {
    if (mode === 'Flight') return <Plane size={24} />;
    if (mode === 'Train') return <Train size={24} />;
    return <Bus size={24} />;
};

function Transport() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await axios.get(`/api/transport?from=${from}&to=${to}`);
      setResults(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

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
      </div>

      <div className="results-container">
        {loading ? <p>Searching routes...</p> : (
          results.length > 0 ? (
            results.map((res, idx) => (
              <div key={idx} className="transport-card glass-card fade-in">
                <div className="mode-badge"><TransportIcon mode={res.mode} /> {res.mode}</div>
                <div className="card-top">
                   <div className="city-info">
                     <h4>{res.from_city}</h4>
                     <p>Departure</p>
                   </div>
                   <div className="journey-info">
                     <div className="line" />
                     <p><Clock size={16} /> {res.duration}</p>
                   </div>
                   <div className="city-info">
                     <h4>{res.to_city}</h4>
                     <p>Arrival</p>
                   </div>
                </div>
                <div className="card-bottom">
                   <div className="price-tag"><Tag size={18} /> ₹{res.price}</div>
                   <button className="button-primary btn-sm">Book Ticket</button>
                </div>
              </div>
            ))
          ) : results.length === 0 && !loading && (
            <div className="no-results glass-card">
              <p>No direct routes found. Try searching for major cities like Delhi, Mumbai, Goa, or Jaipur.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default Transport;
