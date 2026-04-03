/* eslint-disable no-console */
const baseUrl = (process.env.API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

const testEmail = process.env.SMOKE_EMAIL || `smoke_${Date.now()}@example.com`;
const username = process.env.SMOKE_USERNAME || `smoke_${Date.now()}`;
const originalPassword = process.env.SMOKE_PASSWORD || 'TravelTest123';
const newPassword = process.env.SMOKE_NEW_PASSWORD || 'TravelTest456';

async function post(path, body) {
    const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = json?.error || `HTTP ${response.status}`;
        throw new Error(`${path} failed: ${message}`);
    }

    return json;
}

async function run() {
    console.log(`Using API base: ${baseUrl}`);
    console.log(`Smoke user email: ${testEmail}`);

    await post('/api/register', {
        username,
        email: testEmail,
        password: originalPassword,
    });
    console.log('Register: OK');

    const login1 = await post('/api/login', {
        email: testEmail,
        password: originalPassword,
    });
    if (!login1?.token) throw new Error('/api/login did not return token for original password');
    console.log('Login (original password): OK');

    const requestReset = await post('/api/auth/request-reset', { email: testEmail });
    console.log('Request reset: OK');

    const otp = requestReset?.debugOtp;
    if (!otp) {
        throw new Error('No debugOtp returned. Set NODE_ENV!=production or provide SMTP and test manually.');
    }

    await post('/api/auth/verify-reset', {
        email: testEmail,
        otp,
        newPassword,
    });
    console.log('Verify reset: OK');

    const login2 = await post('/api/login', {
        email: testEmail,
        password: newPassword,
    });
    if (!login2?.token) throw new Error('/api/login did not return token for new password');
    console.log('Login (new password): OK');

    console.log('Auth smoke test passed.');
}

run().catch((error) => {
    console.error('Auth smoke test failed:', error.message);
    process.exit(1);
});
