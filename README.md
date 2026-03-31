# 🇮🇳 InTravel AI - Full-Stack Indian Travel Platform

InTravel AI is a modern, AI-powered travel platform designed specifically for exploring India. It helps users plan itineraries, search for transport routes, find hotels, and explore destinations with premium glassmorphism UI.

## 🚀 Features
- **AI Trip Planner**: Personalized day-wise itineraries using Google Gemini Pro.
- **Destination Explorer**: Detailed guides for 50+ Indian cities with local tips & weather.
- **Transport Search**: City-to-city route options (Flight, Train, Bus).
- **User Dashboard**: Save trips and analyze your travel budget with interactive charts.
- **Travel Chatbot**: AI assistant for all your Indian travel queries.
- **Auth System**: Secure login and registration.

## 🛠️ Tech Stack
- **Frontend**: React.js, Vite, Framer Motion, Chart.js, Lucide Icons.
- **Backend**: Node.js, Express.js.
- **Database**: MySQL.
- **AI**: Google Generative AI (Gemini Pro).

## ⚙️ Setup Instructions

### 1. Prerequisites
- Node.js installed.
- MySQL Server running.

### 2. Database Setup
1. Open your MySQL client (e.g., MySQL Workbench or terminal).
2. Execute the script in `/database/schema.sql` to create the database and mock data.

### 3. Backend Setup
1. Navigate to the `server` folder:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example`:
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=indian_travel_platform
   JWT_SECRET=travel_secret_2024
   GEMINI_API_KEY=your_google_gemini_api_key
   ```
4. Start the server:
   ```bash
   npm run dev
   ```

### 4. Frontend Setup
1. Navigate to the `client` folder:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000` in your browser.

## 🔌 API Routes
- `POST /api/register` - Register user
- `POST /api/login` - Login user
- `GET /api/destinations` - Get all destinations
- `GET /api/transport?from=X&to=Y` - Search routes
- `GET /api/hotels?city=X` - Find hotels
- `POST /api/ai/plan` - Generate AI itinerary
- `POST /api/ai/chat` - Chat with AI assistant
- `POST /api/trips` - Save a trip
- `GET /api/trips/:userId` - Get user history

## 🌟 Bonus Features
- **Budget Analysis Charts**: Visual breakdown of trip costs in the dashboard.
- **Live Weather**: Mock integration for Indian city weather.
- **Google Maps**: One-click link to view locations on Google Maps.

## 🚢 Deploy Using GitHub
This repository now includes a GitHub Actions workflow at `.github/workflows/deploy-render.yml`.

### 1. Create Render Deploy Hooks
1. Open your Render dashboard.
2. For `intravel-frontend`, create a Deploy Hook URL.
3. For `intravel-backend`, create a Deploy Hook URL.

### 2. Add GitHub Secrets
In GitHub repository settings, add:
- `RENDER_FRONTEND_DEPLOY_HOOK_URL`
- `RENDER_BACKEND_DEPLOY_HOOK_URL`

### 3. Deploy
- Push to `main`, or
- Run the workflow manually from Actions: `Deploy to Render`

After this, each `main` push will trigger frontend and backend deploys on Render.

---
Built with ❤️ for Indian Travelers.
