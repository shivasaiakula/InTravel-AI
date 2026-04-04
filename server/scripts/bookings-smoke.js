/* eslint-disable no-console */
const baseUrl = (process.env.API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

const testEmail = process.env.SMOKE_EMAIL || `bookings_smoke_${Date.now()}@example.com`;
const username = process.env.SMOKE_USERNAME || `bookings_smoke_${Date.now()}`;
const password = process.env.SMOKE_PASSWORD || 'TravelTest123';

async function request(path, method = 'GET', body) {
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = json?.error || `HTTP ${response.status}`;
        throw new Error(`${method} ${path} failed: ${message}`);
    }

    return json;
}

async function run() {
    console.log(`Using API base: ${baseUrl}`);

    await request('/api/register', 'POST', {
        username,
        email: testEmail,
        password,
    });
    console.log('Register: OK');

    const login = await request('/api/login', 'POST', {
        email: testEmail,
        password,
    });
    const userId = login?.user?.id;
    if (!userId) {
        throw new Error('Login did not return user id');
    }
    console.log(`Login: OK (userId=${userId})`);

    const hotelBooking = await request('/api/bookings', 'POST', {
        type: 'hotel',
        userId,
        title: 'Smoke Hotel Booking',
        city: 'Goa',
        amount: 8400,
        details: {
            hotel: 'Smoke Resort',
            checkIn: '2026-04-10',
            checkOut: '2026-04-12',
            rooms: 1,
            guests: 2,
        },
    });
    if (!hotelBooking?.id) throw new Error('Hotel booking create did not return id');
    console.log(`Hotel booking create: OK (#${hotelBooking.id})`);

    const transportBooking = await request('/api/bookings', 'POST', {
        type: 'transport',
        userId,
        title: 'Smoke Transport Booking',
        city: 'Mumbai',
        amount: 2600,
        details: {
            from: 'Delhi',
            to: 'Mumbai',
            mode: 'Flight',
            travelDate: '2026-04-11',
            passengers: 1,
            seatClass: 'Economy',
        },
    });
    if (!transportBooking?.id) throw new Error('Transport booking create did not return id');
    console.log(`Transport booking create: OK (#${transportBooking.id})`);

    const allBookings = await request(`/api/bookings?userId=${userId}`, 'GET');
    if (!Array.isArray(allBookings) || allBookings.length < 2) {
        throw new Error('Expected at least two bookings in list');
    }
    console.log(`List all bookings: OK (${allBookings.length} found)`);

    const hotelOnly = await request(`/api/bookings?userId=${userId}&type=hotel`, 'GET');
    if (!Array.isArray(hotelOnly) || hotelOnly.some((item) => item.type !== 'hotel')) {
        throw new Error('Hotel filter returned non-hotel records');
    }
    console.log(`List hotel bookings: OK (${hotelOnly.length} found)`);

    await request(`/api/bookings/${hotelBooking.id}?userId=${userId}`, 'DELETE');
    console.log('Cancel hotel booking: OK');

    const afterCancel = await request(`/api/bookings?userId=${userId}`, 'GET');
    const cancelled = afterCancel.find((item) => Number(item.id) === Number(hotelBooking.id));
    if (!cancelled || String(cancelled.status || '').toUpperCase() !== 'CANCELLED') {
        throw new Error('Cancelled booking status was not persisted as CANCELLED');
    }
    console.log('Verify cancelled status: OK');

    console.log('Bookings smoke test passed.');
}

run().catch((error) => {
    console.error('Bookings smoke test failed:', error.message);
    process.exit(1);
});
