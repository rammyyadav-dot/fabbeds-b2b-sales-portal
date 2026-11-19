# UAEWB Attractions & Tickets — B2B Production Blueprint

## Product boundary

UAEWB Attractions is a UAE-only, AED-only B2B distribution workflow for travel agents, tour operators and DMCs. There is no online payment gateway. Reservations consume the same approved agency credit facility used by hotel bookings.

## Authority chain

```
Attraction Master
  -> Ticket / SKU Master
  -> Date + Slot Rate / Allocation
  -> Server-side Offer Recheck
  -> Agency Credit Validation
  -> Attraction Reservation
  -> Supplier / Operations Confirmation
  -> Voucher + Credit Invoice
```

The browser is never authoritative for price, agency identity, cancellation terms, availability, allocation or confirmation status.

## Catalogue

Attraction master contains destination/category/content/policy data.

Ticket options are the sellable SKUs. SKU codes must remain stable after commercial use.

## Rate and allocation engine

Attraction Rates are AED-only and date/slot scoped.

Rate resolution priority:

1. OVERRIDE
2. PROMO
3. BASE
4. FALLBACK

Within the same layer, higher Priority wins. Stop Sale, Sold Out, non-AED, cutoff-expired and non-positive rate rows fail closed.

Manual Extranet rate loading supports:
- date range
- optional slot
- adult/child net
- suggested retail
- allocation
- inventory status
- Stop Sale
- booking cutoff
- rate layer
- priority

## Recheck

A recheck validates:
- attraction is Active
- ticket option is Active
- ticket belongs to attraction
- date / slot
- pax limits
- positive AED rate
- Stop Sale
- inventory status
- allocation
- booking cutoff
- rate layer / priority
- cancellation snapshot

The returned Offer ID is re-derived again at booking creation.

## Agency credit

Attraction reservations share the partner wallet with hotel reservations.

```
Available Credit =
Credit Limit
- Open Hotel Exposure
- Open Attraction Exposure
```

New attraction reservations are blocked when:
- credit is not Approved
- credit limit is zero
- available credit is insufficient
- any shared credit exposure is overdue

## Reservation status

Public/agent status:
- Awaiting Confirmation
- Confirmed
- Cancellation Requested
- Cancelled
- Rejected
- Completed

Creating a reservation does not fabricate supplier confirmation. Even products marked instant-eligible stay Awaiting Confirmation until a real supplier/operations reference is recorded in the Admin Extranet.

## Confirmation

Admin confirmation requires:
- existing reservation
- price snapshot with rate linkage
- supplier confirmation number
- rate not Stop Sale / Sold Out
- sufficient allocation

On confirmation:
- Sold Count is increased
- Supplier Confirmation No is stored
- Confirmed At is stamped
- voucher becomes eligible

On cancellation/rejection:
- confirmed allocation is restored
- credit exposure is Released

## Documents

Before confirmation:
- Proforma Invoice available
- Voucher locked

After confirmation:
- Credit Invoice available
- Guest Voucher available

Guest voucher excludes:
- supplier net
- agency credit limit
- internal margin
- other B2B commercial data

## Audit

Attraction Booking Events records:
- booking creation
- allocation reservation
- supplier confirmation
- cancellation / rejection
- invoice generation
- voucher generation

## Admin Extranet

Route: `/attractions`

Sections:
- Catalogue
- SKU / Ticket Options
- Rates & Allocation
- Reservations

## Current data readiness

Code and schema can support production-style attraction reservations, but inventory is only sellable when future positive AED rates are loaded against Active SKUs. Historical rate rows are ignored by public price discovery and authoritative recheck.
