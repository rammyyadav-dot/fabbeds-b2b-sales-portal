import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { ZitePdf } from 'zitejs/pdf';
import { verifyPartnerToken } from '@/lib/partnerSecurity';
import { FABBEDS } from '../lib/brand';

const linkedId = (v: unknown) => Array.isArray(v) ? String(v[0] || '') : String(v || '');
const esc = (v: unknown) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

export default createEndpoint({
  description: 'Generates an authenticated B2B attraction proforma/credit invoice in AED',
  inputSchema: z.object({ token: z.string(), bookingId: z.string() }),
  outputSchema: z.object({ url: z.string(), invoiceNumber: z.string(), documentType: z.string() }),
  execute: async ({ input }) => {
    const partnerId = await verifyPartnerToken(input.token);
    if (!partnerId) throw new ZiteError({ code: 'UNAUTHORIZED', message: 'Partner session expired.' });

    const b = await zite.attractionBookings.findOne({ id: input.bookingId }) as any;
    if (!b || linkedId(b.partnerAccount) !== partnerId) throw new ZiteError({ code: 'NOT_FOUND', message: 'Reservation not found.' });

    const status = b.reservationStatus || b.bookingStatus || 'Awaiting Confirmation';
    if (['Cancelled','Rejected'].includes(status)) throw new ZiteError({ code: 'CONFLICT', message: 'Invoice is unavailable for cancelled/rejected reservations.' });

    const confirmed = status === 'Confirmed';
    const documentType = confirmed ? 'Credit Invoice' : 'Proforma Invoice';
    const total = Number(b.totalSellPrice || 0);
    if (total <= 0) throw new ZiteError({ code: 'CONFLICT', message: 'Reservation has no valid AED sell amount.' });

    const supportRows = await zite.sql({
      query: `SELECT "bookingEmail","customerCareNumber" FROM "SupportSettings" WHERE "isActive"=TRUE ORDER BY "created_at" DESC LIMIT 1`
    }).catch(() => ({ rows: [] as any[] }));
    const support:any = supportRows.rows[0] || {};
    const supportEmail = support.bookingEmail || 'book@fbeds.com';
    const supportPhone = support.customerCareNumber || '';

    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      @page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#222;font-size:10pt}
      .head{display:flex;justify-content:space-between;border-bottom:3px solid ${FABBEDS.primaryRed};padding-bottom:14px}
      .brand-wordmark{font-size:28px;font-weight:900;font-style:italic;letter-spacing:-1.5px;line-height:1}.brand-wordmark .fab{color:#111}.brand-wordmark .beds{color:${FABBEDS.primaryRed}}.muted{color:#777;font-size:9px;margin-top:5px}.doc{text-align:right}
      .box{margin-top:18px;border:1px solid #ddd;border-radius:8px;padding:14px}table{width:100%;border-collapse:collapse}
      td,th{padding:8px;border-bottom:1px solid #eee;text-align:left}.num{text-align:right}.total{font-size:18px;font-weight:700;color:${FABBEDS.primaryRed}}
      .note{margin-top:18px;background:#f7f7f3;padding:12px;border-radius:8px;font-size:9px;line-height:1.5}
    </style></head><body>
    <div class="head"><div><img src="https://uaewb.zite.so/fabbeds-logo.svg" alt="fabBeds" width="160" style="height:auto;display:block" /><div class="muted">${FABBEDS.tagline} · B2B Attractions</div></div>
    <div class="doc"><h2>${esc(documentType)}</h2><div>${esc(b.invoiceNumber || '')}</div><div class="muted">Booking: ${esc(b.bookingReference || '')}</div></div></div>
    <div class="box"><table>
      <tr><td>Agency</td><td><strong>${esc(b.companyName)}</strong></td></tr>
      <tr><td>Email</td><td>${esc(b.contactEmail)}</td></tr>
      <tr><td>Attraction</td><td>${esc(b.attractionName)}</td></tr>
      <tr><td>Ticket / SKU</td><td>${esc(b.ticketOptionName)} · ${esc(b.skuSnapshot || '')}</td></tr>
      <tr><td>Visit Date / Slot</td><td>${esc(String(b.targetDate || '').slice(0,10))}${b.targetSlot ? ' · '+esc(b.targetSlot) : ''}</td></tr>
      <tr><td>Pax</td><td>${Number(b.adultCount||0)} Adult(s) · ${Number(b.childCount||0)} Child(ren)</td></tr>
      <tr><td>Credit due</td><td>${esc(String(b.creditDueDate || '').slice(0,10))}</td></tr>
    </table></div>
    <div class="box"><table><tr><th>Description</th><th class="num">Amount AED</th></tr>
      <tr><td>${esc(b.ticketOptionName)} — B2B agency booking</td><td class="num">${total.toFixed(2)}</td></tr>
      <tr><td><strong>Total</strong></td><td class="num total">AED ${total.toFixed(2)}</td></tr>
    </table></div>
    <div class="note"><strong>${confirmed ? 'Credit invoice:' : 'Proforma only:'}</strong> No payment gateway is used. Settlement is handled offline against the agency credit account. ${confirmed ? 'The attraction reservation is confirmed.' : 'Supplier/operations confirmation is still pending; this document is not a voucher.'}</div>
    <div class="note"><strong>Booking Support:</strong> ${esc(supportEmail)}${supportPhone ? ` · Customer Care: ${esc(supportPhone)}` : ''}. Quote booking reference ${esc(b.bookingReference || '')} when contacting support.</div>
    </body></html>`;

    const { url } = await ZitePdf.renderHtml({ html, filename: `${confirmed ? 'invoice' : 'proforma'}-${b.bookingReference || b.id}.pdf` });
    await zite.attractionBookingEvents.create({
      record:{
        eventName:confirmed?'CREDIT_INVOICE_GENERATED':'PROFORMA_INVOICE_GENERATED',
        booking:b.id,
        details:`${documentType} ${b.invoiceNumber || ''} generated`,
      },
    });
    return { url, invoiceNumber: b.invoiceNumber || '', documentType };
  },
});
