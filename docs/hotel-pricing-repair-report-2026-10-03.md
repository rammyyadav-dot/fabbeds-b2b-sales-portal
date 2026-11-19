# Hotel Pricing Repair Report — 2026-10-03

## Scope

Admin Extranet + Sales Portal canonical hotel commercial pricing:

Hotel → Room Type → Rate Plan → Meal Plan Master → Daily Rate → Occupancy → Event Supplement → Allocation → Markup → Agent Sell Rate.

## Implemented

- Shared hotel pricing engine used for layer/priority resolution, markup priority, markup caps, occupancy, stay restrictions, allocation and commercial-chain validation.
- Shared event pricing engine used by Sales and Admin booking recheck.
- Admin Search migrated away from local pricing helpers to canonical pricing functions.
- Admin Calculate Price migrated away from duplicate layer/markup/occupancy implementations.
- Admin booking creation now performs authoritative commercial-chain, AED, stay restriction, allocation, event and markup recheck before creating a booking.
- Booking records now persist an immutable pricing snapshot.
- Sales Search and Checkout now evaluate CTD on the actual checkout date.
- Admin Search and booking recheck now evaluate CTD on the actual checkout date.
- Admin property validation now blocks orphan/noncanonical/non-AED active Rate Plans and only counts exact valid AED Daily Rate coverage.
- Admin published readiness now fails closed when commercial validation fails.

## Current database integrity

- Active Hotels: 39
- Active Room Types: 371
- Active Rate Plans: 93
- Daily Rates: 12,814
- Quarantined Daily Rates: 3,802
- Active Rate Plans missing Hotel: 0
- Active Rate Plans missing Room Type: 0
- Active Rate Plans missing Meal Plan Master: 0
- Active Rate Plan / Meal Master mismatches: 0
- Active Events without Hotel scope: 0
- Non-AED Daily Rates: 2; both quarantined
- Non-quarantined Daily Rates with no positive adult rate: 0
- Non-quarantined duplicate effective-rate keys: 0

## Safety

No historical Daily Rates or legacy Net Rates were deleted. No USD/EUR amount was converted into AED. No missing rate was made sellable. No On Request inventory was converted to Free Sale. Attractions, Transfers, Visa, Packages and homepage visuals were not changed by this mission.

## Acceptance

- Shared pricing engine compile: PASS
- Sales app typecheck / endpoint bundle check: PASS
- Admin app typecheck / endpoint bundle check: PASS
- Canonical rate-layer resolution: implemented
- Canonical markup resolver: implemented
- Rate-plan-aware Admin Tariff: present
- AED enforcement: present
- Commercial integrity panel: present
- Publish gate hardening: implemented
- Checkout authoritative hotel recheck: implemented
- Database commercial integrity: PARTIAL — historical quarantined rows remain intentionally preserved for audit
