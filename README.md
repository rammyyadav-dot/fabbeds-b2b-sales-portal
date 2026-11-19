# FabBeds — B2B Sales Portal

**THE WORLD'S WHOLESALE MARKETPLACE** — a B2B/DMC booking portal for the travel trade, built on Zite.

Partners (travel agents, tour operators, DMCs and corporate travel desks) search contracted UAE hotel rates, compare tariffs and submit booking requests.

## Who it's for
- Travel agents, tour operators, DMCs and corporate travel desks
- Anyone in the travel trade looking for wholesale UAE rates

## What it covers
- **Hotels** — search, hotel profiles, View Rates, Tariff Calendar, multi-room checkout, Price Match, Offline Inquiry, Groups & MICE
- **Attractions** — catalogue, detail, checkout, vouchers and invoices
- **Transfers** — UAE zone network, vehicle selection and quote re-check
- **Visas** — product catalogue and applications
- **Packages** — itineraries, seasonal pricing and bookings

## How it works
- **Open discovery** — search and browsing are public; no access code required.
- **Guest checkout** — submit a booking request with guest name and agency contact details.
- **Partner accounts** — optional sign-in prefills agency details and unlocks My Bookings and the agency credit wallet.
- **Find a booking** — look up a single booking by reference + agency email.
- **Operations flow** — every booking is a *request*; it shows "Requested" until UAE operations confirms it with the hotel.

## Pricing integrity
Prices travel one path: Property → Room Type → Rate Plan → Meal Plan → Daily Rate → Availability.
Quarantined daily rates are excluded per rate option, so one bad tariff never blanks a whole property; valid setups without contracted tariff show as **On Request**.

## What it doesn't do
- No payment processing — bookings are requests, not purchases
- No partner self-service cancellation or amendment — handled by operations
- Contracting, tariff, markup and integrity administration live in the separate **Admin Extranet** app

## Tech
React + Vite + TypeScript frontend, Tailwind + shadcn/ui, with backend endpoints running on the Zite platform (Zite Database).
