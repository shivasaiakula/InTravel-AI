import React, { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { CalendarDays, Hotel, Plane, RefreshCw, Wallet, CheckCircle, AlertCircle, MapPin, Users, BusFront, Clock3, Route, Star } from 'lucide-react';
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

function buildLocalTransportFallback(from, to, travelDate) {
    const operators = ['Orange Travels', 'VRL', 'SRS', 'Kaveri', 'Morning Star', 'Jabbar'];
    const busTypes = ['AC Sleeper', 'Volvo Multi-Axle', 'Seater AC', 'Non-AC Sleeper', 'AC Semi-Sleeper'];
    const departures = ['18:30', '19:15', '20:00', '21:10', '22:00', '23:05'];
    const arrivals = ['03:45', '04:20', '05:10', '05:55', '06:20', '07:00'];
    const baseFare = 550 + Math.min(450, Math.abs(String(from).length - String(to).length) * 35);

    const seatLayout = (seed) => ({
        lower: Array.from({ length: 16 }, (_, idx) => {
            const n = idx + 1;
            return { id: `L${n}`, available: ((seed + n) % 5) !== 0 };
        }),
        upper: Array.from({ length: 12 }, (_, idx) => {
            const n = idx + 1;
            return { id: `U${n}`, available: ((seed + n * 2) % 6) !== 0 };
        }),
    });

    return Array.from({ length: 6 }, (_, index) => ({
        id: `${from}-${to}-${travelDate}-${index}`,
        operator: operators[index % operators.length],
        busType: busTypes[index % busTypes.length],
        departure: departures[index % departures.length],
        arrival: arrivals[index % arrivals.length],
        duration: `${7 + (index % 3)}h ${index % 2 === 0 ? '45m' : '15m'}`,
        rating: (4.0 + (index % 5) * 0.12).toFixed(1),
        seatsLeft: 8 + index * 3,
        price: baseFare + index * 90,
        boardingPoints: [`${from} Main Bus Stand`, `${from} Bypass`, `${from} Metro Point`],
        droppingPoints: [`${to} Main Bus Stand`, `${to} Highway`, `${to} City Center`],
        seatLayout: seatLayout(index + from.length + to.length),
    }));
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
    const [infoMessage, setInfoMessage] = useState('');
    const [cancelCandidate, setCancelCandidate] = useState(null);
    const [lastTicket, setLastTicket] = useState(null);
    const [paymentProcessing, setPaymentProcessing] = useState(false);
    const [emailSending, setEmailSending] = useState(false);

    const [newBookingType, setNewBookingType] = useState('hotel'); // 'hotel' or 'transport'
    const [submitting, setSubmitting] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [hotelSuggestions, setHotelSuggestions] = useState([]);
    const [hotelLoading, setHotelLoading] = useState(false);
    const [selectedHotelSuggestionId, setSelectedHotelSuggestionId] = useState('');
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [couponLoading, setCouponLoading] = useState(false);
    const [refundPreviewById, setRefundPreviewById] = useState({});

    // Hotel form state
    const [hotelForm, setHotelForm] = useState({
        title: '',
        city: '',
        checkIn: '',
        checkOut: '',
        rooms: 1,
        guests: 1,
        amount: 0,
    });

    // Transport booking flow state (RedBus style)
    const [transportSearch, setTransportSearch] = useState({
        from: '',
        to: '',
        travelDate: '',
        passengers: 1,
        city: '',
    });
    const [transportResults, setTransportResults] = useState([]);
    const [transportLoading, setTransportLoading] = useState(false);
    const [selectedTransport, setSelectedTransport] = useState(null);
    const [selectedSeats, setSelectedSeats] = useState([]);
    const [boardingPoint, setBoardingPoint] = useState('');
    const [droppingPoint, setDroppingPoint] = useState('');
    const [passengerDetails, setPassengerDetails] = useState([{ name: '', age: '', gender: 'Male' }]);
    const [contactInfo, setContactInfo] = useState({ name: '', phone: '', email: '' });
    const [paymentMethod, setPaymentMethod] = useState('upi');
    const [transportSort, setTransportSort] = useState('recommended');
    const [transportFilters, setTransportFilters] = useState({
        maxPrice: '',
        minRating: '0',
        departureBand: 'all',
        busType: 'all',
    });

    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem('user') || 'null');
        } catch {
            return null;
        }
    }, []);

    const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

    const makeTicketRef = () => `ITA${Date.now().toString().slice(-8)}`;

    const hotelNights = useMemo(() => {
        if (!hotelForm.checkIn || !hotelForm.checkOut) return 0;
        const checkIn = new Date(hotelForm.checkIn);
        const checkOut = new Date(hotelForm.checkOut);
        const diffMs = checkOut.getTime() - checkIn.getTime();
        if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;
        return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }, [hotelForm.checkIn, hotelForm.checkOut]);

    const selectedHotelSuggestion = useMemo(() => (
        hotelSuggestions.find((item) => String(item.id) === String(selectedHotelSuggestionId)) || null
    ), [hotelSuggestions, selectedHotelSuggestionId]);

    const recommendedHotelTotal = useMemo(() => {
        if (!selectedHotelSuggestion) return 0;
        const nights = Math.max(1, hotelNights || 1);
        const rooms = Math.max(1, Number(hotelForm.rooms) || 1);
        return Math.round(Number(selectedHotelSuggestion.pricePerNight || 0) * nights * rooms);
    }, [selectedHotelSuggestion, hotelNights, hotelForm.rooms]);

    const isHotelFlow = newBookingType === 'hotel';
    const draftBaseAmount = useMemo(() => {
        if (isHotelFlow) return Number(hotelForm.amount) || 0;
        if (!selectedTransport) return 0;
        return (Number(selectedTransport.price) || 0) * selectedSeats.length;
    }, [isHotelFlow, hotelForm.amount, selectedTransport, selectedSeats.length]);

    const draftTaxAmount = useMemo(() => {
        const rate = isHotelFlow ? 0.12 : 0.05;
        return Math.round(draftBaseAmount * rate);
    }, [isHotelFlow, draftBaseAmount]);

    const draftServiceFee = useMemo(() => (isHotelFlow ? 149 : 79), [isHotelFlow]);
    const draftDiscount = Number(appliedCoupon?.discount || 0);
    const draftGross = Math.max(0, draftBaseAmount + draftTaxAmount + draftServiceFee);
    const draftPayable = Math.max(0, draftGross - draftDiscount);

    const buildTicketText = (ticket) => {
        if (!ticket) return '';
        return [
            'InTravel AI - Ticket',
            `Ticket Ref: ${ticket.ref}`,
            `Booking ID: ${ticket.id}`,
            `Type: ${ticket.type}`,
            `Service: ${ticket.title}`,
            ticket.city ? `City: ${ticket.city}` : null,
            ticket.from && ticket.to ? `Route: ${ticket.from} -> ${ticket.to}` : null,
            ticket.travelDate ? `Travel Date: ${ticket.travelDate}` : null,
            ticket.checkIn ? `Check-in: ${ticket.checkIn}` : null,
            ticket.checkOut ? `Check-out: ${ticket.checkOut}` : null,
            ticket.rooms ? `Rooms: ${ticket.rooms}` : null,
            ticket.guests ? `Guests: ${ticket.guests}` : null,
            ticket.seats?.length ? `Seats: ${ticket.seats.join(', ')}` : null,
            `Amount: ${formatAmount(ticket.amount)}`,
            `Payment Method: ${String(ticket.paymentMethod || '').toUpperCase()}`,
            `Payment Status: ${String(ticket.paymentStatus || '').toUpperCase()}`,
            ticket.contact?.name ? `Contact: ${ticket.contact.name}` : null,
            ticket.contact?.phone ? `Phone: ${ticket.contact.phone}` : null,
            ticket.contact?.email ? `Email: ${ticket.contact.email}` : null,
            `Generated At: ${new Date().toLocaleString('en-IN')}`,
        ].filter(Boolean).join('\n');
    };

    const qrTicketUrl = useMemo(() => {
        if (!lastTicket) return '';
        const payload = JSON.stringify({
            ref: lastTicket.ref,
            id: lastTicket.id,
            type: lastTicket.type,
            amount: lastTicket.amount,
        });
        return `https://quickchart.io/qr?size=180&text=${encodeURIComponent(payload)}`;
    }, [lastTicket]);

    const handleDownloadTicket = async () => {
        if (!lastTicket) return;
        try {
            const { jsPDF } = await import('jspdf');
            const doc = new jsPDF({ unit: 'pt', format: 'a4' });
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text('InTravel AI - Ticket', 40, 52);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);

            const lines = buildTicketText(lastTicket).split('\n');
            let y = 84;
            lines.forEach((line) => {
                const wrapped = doc.splitTextToSize(line, 510);
                doc.text(wrapped, 40, y);
                y += wrapped.length * 15;
                if (y > 780) {
                    doc.addPage();
                    y = 50;
                }
            });

            doc.save(`${lastTicket.ref || 'ticket'}.pdf`);
            setActionMessage('Ticket PDF downloaded successfully.');
        } catch {
            setError('Unable to generate PDF ticket right now.');
        }
    };

    const handlePrintTicket = () => {
        if (!lastTicket) return;
        const popup = window.open('', '_blank', 'width=700,height=800');
        if (!popup) {
            setError('Please allow pop-ups to print the ticket.');
            return;
        }

        const text = buildTicketText(lastTicket).replace(/\n/g, '<br/>');
        popup.document.write(`<html><head><title>${lastTicket.ref}</title></head><body style="font-family:Arial;padding:20px;">${text}</body></html>`);
        popup.document.close();
        popup.focus();
        popup.print();
    };

    const handleDownloadCalendar = () => {
        if (!lastTicket) return;
        const dateSource = lastTicket.travelDate || lastTicket.checkIn || todayIso;
        const start = new Date(`${dateSource}T10:00:00`);
        const end = new Date(start);
        if (lastTicket.type === 'hotel') {
            end.setDate(start.getDate() + Math.max(1, Number(lastTicket.nights) || 1));
        } else {
            end.setHours(start.getHours() + 4);
        }

        const fmt = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const ics = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//InTravel AI//Bookings//EN',
            'BEGIN:VEVENT',
            `UID:${lastTicket.ref}@intravel.ai`,
            `DTSTAMP:${fmt(new Date())}`,
            `DTSTART:${fmt(start)}`,
            `DTEND:${fmt(end)}`,
            `SUMMARY:${lastTicket.type === 'hotel' ? 'Hotel Stay' : 'Transport Journey'} - ${lastTicket.title}`,
            `DESCRIPTION:Ticket ${lastTicket.ref} | Amount ${lastTicket.amount}`,
            `LOCATION:${lastTicket.city || lastTicket.to || ''}`,
            'END:VEVENT',
            'END:VCALENDAR',
        ].join('\r\n');

        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
        const href = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = href;
        anchor.download = `${lastTicket.ref || 'booking'}.ics`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(href);
    };

    const handleApplyCoupon = async () => {
        const code = String(couponCode || '').trim().toUpperCase();
        if (!code) {
            setError('Enter a coupon code to apply.');
            return;
        }
        if (draftGross <= 0) {
            setError('Add booking details first to apply coupon.');
            return;
        }

        setCouponLoading(true);
        setError('');
        try {
            const { data } = await axios.get('/api/offers/validate', {
                params: {
                    code,
                    amount: draftGross,
                    type: newBookingType,
                },
                timeout: 10000,
            });

            if (!data?.valid) {
                setAppliedCoupon(null);
                setError(data?.message || 'Invalid coupon code.');
                return;
            }

            setAppliedCoupon({
                code,
                discount: Number(data.discount || 0),
                finalAmount: Number(data.finalAmount || draftGross),
            });
            setActionMessage(`Coupon ${code} applied. You saved ${formatAmount(data.discount || 0)}.`);
        } catch (err) {
            setError(err?.response?.data?.error || 'Unable to apply coupon right now.');
            setAppliedCoupon(null);
        } finally {
            setCouponLoading(false);
        }
    };

    const handleClearCoupon = () => {
        setCouponCode('');
        setAppliedCoupon(null);
    };

    const handlePreviewRefund = async (bookingId) => {
        if (!user?.id || !bookingId) return;
        try {
            const { data } = await axios.get(`/api/bookings/${bookingId}/refund-estimate`, {
                params: { userId: user.id },
                timeout: 10000,
            });
            setRefundPreviewById((prev) => ({ ...prev, [bookingId]: data }));
        } catch {
            setRefundPreviewById((prev) => ({
                ...prev,
                [bookingId]: { refundableAmount: 0, policyLabel: 'Unable to estimate now' },
            }));
        }
    };

    const openCancelDialog = async (booking) => {
        setCancelCandidate(booking);
        await handlePreviewRefund(booking?.id);
    };

    const updatePaymentStatus = async (status) => {
        if (!lastTicket?.id || !user?.id) return;
        try {
            await axios.post(`/api/bookings/${lastTicket.id}/payment`, {
                userId: user.id,
                method: lastTicket.paymentMethod || paymentMethod,
                status,
            }, { timeout: 10000 });
        } catch {
            // Keep UI resilient even if backend persistence fails.
        }
    };

    const handleProcessPayment = async (isRetry = false) => {
        if (!lastTicket) return;
        setPaymentProcessing(true);
        setError('');
        setInfoMessage('');

        await updatePaymentStatus('pending');
        setLastTicket((prev) => prev ? { ...prev, paymentStatus: 'pending' } : prev);
        setBookings((prev) => prev.map((item) => (
            Number(item.id) === Number(lastTicket.id)
                ? {
                    ...item,
                    details: {
                        ...(item.details || {}),
                        payment: {
                            ...((item.details || {}).payment || {}),
                            method: lastTicket.paymentMethod || paymentMethod,
                            status: 'pending',
                        },
                    },
                }
                : item
        )));

        await new Promise((resolve) => setTimeout(resolve, 900));
        const successProbability = isRetry ? 0.85 : 0.7;
        const isSuccess = Math.random() < successProbability;
        const finalStatus = isSuccess ? 'success' : 'failed';
        await updatePaymentStatus(finalStatus);

        setLastTicket((prev) => prev ? { ...prev, paymentStatus: finalStatus } : prev);
        setBookings((prev) => prev.map((item) => (
            Number(item.id) === Number(lastTicket.id)
                ? {
                    ...item,
                    details: {
                        ...(item.details || {}),
                        payment: {
                            ...((item.details || {}).payment || {}),
                            method: lastTicket.paymentMethod || paymentMethod,
                            status: finalStatus,
                        },
                    },
                }
                : item
        )));

        if (showHistory) {
            fetchBookings();
        }

        if (isSuccess) {
            setActionMessage('Payment completed successfully. Ticket is now confirmed.');
        } else {
            setError('Payment failed. Please retry payment.');
        }
        setPaymentProcessing(false);
    };

    const handleSendTicketEmail = async () => {
        if (!lastTicket?.id || !user?.id) return;
        setEmailSending(true);
        setError('');
        try {
            const { data } = await axios.post(`/api/bookings/${lastTicket.id}/send-ticket`, {
                userId: user.id,
                email: lastTicket.contact?.email,
            }, { timeout: 10000 });

            if (data?.sent) {
                setActionMessage(`Ticket emailed to ${data.email}.`);
                setLastTicket((prev) => prev ? { ...prev, emailStatus: 'sent' } : prev);
            } else {
                setInfoMessage(data?.message || 'Email provider not configured. Ticket saved locally.');
                setLastTicket((prev) => prev ? { ...prev, emailStatus: 'mock' } : prev);
            }
        } catch (err) {
            setError(err?.response?.data?.error || 'Unable to send ticket email right now.');
            setLastTicket((prev) => prev ? { ...prev, emailStatus: 'failed' } : prev);
        } finally {
            setEmailSending(false);
        }
    };

    const fetchBestHotels = async (cityInput = hotelForm.city) => {
        const city = String(cityInput || '').trim();
        if (!city) {
            setError('Enter a city to view best hotels.');
            return;
        }

        setHotelLoading(true);
        setError('');
        setInfoMessage('');
        try {
            const { data } = await axios.get('/api/hotels', {
                params: { city },
                timeout: 10000,
            });

            const hotels = (Array.isArray(data) ? data : []).map((item, index) => ({
                id: item.id || `${city}-${index}`,
                name: item.name || item.title || 'Hotel',
                city: item.city || city,
                pricePerNight: Number(item.price_per_night ?? item.pricePerNight ?? item.price ?? 0),
                rating: Number(item.rating ?? 0),
                amenities: item.amenities || '',
                imageUrl: item.image_url || item.imageUrl || '',
            }));

            const ranked = hotels
                .filter((h) => h.name && h.pricePerNight >= 0)
                .sort((a, b) => (b.rating - a.rating) || (a.pricePerNight - b.pricePerNight));

            setHotelSuggestions(ranked);
            setSelectedHotelSuggestionId(ranked[0]?.id ? String(ranked[0].id) : '');
            if (ranked.length === 0) {
                setInfoMessage('No hotel suggestions found for this city. You can still enter hotel details manually.');
            } else {
                setInfoMessage(`Showing ${ranked.length} recommended hotel option(s) for ${city}.`);
            }
        } catch {
            setHotelSuggestions([]);
            setInfoMessage('Unable to fetch hotel suggestions right now. You can continue with manual entry.');
        } finally {
            setHotelLoading(false);
        }
    };

    const applyHotelSuggestion = (hotel) => {
        const rooms = Math.max(1, Number(hotelForm.rooms) || 1);
        const nights = Math.max(1, hotelNights || 1);
        const total = Math.round((Number(hotel.pricePerNight) || 0) * rooms * nights);
        setSelectedHotelSuggestionId(String(hotel.id));
        setHotelForm((prev) => ({
            ...prev,
            title: hotel.name,
            city: hotel.city || prev.city,
            amount: total || prev.amount,
        }));
        setActionMessage(`Selected ${hotel.name} as your hotel.`);
    };

    useEffect(() => {
        if (!selectedHotelSuggestion || !recommendedHotelTotal) return;
        setHotelForm((prev) => (
            Number(prev.amount) === Number(recommendedHotelTotal)
                ? prev
                : { ...prev, amount: recommendedHotelTotal }
        ));
    }, [selectedHotelSuggestion, recommendedHotelTotal]);

    useEffect(() => {
        if (!appliedCoupon) return;
        setAppliedCoupon(null);
        setInfoMessage('Coupon reset because booking amount changed. Re-apply to get updated discount.');
    }, [draftGross]);

    const fetchBookings = useCallback(async () => {
        const currentUser = user;
        if (!currentUser?.id) {
            setBookings([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError('');
        setActionMessage('');
        setInfoMessage('');
        try {
            const params = { userId: currentUser.id };
            if (filter !== 'all') params.type = filter;

            const { data } = await axios.get('/api/bookings', {
                params,
                timeout: 10000
            });

            if (Array.isArray(data)) {
                setBookings(data);
            } else if (data?.bookings && Array.isArray(data.bookings)) {
                setBookings(data.bookings);
            } else {
                setBookings([]);
            }
        } catch (err) {
            const errorMsg = err?.response?.data?.error || err?.message || 'Could not load your bookings right now.';
            setError(errorMsg);
            setBookings([]);
        } finally {
            setLoading(false);
        }
    }, [user, filter]);

    const handleBookAgain = async (booking) => {
        if (!user?.id) {
            setError('Please sign in to rebook.');
            return;
        }

        if (!booking?.id || !booking?.type) {
            setError('Invalid booking information.');
            return;
        }

        setActionId(`book-${booking.id}`);
        setError('');
        setActionMessage('');
        setInfoMessage('');

        try {
            const bookingPayload = {
                type: booking.type,
                userId: user.id,
                title: `${booking.title} (Rebooked)`,
                city: booking.city || 'Unknown',
                amount: Number(booking.amount) || 0,
                details: booking.details || {},
            };

            const { data } = await axios.post('/api/bookings', bookingPayload, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (data?.id) {
                setActionMessage(`✅ Rebooked successfully! Booking ID: #${data.id}`);
                setTimeout(() => fetchBookings(), 1000);
            } else {
                setError('Booking created but response incomplete.');
            }
        } catch (err) {
            const errorMsg = err?.response?.data?.error || err?.message || 'Unable to rebook this reservation right now.';
            setError(errorMsg);
        } finally {
            setActionId('');
        }
    };

    const handleCancelBooking = async (booking) => {
        if (!user?.id) {
            setError('Please sign in to cancel bookings.');
            return;
        }

        if (isCancelled(booking)) {
            setError('Booking is already cancelled.');
            setCancelCandidate(null);
            return;
        }

        setActionId(`cancel-${booking.id}`);
        setError('');
        setActionMessage('');
        setInfoMessage('');

        try {
            await axios.delete(`/api/bookings/${booking.id}`, {
                params: { userId: user.id },
                timeout: 10000
            });

            setActionMessage(`✅ Booking cancelled successfully.`);
            setBookings((prev) => prev.map((item) => (
                item.id === booking.id ? { ...item, status: 'CANCELLED' } : item
            )));

            setTimeout(() => {
                setCancelCandidate(null);
            }, 500);
        } catch (err) {
            const errorMsg = err?.response?.data?.error || err?.message || 'Unable to cancel this booking right now.';
            setError(errorMsg);
        } finally {
            setActionId('');
        }
    };

    const handleQuickModifyBooking = async (booking) => {
        if (!user?.id || !booking?.id || booking?.type !== 'hotel') return;
        const details = booking.details || {};
        const nextGuests = Math.min(30, Math.max(1, Number(details.guests || 1) + 1));
        const nights = Math.max(1, Number(details.nights || 1));
        const rooms = Math.max(1, Number(details.rooms || 1));
        const fallbackPricePerNight = Math.round((Number(booking.amount || 0) / Math.max(1, nights * rooms)));
        const pricePerNight = Math.max(0, Number(details.pricePerNight || fallbackPricePerNight || 0));
        const nextAmount = Math.max(0, Math.round(pricePerNight * rooms * nights));

        setActionId(`mod-${booking.id}`);
        setError('');
        try {
            const { data } = await axios.post(`/api/bookings/${booking.id}/modify`, {
                userId: user.id,
                patch: {
                    guests: nextGuests,
                    amount: nextAmount,
                },
            }, { timeout: 10000 });

            const updated = data?.booking;
            if (!updated) {
                setError('Could not modify booking right now.');
                return;
            }

            setBookings((prev) => prev.map((item) => (
                Number(item.id) === Number(booking.id)
                    ? { ...item, ...updated }
                    : item
            )));
            setActionMessage('Hotel booking updated successfully (+1 guest).');
            if (showHistory) fetchBookings();
        } catch (err) {
            setError(err?.response?.data?.error || 'Unable to modify booking right now.');
        } finally {
            setActionId('');
        }
    };

    const handleCreateNewBooking = async (e) => {
        e.preventDefault();

        if (!user?.id) {
            setError('Please sign in to create bookings.');
            return;
        }

        setSubmitting(true);
        setError('');
        setActionMessage('');
        setInfoMessage('');

        try {
            const isHotel = newBookingType === 'hotel';
            const formData = isHotel ? hotelForm : transportSearch;

            // Validation
            if (isHotel && (!formData.title || !formData.city)) {
                setError('Please fill in all required fields.');
                setSubmitting(false);
                return;
            }

            if (isHotel && (!formData.checkIn || !formData.checkOut)) {
                setError('Please select check-in and check-out dates.');
                setSubmitting(false);
                return;
            }

            if (isHotel && new Date(formData.checkIn) < new Date(todayIso)) {
                setError('Check-in date cannot be in the past.');
                setSubmitting(false);
                return;
            }

            if (isHotel && new Date(formData.checkOut) <= new Date(formData.checkIn)) {
                setError('Check-out date must be after check-in date.');
                setSubmitting(false);
                return;
            }

            if (isHotel && !contactInfo.name.trim()) {
                setError('Please add guest contact name for this hotel booking.');
                setSubmitting(false);
                return;
            }

            if (isHotel && !/^\d{10}$/.test(String(contactInfo.phone || '').trim())) {
                setError('Please enter a valid 10-digit guest contact number.');
                setSubmitting(false);
                return;
            }

            if (isHotel && !String(contactInfo.email || '').includes('@')) {
                setError('Please enter a valid guest email for ticket confirmation.');
                setSubmitting(false);
                return;
            }

            if (isHotel && (Number(formData.amount) || 0) <= 0) {
                setError('Please enter a valid booking amount greater than 0.');
                setSubmitting(false);
                return;
            }

            if (!isHotel && (!formData.from || !formData.to || !formData.travelDate)) {
                setError('Please fill in all required transport details.');
                setSubmitting(false);
                return;
            }

            if (!isHotel && !selectedTransport) {
                setError('Please search and select a bus service.');
                setSubmitting(false);
                return;
            }

            if (!isHotel && selectedSeats.length !== Number(formData.passengers || 1)) {
                setError(`Please select exactly ${Number(formData.passengers || 1)} seat(s).`);
                setSubmitting(false);
                return;
            }

            if (!isHotel && (!boardingPoint || !droppingPoint)) {
                setError('Please choose boarding and dropping points.');
                setSubmitting(false);
                return;
            }

            if (!isHotel && !contactInfo.name.trim()) {
                setError('Please add contact name for this booking.');
                setSubmitting(false);
                return;
            }

            if (!isHotel && !/^\d{10}$/.test(String(contactInfo.phone || '').trim())) {
                setError('Please enter a valid 10-digit contact number.');
                setSubmitting(false);
                return;
            }

            if (!isHotel && !String(contactInfo.email || '').includes('@')) {
                setError('Please enter a valid contact email.');
                setSubmitting(false);
                return;
            }

            if (!isHotel) {
                const invalidPassenger = passengerDetails.some((p) => !String(p.name || '').trim() || !Number(p.age));
                if (invalidPassenger) {
                    setError('Please complete all passenger names and ages.');
                    setSubmitting(false);
                    return;
                }
            }

            const ticketRef = makeTicketRef();

            const bookingPayload = {
                type: newBookingType,
                userId: user.id,
                title: isHotel ? formData.title : `${selectedTransport.operator} ${selectedTransport.busType}`,
                city: formData.city || formData.to,
                amount: draftPayable,
                details: isHotel ? {
                    checkIn: formData.checkIn,
                    checkOut: formData.checkOut,
                    nights: hotelNights,
                    rooms: Number(formData.rooms) || 1,
                    guests: Number(formData.guests) || 1,
                    pricePerNight: selectedHotelSuggestion
                        ? Number(selectedHotelSuggestion.pricePerNight || 0)
                        : Math.round((Number(formData.amount) || 0) / Math.max(1, (Number(formData.rooms) || 1) * Math.max(1, hotelNights))),
                } : {
                    from: transportSearch.from,
                    to: transportSearch.to,
                    travelDate: transportSearch.travelDate,
                    passengers: Number(transportSearch.passengers) || 1,
                    busType: selectedTransport.busType,
                    departure: selectedTransport.departure,
                    arrival: selectedTransport.arrival,
                    duration: selectedTransport.duration,
                    boardingPoint,
                    droppingPoint,
                    seats: selectedSeats,
                    passengerDetails,
                    contactInfo,
                    payment: { method: paymentMethod, status: 'paid_mock' },
                    ticketRef,
                    operatorRating: selectedTransport.rating,
                }
            };

            if (isHotel) {
                bookingPayload.details.payment = { method: paymentMethod, status: 'pending' };
                bookingPayload.details.contactInfo = contactInfo;
                bookingPayload.details.ticketRef = ticketRef;
            } else {
                bookingPayload.details.payment = { method: paymentMethod, status: 'pending' };
            }

            bookingPayload.details.pricing = {
                baseAmount: draftBaseAmount,
                taxAmount: draftTaxAmount,
                serviceFee: draftServiceFee,
                grossAmount: draftGross,
                discountAmount: draftDiscount,
                finalAmount: draftPayable,
                couponCode: appliedCoupon?.code || null,
            };

            const { data } = await axios.post('/api/bookings', bookingPayload, {
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
            });

            if (data?.id) {
                setActionMessage(`✅ ${isHotel ? 'Hotel' : 'Transport'} booking created! ID: #${data.id}`);
                setLastTicket({
                    id: data.id,
                    ref: isHotel ? `ITH${String(data.id).padStart(6, '0')}` : ticketRef,
                    type: newBookingType,
                    title: bookingPayload.title,
                    city: bookingPayload.city,
                    from: bookingPayload.details?.from,
                    to: bookingPayload.details?.to,
                    travelDate: bookingPayload.details?.travelDate,
                    checkIn: bookingPayload.details?.checkIn,
                    checkOut: bookingPayload.details?.checkOut,
                    nights: bookingPayload.details?.nights,
                    rooms: bookingPayload.details?.rooms,
                    guests: bookingPayload.details?.guests,
                    seats: bookingPayload.details?.seats || [],
                    amount: bookingPayload.amount,
                    createdAt: new Date().toISOString(),
                    contact: contactInfo,
                    paymentMethod,
                    paymentStatus: 'pending',
                    emailStatus: 'idle',
                });

                // Reset form
                setNewBookingType('hotel');
                setHotelForm({
                    title: '', city: '', checkIn: '', checkOut: '',
                    rooms: 1, guests: 1, amount: 0,
                });
                setHotelSuggestions([]);
                setSelectedHotelSuggestionId('');
                setTransportSearch({
                    from: '', to: '', travelDate: '', passengers: 1, city: '',
                });
                setTransportResults([]);
                setSelectedTransport(null);
                setSelectedSeats([]);
                setBoardingPoint('');
                setDroppingPoint('');
                setPassengerDetails([{ name: '', age: '', gender: 'Male' }]);
                setContactInfo({ name: '', phone: '', email: '' });
                setPaymentMethod('upi');
                setTransportSort('recommended');
                setTransportFilters({ maxPrice: '', minRating: '0', departureBand: 'all', busType: 'all' });
                setCouponCode('');
                setAppliedCoupon(null);

                if (showHistory) {
                    setTimeout(() => {
                        fetchBookings();
                    }, 1000);
                }
            } else {
                setError('Booking created but response incomplete.');
            }
        } catch (err) {
            const errorMsg = err?.response?.data?.error || err?.message || 'Failed to create booking.';
            setError(errorMsg);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSearchTransport = async () => {
        const from = transportSearch.from.trim();
        const to = transportSearch.to.trim();
        const travelDate = transportSearch.travelDate;

        if (!from || !to || !travelDate) {
            setError('Enter From, To and Travel Date to search buses.');
            return;
        }

        setTransportLoading(true);
        setError('');
        setInfoMessage('');
        try {
            const { data } = await axios.get('/api/transport/search', {
                params: {
                    from,
                    to,
                    travelDate,
                    passengers: Number(transportSearch.passengers) || 1,
                },
                timeout: 12000,
            });

            const services = Array.isArray(data)
                ? data
                : Array.isArray(data?.services)
                    ? data.services
                    : [];

            setTransportResults(services);
            setSelectedTransport(null);
            setSelectedSeats([]);
            setBoardingPoint('');
            setDroppingPoint('');
            if (!services.length) {
                setInfoMessage('No buses found for this route/date. Try a nearby city or different date.');
            } else {
                setInfoMessage(`Showing ${services.length} bus option(s).`);
            }
        } catch (err) {
            const fallback = buildLocalTransportFallback(from, to, travelDate);
            setTransportResults(fallback);
            setSelectedTransport(null);
            setSelectedSeats([]);
            setBoardingPoint('');
            setDroppingPoint('');
            setInfoMessage('Live feed is unavailable. Showing fallback bus options.');
        } finally {
            setTransportLoading(false);
        }
    };

    const toggleSeat = (seatNumber, available = true) => {
        if (!available) return;
        const maxSeats = Number(transportSearch.passengers) || 1;
        setSelectedSeats((prev) => {
            if (prev.includes(seatNumber)) {
                return prev.filter((seat) => seat !== seatNumber);
            }
            if (prev.length >= maxSeats) {
                return prev;
            }
            return [...prev, seatNumber];
        });
    };

    useEffect(() => {
        if (!user?.id) {
            setBookings([]);
            setLoading(false);
            return;
        }

        if (showHistory) {
            fetchBookings();
        }
    }, [filter, user?.id, showHistory, fetchBookings]);

    useEffect(() => {
        const count = Math.max(1, Math.min(6, Number(transportSearch.passengers) || 1));
        setPassengerDetails((prev) => {
            const next = [...prev];
            while (next.length < count) next.push({ name: '', age: '', gender: 'Male' });
            return next.slice(0, count);
        });
    }, [transportSearch.passengers]);

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

    const filteredTransportResults = useMemo(() => {
        let rows = [...transportResults];

        const maxPrice = Number(transportFilters.maxPrice);
        const minRating = Number(transportFilters.minRating || 0);

        if (Number.isFinite(maxPrice) && maxPrice > 0) {
            rows = rows.filter((item) => Number(item.price) <= maxPrice);
        }
        if (minRating > 0) {
            rows = rows.filter((item) => Number(item.rating) >= minRating);
        }
        if (transportFilters.busType !== 'all') {
            rows = rows.filter((item) => String(item.busType || '').toLowerCase().includes(transportFilters.busType));
        }
        if (transportFilters.departureBand !== 'all') {
            rows = rows.filter((item) => {
                const hour = Number(String(item.departure || '00:00').split(':')[0]);
                if (transportFilters.departureBand === 'morning') return hour >= 5 && hour < 12;
                if (transportFilters.departureBand === 'afternoon') return hour >= 12 && hour < 17;
                if (transportFilters.departureBand === 'evening') return hour >= 17 && hour < 22;
                return hour >= 22 || hour < 5;
            });
        }

        rows.sort((a, b) => {
            if (transportSort === 'price-asc') return Number(a.price) - Number(b.price);
            if (transportSort === 'price-desc') return Number(b.price) - Number(a.price);
            if (transportSort === 'rating') return Number(b.rating) - Number(a.rating);
            if (transportSort === 'seats') return Number(b.seatsLeft) - Number(a.seatsLeft);
            return (Number(b.rating) * 100 - Number(b.price)) - (Number(a.rating) * 100 - Number(a.price));
        });

        return rows;
    }, [transportResults, transportFilters, transportSort]);

    const getStatusLabel = (status) => {
        const normalized = String(status || 'CONFIRMED').trim().toUpperCase();
        return normalized === 'CANCELLED' ? 'Cancelled' : 'Confirmed';
    };

    const getPaymentStatus = (booking) => {
        const raw = String(booking?.details?.payment?.status || '').trim().toLowerCase();
        if (raw === 'success' || raw === 'paid' || raw === 'paid_mock') return 'success';
        if (raw === 'failed') return 'failed';
        return 'pending';
    };

    const getPaymentLabel = (status) => {
        if (status === 'success') return 'Paid';
        if (status === 'failed') return 'Payment Failed';
        return 'Payment Pending';
    };

    const isCancelled = (booking) => String(booking?.status || '').trim().toUpperCase() === 'CANCELLED';

    const renderDetails = (booking) => {
        const details = booking?.details || {};

        if (booking.type === 'hotel') {
            return (
                <>
                    <div className="detail-row">
                        <CalendarDays size={14} />
                        <span>Check-in: {details.checkIn || 'Not specified'}</span>
                    </div>
                    <div className="detail-row">
                        <CalendarDays size={14} />
                        <span>Check-out: {details.checkOut || 'Not specified'}</span>
                    </div>
                    <div className="detail-row">
                        <Hotel size={14} />
                        <span>Rooms: {details.rooms || 1} | Guests: {details.guests || 1}</span>
                    </div>
                </>
            );
        }

        return (
            <>
                <div className="detail-row">
                    <MapPin size={14} />
                    <span>Route: {details.from || '-'} → {details.to || '-'}</span>
                </div>
                <div className="detail-row">
                    <CalendarDays size={14} />
                    <span>Date: {details.travelDate || 'Not specified'}</span>
                </div>
                <div className="detail-row">
                    <Users size={14} />
                    <span>Passengers: {details.passengers || 1}</span>
                </div>
            </>
        );
    };

    if (!user) {
        return (
            <div className="bookings-page section-container">
                <div className="bookings-login glass-card">
                    <AlertCircle size={40} className="heading-gradient" />
                    <h2 className="heading-gradient">Sign In to View Bookings</h2>
                    <p>Your hotel and transport ticket reservations will show up here once you log in.</p>
                    <a href="/login" className="button-primary">Sign In Now</a>
                </div>
            </div>
        );
    }

    return (
        <div className="bookings-page section-container">
            <div className="bookings-header glass-card">
                <div className="header-content">
                    <h2 className="heading-gradient">Book Hotel & Transport</h2>
                    <p>Create new reservations quickly. Tracking is optional below.</p>
                </div>
                <div className="header-actions">
                    <button className="button-secondary btn-sm" onClick={() => setShowHistory((prev) => !prev)}>
                        {showHistory ? 'Hide Previous Bookings' : 'View Previous Bookings'}
                    </button>
                </div>
            </div>

            {lastTicket && (
                <div className="ticket-summary glass-card">
                    <div className="ticket-head">
                        <strong>Booked Successfully</strong>
                        <span>Ticket Ref: {lastTicket.ref}</span>
                    </div>
                    <div className="ticket-grid">
                        <span>{lastTicket.title}</span>
                        {lastTicket.city && <span>City: {lastTicket.city}</span>}
                        {lastTicket.from && lastTicket.to && <span>{lastTicket.from}{' -> '}{lastTicket.to}</span>}
                        {lastTicket.travelDate && <span>Date: {lastTicket.travelDate}</span>}
                        {lastTicket.checkIn && lastTicket.checkOut && <span>Stay: {lastTicket.checkIn} to {lastTicket.checkOut}</span>}
                        {lastTicket.nights && <span>Nights: {lastTicket.nights}</span>}
                        {lastTicket.rooms && lastTicket.guests && <span>Rooms: {lastTicket.rooms} | Guests: {lastTicket.guests}</span>}
                        {lastTicket.seats?.length > 0 && <span>Seats: {lastTicket.seats.join(', ')}</span>}
                        <span>Amount: {formatAmount(lastTicket.amount)}</span>
                        <span>Payment: {String(lastTicket.paymentMethod || '').toUpperCase()}</span>
                        <span>Status: {String(lastTicket.paymentStatus || 'pending').toUpperCase()}</span>
                    </div>
                    <div className="ticket-actions">
                        {(lastTicket.paymentStatus === 'pending' || lastTicket.paymentStatus === 'failed') && (
                            <button
                                type="button"
                                className="button-primary btn-sm"
                                onClick={() => handleProcessPayment(lastTicket.paymentStatus === 'failed')}
                                disabled={paymentProcessing}
                            >
                                {paymentProcessing ? 'Processing...' : (lastTicket.paymentStatus === 'failed' ? 'Retry Payment' : 'Pay Now')}
                            </button>
                        )}
                        <button type="button" className="button-secondary btn-sm" onClick={handleDownloadTicket}>
                            Download Ticket
                        </button>
                        <button type="button" className="button-secondary btn-sm" onClick={handlePrintTicket}>
                            Print Ticket
                        </button>
                        <button type="button" className="button-secondary btn-sm" onClick={handleSendTicketEmail} disabled={emailSending}>
                            {emailSending ? 'Sending...' : 'Email Ticket'}
                        </button>
                        <button type="button" className="button-secondary btn-sm" onClick={handleDownloadCalendar}>
                            Add To Calendar
                        </button>
                    </div>
                    {qrTicketUrl && (
                        <div className="ticket-qr-wrap">
                            <img src={qrTicketUrl} alt="Ticket QR" className="ticket-qr" />
                        </div>
                    )}
                </div>
            )}

            <div className="booking-composer glass-card">
                <div className="booking-type-switch">
                    <button
                        type="button"
                        className={`chip ${newBookingType === 'hotel' ? 'active' : ''}`}
                        onClick={() => setNewBookingType('hotel')}
                        disabled={submitting}
                    >
                        Hotel
                    </button>
                    <button
                        type="button"
                        className={`chip ${newBookingType === 'transport' ? 'active' : ''}`}
                        onClick={() => setNewBookingType('transport')}
                        disabled={submitting}
                    >
                        Transport
                    </button>
                </div>

                <form onSubmit={handleCreateNewBooking}>
                    <div className="form-section">
                        {newBookingType === 'hotel' ? (
                            <>
                                <div className="form-row-2">
                                    <div className="form-group">
                                        <label>Hotel Name *</label>
                                        <input
                                            type="text"
                                            value={hotelForm.title}
                                            onChange={(e) => setHotelForm({ ...hotelForm, title: e.target.value })}
                                            placeholder="e.g., Taj Hotel Mumbai"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>City *</label>
                                        <input
                                            type="text"
                                            value={hotelForm.city}
                                            onChange={(e) => setHotelForm({ ...hotelForm, city: e.target.value })}
                                            onBlur={() => {
                                                if (hotelForm.city.trim()) fetchBestHotels(hotelForm.city);
                                            }}
                                            placeholder="e.g., Mumbai"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="hotel-search-row">
                                    <button
                                        type="button"
                                        className="button-secondary btn-sm"
                                        onClick={() => fetchBestHotels(hotelForm.city)}
                                        disabled={hotelLoading}
                                    >
                                        {hotelLoading ? 'Finding Best Hotels...' : 'Show Best Hotels'}
                                    </button>
                                </div>

                                {hotelSuggestions.length > 0 && (
                                    <div className="hotel-suggestions">
                                        {hotelSuggestions.slice(0, 5).map((hotel, index) => (
                                            <button
                                                type="button"
                                                key={hotel.id}
                                                className={`hotel-suggestion-card ${String(selectedHotelSuggestionId) === String(hotel.id) ? 'selected' : ''}`}
                                                onClick={() => applyHotelSuggestion(hotel)}
                                            >
                                                <div className="hotel-suggestion-head">
                                                    <strong>{hotel.name}</strong>
                                                    {index === 0 && <span className="best-hotel-badge">Best Match</span>}
                                                </div>
                                                <div className="hotel-suggestion-meta">
                                                    <span><MapPin size={13} /> {hotel.city}</span>
                                                    <span><Star size={13} /> {hotel.rating ? hotel.rating.toFixed(1) : 'N/A'}</span>
                                                    <span>{formatAmount(hotel.pricePerNight)} / night</span>
                                                </div>
                                                {hotel.amenities && <small>{hotel.amenities}</small>}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div className="form-row-2">
                                    <div className="form-group">
                                        <label>Check-in Date *</label>
                                        <input
                                            type="date"
                                            value={hotelForm.checkIn}
                                            onChange={(e) => setHotelForm({ ...hotelForm, checkIn: e.target.value })}
                                            min={todayIso}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Check-out Date *</label>
                                        <input
                                            type="date"
                                            value={hotelForm.checkOut}
                                            onChange={(e) => setHotelForm({ ...hotelForm, checkOut: e.target.value })}
                                            min={hotelForm.checkIn || todayIso}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-row-2">
                                    <div className="form-group">
                                        <label>Rooms</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="20"
                                            value={hotelForm.rooms}
                                            onChange={(e) => setHotelForm({ ...hotelForm, rooms: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Guests</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="30"
                                            value={hotelForm.guests}
                                            onChange={(e) => setHotelForm({ ...hotelForm, guests: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {selectedHotelSuggestion && (
                                    <div className="hotel-pricing-hint">
                                        <span>
                                            {hotelNights > 0 ? `${hotelNights} night(s)` : 'Select dates'} x {Math.max(1, Number(hotelForm.rooms) || 1)} room(s)
                                        </span>
                                        <strong>
                                            Suggested Total: {formatAmount(recommendedHotelTotal || selectedHotelSuggestion.pricePerNight || 0)}
                                        </strong>
                                    </div>
                                )}

                                <div className="form-group">
                                    <label>Booking Amount (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={hotelForm.amount}
                                        onChange={(e) => setHotelForm({ ...hotelForm, amount: e.target.value })}
                                        placeholder="0"
                                    />
                                </div>

                                <h4>Contact & Payment</h4>
                                <div className="form-row-2">
                                    <div className="form-group">
                                        <label>Guest Name *</label>
                                        <input
                                            type="text"
                                            value={contactInfo.name}
                                            onChange={(e) => setContactInfo((prev) => ({ ...prev, name: e.target.value }))}
                                            placeholder="Primary guest name"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Phone *</label>
                                        <input
                                            type="tel"
                                            value={contactInfo.phone}
                                            onChange={(e) => setContactInfo((prev) => ({ ...prev, phone: e.target.value }))}
                                            placeholder="10-digit mobile"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Email *</label>
                                    <input
                                        type="email"
                                        value={contactInfo.email}
                                        onChange={(e) => setContactInfo((prev) => ({ ...prev, email: e.target.value }))}
                                        placeholder="tickets@example.com"
                                        required
                                    />
                                </div>

                                <div className="payment-chips">
                                    {['upi', 'card', 'netbanking'].map((method) => (
                                        <button
                                            type="button"
                                            key={method}
                                            className={`chip ${paymentMethod === method ? 'active' : ''}`}
                                            onClick={() => setPaymentMethod(method)}
                                        >
                                            {method.toUpperCase()}
                                        </button>
                                    ))}
                                </div>

                                <div className="coupon-box">
                                    <div className="form-row-2">
                                        <div className="form-group">
                                            <label>Coupon Code</label>
                                            <input
                                                type="text"
                                                value={couponCode}
                                                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                                placeholder="e.g., WELCOME10"
                                            />
                                        </div>
                                        <div className="coupon-actions-inline">
                                            <button type="button" className="button-secondary btn-sm" onClick={handleApplyCoupon} disabled={couponLoading}>
                                                {couponLoading ? 'Applying...' : 'Apply Coupon'}
                                            </button>
                                            {appliedCoupon && (
                                                <button type="button" className="button-secondary btn-sm" onClick={handleClearCoupon}>
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="fare-breakup">
                                        <span>Base</span><strong>{formatAmount(draftBaseAmount)}</strong>
                                        <span>Taxes</span><strong>{formatAmount(draftTaxAmount)}</strong>
                                        <span>Service Fee</span><strong>{formatAmount(draftServiceFee)}</strong>
                                        <span>Discount</span><strong>- {formatAmount(draftDiscount)}</strong>
                                        <span>Final Payable</span><strong>{formatAmount(draftPayable)}</strong>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="transport-search-grid">
                                    <div className="form-group">
                                        <label>From *</label>
                                        <input
                                            type="text"
                                            value={transportSearch.from}
                                            onChange={(e) => setTransportSearch({ ...transportSearch, from: e.target.value, city: e.target.value })}
                                            placeholder="e.g., Hyderabad"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>To *</label>
                                        <input
                                            type="text"
                                            value={transportSearch.to}
                                            onChange={(e) => setTransportSearch({ ...transportSearch, to: e.target.value, city: e.target.value })}
                                            placeholder="e.g., Bangalore"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Travel Date *</label>
                                        <input
                                            type="date"
                                            value={transportSearch.travelDate}
                                            onChange={(e) => setTransportSearch({ ...transportSearch, travelDate: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Passengers</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="6"
                                            value={transportSearch.passengers}
                                            onChange={(e) => setTransportSearch({ ...transportSearch, passengers: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <button type="button" className="button-secondary" onClick={handleSearchTransport}>
                                    {transportLoading ? 'Searching...' : 'Search Buses'}
                                </button>

                                {transportResults.length > 0 && (
                                    <>
                                        <div className="transport-filters glass-card">
                                            <div className="form-group">
                                                <label>Sort</label>
                                                <select value={transportSort} onChange={(e) => setTransportSort(e.target.value)}>
                                                    <option value="recommended">Recommended</option>
                                                    <option value="price-asc">Price: Low to High</option>
                                                    <option value="price-desc">Price: High to Low</option>
                                                    <option value="rating">Top Rated</option>
                                                    <option value="seats">Most Seats Left</option>
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label>Max Price</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={transportFilters.maxPrice}
                                                    onChange={(e) => setTransportFilters({ ...transportFilters, maxPrice: e.target.value })}
                                                    placeholder="No limit"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Min Rating</label>
                                                <select value={transportFilters.minRating} onChange={(e) => setTransportFilters({ ...transportFilters, minRating: e.target.value })}>
                                                    <option value="0">Any</option>
                                                    <option value="4">4.0+</option>
                                                    <option value="4.2">4.2+</option>
                                                    <option value="4.4">4.4+</option>
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label>Departure</label>
                                                <select value={transportFilters.departureBand} onChange={(e) => setTransportFilters({ ...transportFilters, departureBand: e.target.value })}>
                                                    <option value="all">Any time</option>
                                                    <option value="morning">Morning</option>
                                                    <option value="afternoon">Afternoon</option>
                                                    <option value="evening">Evening</option>
                                                    <option value="night">Night</option>
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label>Bus Type</label>
                                                <select value={transportFilters.busType} onChange={(e) => setTransportFilters({ ...transportFilters, busType: e.target.value })}>
                                                    <option value="all">All</option>
                                                    <option value="ac">AC</option>
                                                    <option value="sleeper">Sleeper</option>
                                                    <option value="seater">Seater</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="transport-results">
                                            {filteredTransportResults.map((item) => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    className={`transport-card ${selectedTransport?.id === item.id ? 'selected' : ''}`}
                                                    onClick={() => {
                                                        setSelectedTransport(item);
                                                        setSelectedSeats([]);
                                                        setBoardingPoint(item.boardingPoints[0]);
                                                        setDroppingPoint(item.droppingPoints[0]);
                                                    }}
                                                >
                                                    <div className="transport-card-top">
                                                        <strong>{item.operator}</strong>
                                                        <span className="rating-pill"><Star size={12} /> {item.rating}</span>
                                                    </div>
                                                    <div className="transport-card-mid">
                                                        <span><Clock3 size={14} /> {item.departure}</span>
                                                        <span><Route size={14} /> {item.duration}</span>
                                                        <span><Clock3 size={14} /> {item.arrival}</span>
                                                    </div>
                                                    <div className="transport-card-bottom">
                                                        <span>{item.busType}</span>
                                                        <span>{item.seatsLeft} seats left</span>
                                                        <strong>₹{item.price}</strong>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {selectedTransport && (
                                    <div className="seat-panel glass-card">
                                        <div className="seat-panel-head">
                                            <h4><BusFront size={16} /> Select Seats</h4>
                                            <span>Selected {selectedSeats.length}/{Number(transportSearch.passengers) || 1}</span>
                                        </div>

                                        <div className="seat-legend">
                                            <span><i className="seat-dot available" /> Available</span>
                                            <span><i className="seat-dot selected" /> Selected</span>
                                            <span><i className="seat-dot blocked" /> Booked</span>
                                        </div>

                                        <div className="deck-label">Lower Deck</div>
                                        <div className="seat-grid sleeper-grid">
                                            {(selectedTransport?.seatLayout?.lower || []).map((seat) => (
                                                <button
                                                    key={seat.id}
                                                    type="button"
                                                    className={`seat-btn ${selectedSeats.includes(seat.id) ? 'active' : ''} ${seat.available ? '' : 'blocked'}`}
                                                    onClick={() => toggleSeat(seat.id, seat.available)}
                                                    disabled={!seat.available}
                                                >
                                                    {seat.id}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="deck-label">Upper Deck</div>
                                        <div className="seat-grid sleeper-grid">
                                            {(selectedTransport?.seatLayout?.upper || []).map((seat) => (
                                                <button
                                                    key={seat.id}
                                                    type="button"
                                                    className={`seat-btn ${selectedSeats.includes(seat.id) ? 'active' : ''} ${seat.available ? '' : 'blocked'}`}
                                                    onClick={() => toggleSeat(seat.id, seat.available)}
                                                    disabled={!seat.available}
                                                >
                                                    {seat.id}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="form-row-2">
                                            <div className="form-group">
                                                <label>Boarding Point</label>
                                                <select value={boardingPoint} onChange={(e) => setBoardingPoint(e.target.value)}>
                                                    {selectedTransport.boardingPoints.map((point) => (
                                                        <option key={point} value={point}>{point}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label>Dropping Point</label>
                                                <select value={droppingPoint} onChange={(e) => setDroppingPoint(e.target.value)}>
                                                    {selectedTransport.droppingPoints.map((point) => (
                                                        <option key={point} value={point}>{point}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="fare-summary">
                                            <span>Selected seats: {selectedSeats.join(', ') || 'None selected yet'}</span>
                                            <strong>Total: ₹{(selectedTransport.price * selectedSeats.length) || 0}</strong>
                                        </div>

                                        <div className="checkout-section">
                                            <h4>Passenger Details</h4>
                                            <div className="passenger-grid">
                                                {passengerDetails.map((passenger, index) => (
                                                    <div className="passenger-card" key={`p-${index}`}>
                                                        <strong>Passenger {index + 1}</strong>
                                                        <input
                                                            type="text"
                                                            placeholder="Full name"
                                                            value={passenger.name}
                                                            onChange={(e) => setPassengerDetails((prev) => prev.map((p, idx) => idx === index ? { ...p, name: e.target.value } : p))}
                                                        />
                                                        <div className="passenger-row">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                placeholder="Age"
                                                                value={passenger.age}
                                                                onChange={(e) => setPassengerDetails((prev) => prev.map((p, idx) => idx === index ? { ...p, age: e.target.value } : p))}
                                                            />
                                                            <select
                                                                value={passenger.gender}
                                                                onChange={(e) => setPassengerDetails((prev) => prev.map((p, idx) => idx === index ? { ...p, gender: e.target.value } : p))}
                                                            >
                                                                <option value="Male">Male</option>
                                                                <option value="Female">Female</option>
                                                                <option value="Other">Other</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <h4>Contact & Payment</h4>
                                            <div className="form-row-2">
                                                <div className="form-group">
                                                    <label>Contact Name</label>
                                                    <input
                                                        type="text"
                                                        value={contactInfo.name}
                                                        onChange={(e) => setContactInfo((prev) => ({ ...prev, name: e.target.value }))}
                                                        placeholder="Primary traveler"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Phone</label>
                                                    <input
                                                        type="tel"
                                                        value={contactInfo.phone}
                                                        onChange={(e) => setContactInfo((prev) => ({ ...prev, phone: e.target.value }))}
                                                        placeholder="10-digit mobile"
                                                    />
                                                </div>
                                            </div>
                                            <div className="form-group">
                                                <label>Email</label>
                                                <input
                                                    type="email"
                                                    value={contactInfo.email}
                                                    onChange={(e) => setContactInfo((prev) => ({ ...prev, email: e.target.value }))}
                                                    placeholder="tickets@example.com"
                                                />
                                            </div>

                                            <div className="payment-chips">
                                                {['upi', 'card', 'netbanking'].map((method) => (
                                                    <button
                                                        type="button"
                                                        key={method}
                                                        className={`chip ${paymentMethod === method ? 'active' : ''}`}
                                                        onClick={() => setPaymentMethod(method)}
                                                    >
                                                        {method.toUpperCase()}
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="coupon-box">
                                                <div className="form-row-2">
                                                    <div className="form-group">
                                                        <label>Coupon Code</label>
                                                        <input
                                                            type="text"
                                                            value={couponCode}
                                                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                                            placeholder="e.g., BUS100"
                                                        />
                                                    </div>
                                                    <div className="coupon-actions-inline">
                                                        <button type="button" className="button-secondary btn-sm" onClick={handleApplyCoupon} disabled={couponLoading}>
                                                            {couponLoading ? 'Applying...' : 'Apply Coupon'}
                                                        </button>
                                                        {appliedCoupon && (
                                                            <button type="button" className="button-secondary btn-sm" onClick={handleClearCoupon}>
                                                                Remove
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="fare-breakup">
                                                    <span>Base</span><strong>{formatAmount(draftBaseAmount)}</strong>
                                                    <span>Taxes</span><strong>{formatAmount(draftTaxAmount)}</strong>
                                                    <span>Service Fee</span><strong>{formatAmount(draftServiceFee)}</strong>
                                                    <span>Discount</span><strong>- {formatAmount(draftDiscount)}</strong>
                                                    <span>Final Payable</span><strong>{formatAmount(draftPayable)}</strong>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="modal-actions">
                        <button
                            type="submit"
                            className="button-primary"
                            disabled={submitting || (newBookingType === 'transport' && (!selectedTransport || selectedSeats.length !== Number(transportSearch.passengers || 1)))}
                        >
                            {submitting ? 'Booking...' : `Book ${newBookingType === 'hotel' ? 'Hotel' : 'Transport'}`}
                        </button>
                    </div>
                </form>
            </div>

            {showHistory && bookings.length > 0 && (
                <div className="bookings-stats">
                    <div className="booking-stat glass-card">
                        <Wallet size={20} className="stat-icon" />
                        <div className="stat-content">
                            <strong>{formatAmount(totalAmount)}</strong>
                            <small>Total Booked</small>
                        </div>
                    </div>
                    <div className="booking-stat glass-card">
                        <Hotel size={20} className="stat-icon" />
                        <div className="stat-content">
                            <strong>{totalHotels}</strong>
                            <small>Hotels</small>
                        </div>
                    </div>
                    <div className="booking-stat glass-card">
                        <Plane size={20} className="stat-icon" />
                        <div className="stat-content">
                            <strong>{totalTransport}</strong>
                            <small>Transport</small>
                        </div>
                    </div>
                </div>
            )}

            {showHistory && (
                <div className="bookings-toolbar glass-card">
                    <div className="toolbar-filters">
                        {['all', 'hotel', 'transport'].map((type) => (
                            <button
                                key={type}
                                className={`chip ${filter === type ? 'active' : ''}`}
                                onClick={() => setFilter(type)}
                            >
                                {type === 'all' ? '📋 All' : type === 'hotel' ? '🏨 Hotels' : '✈️ Transport'}
                            </button>
                        ))}
                    </div>

                    <div className="toolbar-controls">
                        <input
                            type="text"
                            placeholder="🔍 Search bookings..."
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            className="search-input"
                        />
                        <select
                            value={sortOrder}
                            onChange={(event) => setSortOrder(event.target.value)}
                            className="sort-select"
                        >
                            <option value="latest">📆 Newest first</option>
                            <option value="oldest">📅 Oldest first</option>
                            <option value="amount-high">💰 High to low</option>
                            <option value="amount-low">💵 Low to high</option>
                        </select>
                    </div>
                </div>
            )}

            {error && (
                <div className="bookings-alert error-alert glass-card">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                    <button className="alert-close" onClick={() => setError('')}>✕</button>
                </div>
            )}
            {actionMessage && (
                <div className="bookings-alert success-alert glass-card">
                    <CheckCircle size={18} />
                    <span>{actionMessage}</span>
                    <button className="alert-close" onClick={() => setActionMessage('')}>✕</button>
                </div>
            )}
            {infoMessage && (
                <div className="bookings-alert info-alert glass-card">
                    <BusFront size={18} />
                    <span>{infoMessage}</span>
                    <button className="alert-close" onClick={() => setInfoMessage('')}>✕</button>
                </div>
            )}

            {showHistory && (
                <div className="bookings-list">
                    {loading ? (
                        <div className="bookings-empty glass-card">Loading bookings...</div>
                    ) : visibleBookings.length === 0 ? (
                        <div className="bookings-empty glass-card">No bookings found for this filter.</div>
                    ) : (
                        visibleBookings.map((booking) => {
                            const paymentStatus = getPaymentStatus(booking);
                            return (
                                <div className="booking-item glass-card" key={booking.id} style={{ opacity: isCancelled(booking) ? 0.6 : 1 }}>
                                    <div className="booking-header">
                                        <div className="booking-title-section">
                                            <div className="booking-icon">
                                                {booking.type === 'hotel' ? <Hotel size={24} /> : <Plane size={24} />}
                                            </div>
                                            <div className="booking-title">
                                                <h4>{booking.title}</h4>
                                                <p className="booking-city">{booking.city}</p>
                                            </div>
                                        </div>
                                        <div className="booking-badges">
                                            <span className={`booking-type-badge ${booking.type}`}>
                                                {booking.type === 'hotel' ? 'Hotel' : 'Transport'}
                                            </span>
                                            <span className={`booking-status-badge ${getStatusLabel(booking.status).toLowerCase()}`}>
                                                {isCancelled(booking) ? <AlertCircle size={12} /> : <CheckCircle size={12} />}
                                                {getStatusLabel(booking.status)}
                                            </span>
                                            <span className={`booking-payment-badge ${paymentStatus}`}>
                                                <Wallet size={12} />
                                                {getPaymentLabel(paymentStatus)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="booking-details">
                                        {renderDetails(booking)}
                                    </div>

                                    <div className="booking-footer">
                                        <div className="booking-amount">
                                            <Wallet size={16} />
                                            <strong>{formatAmount(booking.amount)}</strong>
                                        </div>
                                        <div className="booking-date">
                                            <CalendarDays size={14} />
                                            <small>{formatDateTime(booking.createdAt)}</small>
                                        </div>
                                    </div>

                                    <div className="booking-actions">
                                        <button
                                            className="button-secondary btn-sm"
                                            onClick={() => handlePreviewRefund(booking.id)}
                                            disabled={Boolean(actionId)}
                                            title="Check cancellation refund estimate"
                                        >
                                            Estimate Refund
                                        </button>
                                        {booking.type === 'hotel' && !isCancelled(booking) && (
                                            <button
                                                className="button-secondary btn-sm"
                                                onClick={() => handleQuickModifyBooking(booking)}
                                                disabled={Boolean(actionId)}
                                                title="Quickly add one more guest"
                                            >
                                                {actionId === `mod-${booking.id}` ? '⏳ Updating...' : '+1 Guest'}
                                            </button>
                                        )}
                                        <button
                                            className="button-secondary btn-sm"
                                            onClick={() => handleBookAgain(booking)}
                                            disabled={Boolean(actionId) || isCancelled(booking)}
                                            title="Create a new booking with same details"
                                        >
                                            {actionId === `book-${booking.id}` ? '⏳ Booking...' : '📅 Book Again'}
                                        </button>
                                        <button
                                            className="button-secondary btn-sm booking-cancel"
                                            onClick={() => openCancelDialog(booking)}
                                            disabled={Boolean(actionId) || isCancelled(booking)}
                                            title={isCancelled(booking) ? 'Already cancelled' : 'Cancel this booking'}
                                        >
                                            {actionId === `cancel-${booking.id}` ? '⏳ Cancelling...' : (isCancelled(booking) ? '❌ Cancelled' : '🗑️ Cancel')}
                                        </button>
                                    </div>

                                    {refundPreviewById[booking.id] && (
                                        <div className="refund-preview">
                                            <span>{refundPreviewById[booking.id].policyLabel}</span>
                                            <strong>Est. Refund: {formatAmount(refundPreviewById[booking.id].refundableAmount || 0)}</strong>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {cancelCandidate && (
                <div className="cancel-modal-overlay" onClick={() => setCancelCandidate(null)}>
                    <div className="cancel-modal glass-card" onClick={(event) => event.stopPropagation()}>
                        <div className="cancel-modal-header">
                            <AlertCircle size={32} className="warning-icon" />
                            <h3>Cancel This Booking?</h3>
                        </div>
                        <div className="cancel-modal-content">
                            <p><strong>{cancelCandidate.title}</strong></p>
                            <p className="booking-city">{cancelCandidate.city} • {formatAmount(cancelCandidate.amount)}</p>
                            <p className="warning-text">This action cannot be undone. Refund amount depends on policy and time to check-in/travel.</p>
                            {refundPreviewById[cancelCandidate.id] && (
                                <p className="warning-text">
                                    {refundPreviewById[cancelCandidate.id].policyLabel} | Estimated Refund: {formatAmount(refundPreviewById[cancelCandidate.id].refundableAmount || 0)}
                                </p>
                            )}
                        </div>
                        <div className="cancel-modal-actions">
                            <button
                                className="button-secondary btn-sm"
                                onClick={() => setCancelCandidate(null)}
                                disabled={Boolean(actionId)}
                            >
                                Keep Booking
                            </button>
                            <button
                                className="button-secondary btn-sm booking-cancel"
                                onClick={() => handleCancelBooking(cancelCandidate)}
                                disabled={Boolean(actionId)}
                            >
                                {actionId === `cancel-${cancelCandidate.id}` ? '⏳ Cancelling...' : 'Confirm Cancel'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}