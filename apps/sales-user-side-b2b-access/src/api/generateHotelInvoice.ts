import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { ZitePdf } from 'zitejs/pdf';
import { verifyPartnerToken } from '@/lib/partnerSecurity';

export default createEndpoint({
  description: 'Generates a partner proforma/credit invoice PDF for an authenticated hotel booking',
  inputSchema: z.object({
    token: z.string(),
    bookingId: z.string(),
  }),
  outputSchema: z.object({
    url: z.string(),
    invoiceNumber: z.string(),
    documentType: z.string(),
  }),
  execute: async ({ input }) => {
    const partnerId = await verifyPartnerToken(input.token);
    if (!partnerId) throw new ZiteError({ code: 'UNAUTHORIZED', message: 'Partner session expired.' });

    const { rows } = await zite.sql({
      query: `
        SELECT
          b."id", b."bookingReference", b."invoiceNumber", b."status", b."guestName",
          b."checkinDate", b."checkoutDate", b."rooms", b."adults", b."children",
          b."mealPlan", b."sellTotal", b."netTotal", b."companyName", b."contactEmail",
          b."creditSettlementStatus", b."creditDueDate", b."hotelConfirmationNo",
          h."hotelName", rt."roomTypeName", rp."ratePlanName"
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
    if (!b.hotelName || !b.roomTypeName || !b.ratePlanName || !b.bookingReference || Number(b.sellTotal || 0) <= 0) {
      throw new ZiteError({ code: 'CONFLICT', message: 'Invoice requires a valid priced booking with hotel, room and rate-plan linkage.' });
    }
    if (['Cancelled', 'Rejected'].includes(b.status)) {
      throw new ZiteError({ code: 'CONFLICT', message: 'Invoice is unavailable for cancelled or rejected bookings.' });
    }

    const confirmed = b.status === 'Confirmed';
    const documentType = confirmed ? 'Credit Invoice' : 'Proforma Invoice';
    const invoiceNumber = b.invoiceNumber || `INV-${String(b.bookingReference).replace(/^UAEWB-/, '')}`;
    const esc = (v: unknown) => String(v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const fmt = (v: unknown) => v ? new Date(String(v)).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    }) : '—';
    const sell = Number(b.sellTotal || 0);

    const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
@page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#222;font-size:10pt}
.header{display:flex;justify-content:space-between;border-bottom:3px solid #2d7f34;padding-bottom:14px}
.brand{font-size:25px;font-weight:700;color:#2d7f34}.doc{text-align:right}.doc h1{margin:0;font-size:18px}.muted{color:#777;font-size:9px}
.box{margin-top:18px;border:1px solid #ddd;border-radius:8px;padding:14px}.box h2{font-size:10pt;margin:0 0 10px}
table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #eee;text-align:left}th{font-size:8px;text-transform:uppercase;color:#777}.num{text-align:right}
.total{font-size:18px;font-weight:700;color:#2d7f34}.notice{margin-top:18px;background:#f7f7f3;padding:12px;border-radius:8px;font-size:9px;line-height:1.5}
.footer{margin-top:30px;border-top:1px solid #ddd;padding-top:10px;text-align:center;color:#888;font-size:8px}
</style></head><body>
<div class="header"><div><div class="brand">fabBeds</div><div class="muted">B2B Hotel Distribution</div></div>
<div class="doc"><h1>${esc(documentType)}</h1><div>${esc(invoiceNumber)}</div><div class="muted">Booking: ${esc(b.bookingReference)}</div></div></div>

<div class="box"><h2>Bill To</h2><table>
<tr><td style="width:30%">Agency</td><td><strong>${esc(b.companyName)}</strong></td></tr>
<tr><td>Email</td><td>${esc(b.contactEmail)}</td></tr>
<tr><td>Credit Status</td><td>${esc(b.creditSettlementStatus || 'Open')}</td></tr>
<tr><td>Credit Due Date</td><td>${esc(fmt(b.creditDueDate))}</td></tr>
</table></div>

<div class="box"><h2>Reservation</h2><table>
<tr><td style="width:30%">Hotel</td><td>${esc(b.hotelName)}</td></tr>
<tr><td>Room / Rate</td><td>${esc(b.roomTypeName)} · ${esc(b.ratePlanName)}</td></tr>
<tr><td>Meal Plan</td><td>${esc(b.mealPlan || '—')}</td></tr>
<tr><td>Guest</td><td>${esc(b.guestName)}</td></tr>
<tr><td>Stay</td><td>${esc(fmt(b.checkinDate))} – ${esc(fmt(b.checkoutDate))}</td></tr>
<tr><td>Occupancy</td><td>${Number(b.rooms||0)} room(s) · ${Number(b.adults||0)} adult(s)${Number(b.children||0)>0 ? ` · ${Number(b.children)} child(ren)` : ''}</td></tr>
${confirmed && b.hotelConfirmationNo ? `<tr><td>Hotel Confirmation</td><td>${esc(b.hotelConfirmationNo)}</td></tr>` : ''}
</table></div>

<div class="box"><table>
<thead><tr><th>Description</th><th class="num">Amount (AED)</th></tr></thead>
<tbody><tr><td>Hotel accommodation — ${esc(b.roomTypeName)} / ${esc(b.ratePlanName)}</td><td class="num">${sell.toFixed(2)}</td></tr>
<tr><td><strong>Total</strong></td><td class="num total">AED ${sell.toFixed(2)}</td></tr></tbody>
</table></div>

<div class="notice"><strong>${confirmed ? 'Credit invoice:' : 'Proforma only:'}</strong> No payment gateway is used. Settlement is handled offline against the agency credit account. ${confirmed ? 'This document reflects a confirmed hotel reservation.' : 'The reservation is still pending hotel confirmation and this document is not a hotel voucher.'}</div>
<div class="footer">fabBeds · Document generated ${esc(new Date().toLocaleString('en-GB'))}</div>
</body></html>`;

    const { url } = await ZitePdf.renderHtml({
      html,
      filename: `${confirmed ? 'invoice' : 'proforma'}-${b.bookingReference}.pdf`,
    });

    await zite.bookingEvents.create({
      record: {
        eventName: confirmed ? 'hotel_credit_invoice_generated' : 'hotel_proforma_generated',
        booking: input.bookingId,
        details: `${documentType} generated: ${invoiceNumber}`,
      },
    });

    return { url, invoiceNumber, documentType };
  },
});
