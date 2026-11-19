import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { ZitePdf } from 'zitejs/pdf';
import { verifyPartnerToken } from '@/lib/partnerSecurity';
import { FABBEDS } from '../lib/brand';

const linkedId = (v: unknown) => Array.isArray(v) ? String(v[0] || '') : String(v || '');
const esc = (v: unknown) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

export default createEndpoint({
  description: 'Generates a guest-facing attraction voucher only after authoritative confirmation',
  inputSchema: z.object({ token: z.string(), bookingId: z.string() }),
  outputSchema: z.object({ url: z.string(), bookingReference: z.string(), voucherNumber: z.string() }),
  execute: async ({ input }) => {
    const partnerId = await verifyPartnerToken(input.token);
    if (!partnerId) throw new ZiteError({ code: 'UNAUTHORIZED', message: 'Partner session expired.' });

    const b = await zite.attractionBookings.findOne({ id: input.bookingId }) as any;
    if (!b || linkedId(b.partnerAccount) !== partnerId) throw new ZiteError({ code: 'NOT_FOUND', message: 'Reservation not found.' });

    const status = b.reservationStatus || b.bookingStatus || 'Awaiting Confirmation';
    if (status !== 'Confirmed' || !b.supplierConfirmationNo) {
      throw new ZiteError({ code: 'CONFLICT', message: 'Voucher is available only after supplier/operations confirmation.' });
    }

    const supportRows = await zite.sql({
      query: `SELECT "bookingEmail","customerCareNumber" FROM "SupportSettings" WHERE "isActive"=TRUE ORDER BY "created_at" DESC LIMIT 1`
    }).catch(() => ({ rows: [] as any[] }));
    const support:any = supportRows.rows[0] || {};
    const supportEmail = support.bookingEmail || 'book@fbeds.com';
    const supportPhone = support.customerCareNumber || '';

    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      @page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#222;font-size:10pt}
      .header{background:#ffffff;color:#222;padding:22px;border-radius:10px;display:flex;justify-content:space-between;border:2px solid ${FABBEDS.primaryRed}}
      .brand-wordmark{font-size:28px;font-weight:900;font-style:italic;letter-spacing:-1.5px;line-height:1}.brand-wordmark .fab{color:#111}.brand-wordmark .beds{color:${FABBEDS.primaryRed}}.muted{font-size:9px;color:#666;margin-top:5px}.right{text-align:right}
      .section{margin-top:22px}.section h2{font-size:11pt;border-bottom:1px solid #ddd;padding-bottom:7px}
      table{width:100%;border-collapse:collapse}td{padding:7px 0;border-bottom:1px solid #eee}.label{width:34%;color:#777}
      .note{margin-top:20px;background:#f7f7f3;border:1px solid #e3e3db;border-radius:8px;padding:12px;font-size:9px;line-height:1.5}
    </style></head><body>
    <div class="header"><div><img src="https://uaewb.zite.so/fabbeds-logo.svg" alt="fabBeds" width="160" style="height:auto;display:block" /><div class="muted">CONFIRMED ATTRACTION VOUCHER</div></div>
    <div class="right">Voucher <strong>${esc(b.voucherNumber || '')}</strong><br/>Booking <strong>${esc(b.bookingReference || '')}</strong><br/>Supplier Ref <strong>${esc(b.supplierConfirmationNo)}</strong></div></div>
    <div class="section"><h2>Experience</h2><table>
      <tr><td class="label">Attraction</td><td><strong>${esc(b.attractionName)}</strong></td></tr>
      <tr><td class="label">Ticket / SKU</td><td>${esc(b.ticketOptionName)} · ${esc(b.skuSnapshot || '')}</td></tr>
      <tr><td class="label">Visit date</td><td>${esc(String(b.targetDate || '').slice(0,10))}</td></tr>
      ${b.targetSlot ? `<tr><td class="label">Time slot</td><td>${esc(b.targetSlot)}</td></tr>` : ''}
      <tr><td class="label">Pax</td><td>${Number(b.adultCount||0)} Adult(s) · ${Number(b.childCount||0)} Child(ren)</td></tr>
    </table></div>
    <div class="section"><h2>Guest</h2><table>
      <tr><td class="label">Lead guest</td><td><strong>${esc(b.guestName)}</strong></td></tr>
      ${b.guestNationality ? `<tr><td class="label">Nationality</td><td>${esc(b.guestNationality)}</td></tr>` : ''}
      ${b.specialRequests ? `<tr><td class="label">Special requests</td><td>${esc(b.specialRequests)}</td></tr>` : ''}
    </table></div>
    <div class="section"><h2>Important information</h2><table>
      <tr><td class="label">Cancellation</td><td>${esc(b.cancellationSnapshot || 'As per supplier policy')}</td></tr>
    </table></div>
    <div class="note">Present this voucher at the attraction/meeting point as instructed. This guest-facing document intentionally excludes supplier net cost, agency credit limit, margin and other internal B2B commercial data.</div>
    <div class="note"><strong>Booking Support:</strong> ${esc(supportEmail)}${supportPhone ? ` · Customer Care: ${esc(supportPhone)}` : ''}. Quote booking reference ${esc(b.bookingReference || '')} when contacting support.</div>
    </body></html>`;

    const { url } = await ZitePdf.renderHtml({ html, filename: `attraction-voucher-${b.bookingReference || b.id}.pdf` });

    const { records: lines } = await zite.attractionBookingLines.findAll({ filters: { booking: b.id }, limit: 100 });
    for (const line of lines) {
      if (!line.voucherIssued) await zite.attractionBookingLines.update({ id: line.id, record: { voucherIssued: true } });
    }
    await zite.attractionBookings.update({ id: b.id, record: { bookingStatus: 'Vouchered' } as any });
    await zite.attractionBookingEvents.create({
      record:{
        eventName:'VOUCHER_GENERATED',
        booking:b.id,
        details:`Voucher ${b.voucherNumber || ''} generated for confirmed reservation`,
      },
    });

    return { url, bookingReference: b.bookingReference || '', voucherNumber: b.voucherNumber || '' };
  },
});
