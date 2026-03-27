# InTravel AI

## What This Is

InTravel AI is a modern, AI-powered travel platform designed specifically for exploring India. It helps users plan itineraries, search for transport routes, find hotels, and explore destinations with a premium glassmorphism UI.

## Core Value

Provide an effortless and highly visual AI-driven travel planning experience that perfectly tailors trips across India.

## Requirements

### Validated

- ✓ Client-Server Architecture (React Frontend, Node.js/Express Backend)
- ✓ AI Trip Planning using Google Gemini (Dynamic itineraries)
- ✓ User Authentication (JWT + bcryptjs)
- ✓ MySQL Database persistence (Users, Destinations, Transport, Trips)
- ✓ Glassmorphism design system and Framer Motion animations

### Active

- [ ] Budget Analysis Charts (Visual breakdown of costs)
- [ ] Live Weather integration for Indian cities
- [ ] Google Maps one-click links

### Out of Scope

- [Full booking engine] — We redirect to providers rather than handling complex payment compliance.
- [Global destinations] — The focus is strictly on Indian cities and domestic travel routes to ensure high-quality local recommendations.

## Context

The project is built as a portfolio-grade, full-stack application. It recently underwent architectural mapping. The frontend uses a custom Vanilla CSS aesthetic prioritizing vibrant colors and micro-animations. The backend integrates with Google Gemini Pro to generate natural-language itineraries.

## Constraints

- **Tech Stack**: React 18, Express 4.19, MySQL 2, Google Gemini API — Required dependencies for the application features.
- **Styling**: Vanilla CSS / Glassmorphism — No Tailwind or component libraries, to maintain the bespoke premium feel.
- **Environment**: Node.js v18+ — Backend runtime constraint.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Using Native CSS | Allows for fine-grained control over glassmorphism and animations. | ✓ Good |
| Google Gemini Pro | Cost-effective and provides high-quality generative text for itineraries. | ✓ Good |
| JWT Authentication | Stateless session management scales better for this architecture. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-27 after initialization*
