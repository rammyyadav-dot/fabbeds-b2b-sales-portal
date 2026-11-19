import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { ZitePdf } from 'zitejs/pdf';
import { verifyPartnerToken } from '@/lib/partnerSecurity';

export default createEndpoint({
  description: 'Generates a guest-facing hotel voucher for a confirmed authenticated partner booking',
  inputSchema: z.object({
    token: z.string(),
    bookingId: z.string(),
  }),
  outputSchema: z.object({
    url: z.string(),
    bookingReference: z.string(),
  }),
  execute: async ({ input }) => {
    const partnerId = await verifyPartnerToken(input.token);
    if (!partnerId) throw new ZiteError({ code: 'UNAUTHORIZED', message: 'Partner session expired.' });

    const { rows } = await zite.sql({
      query: `
        SELECT
          b."id", b."bookingReference", b."status", b."guestName", b."checkinDate",
          b."checkoutDate", b."rooms", b."adults", b."children", b."mealPlan",
          b."specialRequests", b."hotelConfirmationNo", b."confirmedAt",
          h."hotelName", h."location", h."emirate",
          rt."roomTypeName", rp."ratePlanName"
        FROM "Bookings" b
        JOIN "BookingsPartnerAccounts" bpa ON bpa."bookingsId" = b."id"
        LEFT JOIN "BookingsHotels" bh ON bh."bookingsId" = b."id"
        LEFT JOIN "Hotels" h ON h."id" = bh."hotelsId"
        LEFT JOIN "BookingsRoomTypes" brt ON brt."bookingsId" = b."id"
        LEFT JOIN "RoomTypes" rt ON rt."id" = brt."roomTypesId"
        LEFT JOIN "BookingsRatePlans" brp ON brp."bookingsId" = b."id"
        LEFT JOIN "RatePlans" rp ON rp."id" = brp."ratePlansId"
        WHERE b."id" = $1
          AND bpa."partnerAccountsId" = $2
        LIMIT 1
      `,
      params: [input.bookingId, partnerId],
    });

    const b: any = rows[0];
    if (!b) throw new ZiteError({ code: 'NOT_FOUND', message: 'Booking not found.' });
    if (b.status !== 'Confirmed') {
      throw new ZiteError({ code: 'CONFLICT', message: 'Voucher is available only after hotel confirmation.' });
    }
    if (!b.hotelName || !b.roomTypeName || !b.ratePlanName || !b.bookingReference) {
      throw new ZiteError({ code: 'CONFLICT', message: 'Booking is missing required hotel/rate-plan linkage.' });
    }
    if (!b.hotelConfirmationNo) {
      throw new ZiteError({ code: 'CONFLICT', message: 'Hotel confirmation number is required before voucher release.' });
    }

    const esc = (v: unknown) => String(v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const fmt = (v: unknown) => v ? new Date(String(v)).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    }) : '—';

    const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
@page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#222;font-size:10pt}
.header{background:#2d7f34;color:#fff;padding:22px;border-radius:10px;display:flex;justify-content:space-between;align-items:flex-start}
.brand{font-size:24px;font-weight:700}.sub{font-size:9px;opacity:.8;margin-top:3px;text-transform:uppercase;letter-spacing:.12em}
.ref{text-align:right;font-size:10px}.status{display:inline-block;background:#e8f6ea;color:#236b29;border:1px solid #b7dfbb;padding:5px 9px;border-radius:20px;font-weight:700}
.section{margin-top:22px}.section h2{font-size:11pt;border-bottom:1px solid #ddd;padding-bottom:7px;margin:0 0 10px}
table{width:100%;border-collapse:collapse}td{padding:7px 0;border-bottom:1px solid #f0f0f0;vertical-align:top}.label{width:34%;color:#777}
.notice{margin-top:20px;background:#f7f7f3;border:1px solid #e3e3db;border-radius:8px;padding:12px;font-size:9px;line-height:1.5}
.footer{margin-top:30px;padding-top:12px;border-top:1px solid #ddd;text-align:center;color:#888;font-size:8px}
</style></head><body>
<div class="header">
  <div><div class="brand">fabBeds</div><div class="sub">Hotel Accommodation Voucher</div></div>
  <div class="ref"><div class="status">CONFIRMED</div><div style="margin-top:9px">Booking Ref: <strong>${esc(b.bookingReference)}</strong></div><div>Hotel Ref: <strong>${esc(b.hotelConfirmationNo)}</strong></div></div>
</div>

<div class="section"><h2>Hotel Details</h2><table>
<tr><td class="label">Hotel</td><td><strong>${esc(b.hotelName)}</strong></td></tr>
<tr><td class="label">Location</td><td>${esc([b.location,b.emirate].filter(Boolean).join(', '))}</td></tr>
<tr><td class="label">Room Type</td><td>${esc(b.roomTypeName)}</td></tr>
<tr><td class="label">Rate Plan</td><td>${esc(b.ratePlanName)}</td></tr>
<tr><td class="label">Meal Plan</td><td>${esc(b.mealPlan || '—')}</td></tr>
</table></div>

<div class="section"><h2>Stay & Guest Details</h2><table>
<tr><td class="label">Lead Guest</td><td><strong>${esc(b.guestName)}</strong></td></tr>
<tr><td class="label">Check-in</td><td>${esc(fmt(b.checkinDate))}</td></tr>
<tr><td class="label">Check-out</td><td>${esc(fmt(b.checkoutDate))}</td></tr>
<tr><td class="label">Occupancy</td><td>${Number(b.rooms||0)} room(s) · ${Number(b.adults||0)} adult(s)${Number(b.children||0)>0 ? ` · ${Number(b.children)} child(ren)` : ''}</td></tr>
${b.specialRequests ? `<tr><td class="label">Special Requests</td><td>${esc(b.specialRequests)}</td></tr>` : ''}
</table></div>

<div class="notice"><strong>Important:</strong> Present this voucher at hotel check-in. This document confirms the accommodation reservation shown above. It does not display wholesale pricing, credit limit, markup or internal commercial data. Hotel policies, identification requirements and cancellation conditions remain applicable.</div>
<div class="footer">fabBeds · B2B Hotel Distribution · Voucher generated ${esc(new Date().toLocaleString('en-GB'))}</div>
</body></html>`;

    const { url } = await ZitePdf.renderHtml({
      html,
      filename: `hotel-voucher-${b.bookingReference}.pdf`,
    });

    await zite.bookingEvents.create({
      record: {
        eventName: 'hotel_voucher_generated',
        booking: input.bookingId,
        details: `Voucher generated for confirmed booking ${b.bookingReference}`,
      },
    });

    return { url, bookingReference: b.bookingReference };
  },
});
