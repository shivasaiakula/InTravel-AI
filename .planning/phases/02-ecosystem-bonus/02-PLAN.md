---
wave: 1
depends_on: ["01-core-auth/01-PLAN.md"]
files_modified: ["client/src/pages/Transport.jsx", "client/src/pages/Explore.jsx", "client/src/components/WeatherWidget.jsx", "client/src/pages/Budget.jsx"]
autonomous: true
requirements: ["TRAN-01", "HOTL-01", "FEAT-01", "FEAT-02", "FEAT-03"]
---

# Plan 2: Ecosystem & Bonus Integrations

<objective>
Complete the travel ecosystem by integrating transport, hotels, and bonus features (Weather, Charts, Maps). The defining design constraint for this phase is a "VERY MINIMAL" theme. Avoid visual clutter, heavy drop shadows, and excessive use of gradients.
</objective>

## Tasks

<task>
<read_first>
- client/src/index.css
- server/routes.js
- .planning/REQUIREMENTS.md
</read_first>
<action>
Implement the `Transport.jsx` page. Connect it to the backend `/api/transport` endpoint. Let the user search for transit options (from city A to city B).
**Design Constraint ("Very Minimal Theme"):**
Use clean typography, plenty of whitespace, and simple `glass-card-sm` wrappers with reduced borders. Avoid heavy glowing buttons for transit results; keep the layout spartan and easy to read.
Ensure TRAN-01 is satisfied.
</action>
<acceptance_criteria>
- `Transport.jsx` exists and fetches `/api/transport`.
- UI renders transport options cleanly in a minimalist list/table layout.
</acceptance_criteria>
</task>

<task>
<read_first>
- client/src/pages/Explore.jsx
- server/routes.js
</read_first>
<action>
Integrate Hotel listings into the platform (either within `Explore.jsx` or a new standalone page). Fetch from `/api/hotels`.
**Design Constraint ("Very Minimal Theme"):**
Display hotels using minimal tile layouts. Hide unnecessary data until hover. Keep the image aspect ratio clean and text plain (e.g., just name, rating, and subtle price tag).
Ensure HOTL-01 is satisfied.
</action>
<acceptance_criteria>
- The UI fetches and displays hotels related to the current context city.
</acceptance_criteria>
</task>

<task>
<read_first>
- client/src/pages/Budget.jsx
- client/package.json
</read_first>
<action>
Install a charting library (e.g., `recharts` or `chart.js` if not already present) and implement dynamic budget charts in `Budget.jsx`.
**Design Constraint ("Very Minimal Theme"):**
Render charts (e.g., Pie chart) with monochrome or muted two-tone color palettes. Remove extra grid lines, axis borders, and tick marks to make the chart extremely minimal and elegant.
Ensure FEAT-01 is satisfied.
</action>
<acceptance_criteria>
- A charting library is utilized.
- Budget views show a visual breakdown of costs without visual clutter.
</acceptance_criteria>
</task>

<task>
<read_first>
- client/src/pages/Explore.jsx
- server/routes.js
</read_first>
<action>
Integrate Live Weather API (or `/api/weather/:city` mock) and a Google Maps embed (via standard `iframe` or static maps URL based on destination). Build a minimal `<WeatherWidget />`.
**Design Constraint ("Very Minimal Theme"):**
The weather view should just be an icon and temperature in a clean font without bulky card backgrounds. The Map embed should ideally use a minimal/grayscale styling if possible (or standard map embedded cleanly).
Ensure FEAT-02 and FEAT-03 are met.
</action>
<acceptance_criteria>
- Weather data displays for destinations.
- A map embed exists for destinations or itineraries.
</acceptance_criteria>
</task>

## Verification
- Serve the client and verify all new UI segments adhere to the minimalist instruction.
- Ensure all acceptance criteria are met via codebase search tools.

<must_haves>
- Transport lookup works and matches the minimal aesthetic.
- Hotel listings work and match the minimal aesthetic.
- Charts visually render without clutter.
- Weather & Maps are present.
</must_haves>
