import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CalendarDays, Hotel, Plane, RefreshCw, Wallet } from 'lucide-react';
import './Bookings.css';

function formatDateTime(value) {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatAmount(amount) {
    return `₹${(Number(amount) || 0).toLocaleString('en-IN')}`;
}

export default function Bookings() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('latest');
    const [actionId, setActionId] = useState('');
    const [actionMessage, setActionMessage] = useState('');
    const [cancelCandidate, setCancelCandidate] = useState(null);

    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem('user') || 'null');
        } catch {
            return null;
        }
    }, []);

    const fetchBookings = async () => {
        if (!user?.id) {
            setBookings([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError('');
        setActionMessage('');
        try {
            const params = { userId: user.id };
            if (filter !== 'all') params.type = filter;
            const { data } = await axios.get('/api/bookings', { params });
            setBookings(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err?.response?.data?.error || 'Could not load your bookings right now.');
            setBookings([]);
        } finally {
            setLoading(false);
        }
    };

    const handleBookAgain = async (booking) => {
        if (!user?.id) return;
        setActionId(`book-${booking.id}`);
        setError('');
        setActionMessage('');

        try {
            const { data } = await axios.post('/api/bookings', {
                type: booking.type,
                userId: user.id,
                title: `${booking.title} (Rebooked)`,
                city: booking.city,
                amount: Number(booking.amount) || 0,
                details: booking.details || {},
            });
            setActionMessage(`Booked again successfully. Booking ID: #${data?.id}`);
            fetchBookings();
        } catch (err) {
            setError(err?.response?.data?.error || 'Unable to rebook this reservation right now.');
        } finally {
            setActionId('');
        }
    };

    const handleCancelBooking = async (booking) => {
        if (!user?.id) return;
        setActionId(`cancel-${booking.id}`);
        setError('');
        setActionMessage('');

        try {
            await axios.delete(`/api/bookings/${booking.id}`, {
                params: { userId: user.id },
            });
            setActionMessage('Booking cancelled successfully.');
            setBookings((prev) => prev.map((item) => (
                item.id === booking.id ? { ...item, status: 'CANCELLED' } : item
            )));
        } catch (err) {
            setError(err?.response?.data?.error || 'Unable to cancel this booking right now.');
        } finally {
            setActionId('');
            setCancelCandidate(null);
        }
    };

    useEffect(() => {
        fetchBookings();
        // filter changes should reload booking list.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter, user?.id]);

    const totalAmount = bookings.reduce((sum, booking) => sum + (Number(booking.amount) || 0), 0);
    const totalHotels = bookings.filter((booking) => booking.type === 'hotel').length;
    const totalTransport = bookings.filter((booking) => booking.type === 'transport').length;

    const visibleBookings = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        let result = [...bookings];

        if (query) {
            result = result.filter((booking) => {
                const detailsText = JSON.stringify(booking?.details || {}).toLowerCase();
                return (
                    String(booking.title || '').toLowerCase().includes(query)
                    || String(booking.city || '').toLowerCase().includes(query)
                    || String(booking.type || '').toLowerCase().includes(query)
                    || detailsText.includes(query)
                );
            });
        }

        result.sort((a, b) => {
            const dateA = new Date(a.createdAt || 0).getTime();
            const dateB = new Date(b.createdAt || 0).getTime();
            if (sortOrder === 'oldest') return dateA - dateB;
            if (sortOrder === 'amount-high') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
            if (sortOrder === 'amount-low') return (Number(a.amount) || 0) - (Number(b.amount) || 0);
            return dateB - dateA;
        });

        return result;
    }, [bookings, searchQuery, sortOrder]);

    const getStatusLabel = (status) => {
        const normalized = String(status || 'CONFIRMED').trim().toUpperCase();
        return normalized === 'CANCELLED' ? 'Cancelled' : 'Confirmed';
    };

    const isCancelled = (booking) => String(booking?.status || '').trim().toUpperCase() === 'CANCELLED';

    const renderDetails = (booking) => {
        const details = booking?.details || {};
        if (booking.type === 'hotel') {
            return (
                <>
                    <span>Stay: {details.checkIn || '-'} to {details.checkOut || '-'}</span>
                    <span>Rooms: {details.rooms || 1} | Guests: {details.guests || 1}</span>
                </>
            );
        }

        return (
            <>
                <span>Route: {details.from || '-'} to {details.to || '-'}</span>
                <span>Date: {details.travelDate || '-'} | Passengers: {details.passengers || 1}</span>
            </>
        );
    };

    if (!user) {
        return (
            <div className="bookings-page section-container">
                <div className="bookings-login glass-card">
                    <h2 className="heading-gradient">Sign In to View Bookings</h2>
                    <p>Your hotel and transport ticket reservations will show up here.</p>
                    <a href="/login" className="button-primary">Sign In</a>
                </div>
            </div>
        );
    }

    return (
        <div className="bookings-page section-container">
            <div className="bookings-header glass-card">
                <div>
                    <h2 className="heading-gradient">My Bookings</h2>
                    <p>Track your hotel and transport ticket reservations.</p>
                </div>
                <button className="button-secondary btn-sm" onClick={fetchBookings} disabled={loading}>
                    <RefreshCw size={15} className={loading ? 'spin-icon' : ''} /> Refresh
                </button>
            </div>

            <div className="bookings-stats">
                <div className="booking-stat glass-card"><Wallet size={18} /> <span>{formatAmount(totalAmount)}</span><small>Total Booked</small></div>
                <div className="booking-stat glass-card"><Hotel size={18} /> <span>{totalHotels}</span><small>Hotels</small></div>
                <div className="booking-stat glass-card"><Plane size={18} /> <span>{totalTransport}</span><small>Tickets</small></div>
            </div>

            <div className="bookings-filter">
                {['all', 'hotel', 'transport'].map((type) => (
                    <button
                        key={type}
                        className={`chip ${filter === type ? 'active' : ''}`}
                        onClick={() => setFilter(type)}
                    >
                        {type === 'all' ? 'All' : type === 'hotel' ? 'Hotel' : 'Transport'}
                    </button>
                ))}
            </div>

            <div className="bookings-controls glass-card">
                <input
                    type="text"
                    placeholder="Search by title, city, route..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                />
                <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
                    <option value="latest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="amount-high">Amount: high to low</option>
                    <option value="amount-low">Amount: low to high</option>
                </select>
            </div>

            {error && <p className="bookings-error">{error}</p>}
            {actionMessage && <p className="bookings-success">{actionMessage}</p>}

            <div className="bookings-list">
                {loading ? (
                    <div className="bookings-empty glass-card">Loading bookings...</div>
                ) : visibleBookings.length === 0 ? (
                    <div className="bookings-empty glass-card">No bookings found for this filter.</div>
                ) : (
                    visibleBookings.map((booking) => (
                        <div className="booking-item glass-card" key={booking.id}>
                            <div className="booking-title-row">
                                <h4>{booking.title}</h4>
                                <div className="booking-badges">
                                    <span className={`booking-type ${booking.type}`}>{booking.type === 'hotel' ? 'Hotel' : 'Transport'}</span>
                                    <span className={`booking-status ${getStatusLabel(booking.status).toLowerCase()}`}>{getStatusLabel(booking.status)}</span>
                                </div>
                            </div>
                            <div className="booking-meta">
                                <span>{formatAmount(booking.amount)}</span>
                                <span>{booking.city}</span>
                                <span><CalendarDays size={14} /> {formatDateTime(booking.createdAt)}</span>
                            </div>
                            <div className="booking-details">
                                {renderDetails(booking)}
                            </div>
                            <div className="booking-actions">
                                <button
                                    className="button-secondary btn-sm"
                                    onClick={() => handleBookAgain(booking)}
                                    disabled={Boolean(actionId)}
                                >
                                    {actionId === `book-${booking.id}` ? 'Booking...' : 'Book Again'}
                                </button>
                                <button
                                    className="button-secondary btn-sm booking-cancel"
                                    onClick={() => setCancelCandidate(booking)}
                                    disabled={Boolean(actionId) || isCancelled(booking)}
                                >
                                    {actionId === `cancel-${booking.id}` ? 'Cancelling...' : (isCancelled(booking) ? 'Cancelled' : 'Cancel Booking')}
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {cancelCandidate && (
                <div className="cancel-modal-overlay" onClick={() => setCancelCandidate(null)}>
                    <div className="cancel-modal glass-card" onClick={(event) => event.stopPropagation()}>
                        <h3>Cancel this booking?</h3>
                        <p>
                            {cancelCandidate.title}
                        </p>
                        <div className="cancel-modal-actions">
                            <button className="button-secondary btn-sm" onClick={() => setCancelCandidate(null)} disabled={Boolean(actionId)}>
                                Keep Booking
                            </button>
                            <button
                                className="button-secondary btn-sm booking-cancel"
                                onClick={() => handleCancelBooking(cancelCandidate)}
                                disabled={Boolean(actionId)}
                            >
                                {actionId === `cancel-${cancelCandidate.id}` ? 'Cancelling...' : 'Confirm Cancel'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}