/** Opens a clean new window with styled HTML and triggers print/save as PDF */
export function printDocument(htmlBody: string, title: string = 'Document') {
  const win = window.open('', '_blank', 'width=960,height=800');
  if (!win) { alert('Please allow popups to download PDF'); return; }

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 13px;
      color: #1a1a2e;
      background: #fff;
      padding: 40px 48px;
      max-width: 860px;
      margin: 0 auto;
    }
    @media print {
      body { padding: 20px 24px; }
      .no-print { display: none !important; }
    }
    .print-btn {
      position: fixed; top: 16px; right: 16px;
      background: #1e40af; color: white; border: none;
      padding: 10px 20px; border-radius: 8px; cursor: pointer;
      font-size: 13px; font-weight: 600; z-index: 999;
      display: flex; align-items: center; gap: 8px;
    }
    .print-btn:hover { background: #1d4ed8; }
    /* ─── shared layout ─── */
    .doc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-logo { width: 44px; height: 44px; background: #1e40af; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .brand-logo svg { width: 24px; height: 24px; fill: white; }
    .brand-name { font-size: 16px; font-weight: 700; color: #1e40af; }
    .brand-sub { font-size: 10px; color: #64748b; letter-spacing: 0.05em; text-transform: uppercase; }
    .doc-meta { text-align: right; }
    .doc-type { font-size: 22px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 0.04em; }
    .doc-ref { font-size: 11px; color: #64748b; margin-top: 4px; }
    .doc-ref span { font-weight: 700; color: #1a1a2e; }
    .divider { border: none; border-top: 2px solid #e2e8f0; margin: 20px 0; }
    .divider-accent { border: none; border-top: 3px solid #1e40af; margin: 20px 0; }
    .section-title {
      font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
      color: #64748b; margin-bottom: 10px; padding-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
    }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .field-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
    .field-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px; }
    .field-value { font-size: 13px; font-weight: 600; color: #1a1a2e; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    thead tr { background: #1e40af; color: white; }
    thead th { padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; }
    tbody tr { border-bottom: 1px solid #e2e8f0; }
    tbody tr:last-child { border-bottom: none; }
    tbody td { padding: 10px 14px; font-size: 12px; color: #374151; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .total-box { background: #eff6ff; border: 2px solid #bfdbfe; border-radius: 10px; padding: 16px 20px; }
    .total-row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; }
    .total-row.grand { font-size: 16px; font-weight: 800; color: #1e40af; border-top: 2px solid #bfdbfe; padding-top: 10px; margin-top: 8px; }
    .total-row .label { color: #475569; }
    .total-row.grand .label { color: #1e40af; }
    .status-badge {
      display: inline-block; padding: 4px 12px; border-radius: 20px;
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
    }
    .badge-confirmed { background: #dcfce7; color: #15803d; }
    .badge-sent { background: #dcfce7; color: #15803d; }
    .badge-draft { background: #f1f5f9; color: #64748b; }
    .badge-pending { background: #fef9c3; color: #854d0e; }
    .terms-list { list-style: none; padding: 0; }
    .terms-list li { padding: 5px 0; font-size: 11px; color: #475569; display: flex; gap: 8px; }
    .terms-list li::before { content: "•"; color: #1e40af; font-weight: bold; }
    .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end; }
    .footer-contact { font-size: 11px; color: #64748b; line-height: 1.7; }
    .footer-contact strong { color: #1a1a2e; font-size: 13px; }
    .signature-line { text-align: right; }
    .signature-line .line { border-bottom: 2px solid #1a1a2e; width: 180px; margin-bottom: 4px; margin-top: 32px; }
    .signature-line .role { font-size: 11px; color: #64748b; }
    .watermark-confirmed {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 80px; font-weight: 900; color: rgba(21,128,61,0.06);
      text-transform: uppercase; letter-spacing: 0.1em; pointer-events: none; z-index: 0; white-space: nowrap;
    }
    .info-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
    .info-box p { font-size: 12px; color: #1e40af; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
    Print / Save as PDF
  </button>
  ${htmlBody}
</body>
</html>`);
  win.document.close();
}

const BRAND_LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;

function brandHeader() {
  return `<div class="doc-header">
    <div class="brand">
      <div class="brand-logo">${BRAND_LOGO}</div>
      <div>
        <div class="brand-name">UAE Hotels TMS</div>
        <div class="brand-sub">Travel Management System</div>
      </div>
    </div>`;
}

export interface VoucherData {
  bookingRef: string;
  status: string;
  hotelName: string;
  destination?: string;
  hotelAddress?: string;
  hotelEmail?: string;
  hotelPhone?: string;
  hotelConfirmationNumber?: string;
  supplierRef?: string;
  voucherNumber?: string;
  roomType?: string;
  boardBasis?: string;
  checkinDate?: string;
  checkoutDate?: string;
  checkinTime?: string;
  checkoutTime?: string;
  nights: number;
  rooms?: number | null;
  adults?: number | null;
  children?: number | null;
  childAges?: string;
  guestName?: string;
  nationality?: string;
  passportNo?: string;
  agentCompany?: string;
  agentName?: string;
  agentEmail?: string;
  sellingRateAed?: number | null;
  specialRequests?: string | null;
}

export function buildVoucherHtml(d: VoucherData): string {
  const fmt = (v?: string | null) => { try { return v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; } catch { return v ?? '—'; } };
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const isConfirmed = d.status?.toLowerCase().includes('confirm');
  const statusClass = isConfirmed ? 'badge-confirmed' : 'badge-pending';
  const agent = d.agentCompany || d.agentName || '—';
  const voucherNo = d.voucherNumber || `VCH-${d.bookingRef.replace(/^[A-Z]+-/, '')}`;

  return `${brandHeader()}
    <div class="doc-meta">
      <div class="doc-type">Booking Confirmation Voucher</div>
      <div class="doc-ref" style="margin-top:6px">Booking Ref: <span>${d.bookingRef}</span></div>
      ${d.supplierRef ? `<div class="doc-ref">Supplier Ref: <span>${d.supplierRef}</span></div>` : ''}
      <div class="doc-ref">Voucher No: <span>${voucherNo}</span></div>
      <div style="margin-top:8px"><span class="status-badge ${statusClass}">${isConfirmed ? '✓ ' : ''}${d.status.toUpperCase()}</span></div>
    </div>
  </div>
  <hr class="divider-accent" />

  <div class="section-title">🏨 Property Details</div>
  <div class="grid-2">
    <div class="field-box"><div class="field-label">Hotel</div><div class="field-value">${d.hotelName}</div></div>
    <div class="field-box"><div class="field-label">Destination</div><div class="field-value">${d.destination || '—'}</div></div>
    ${d.hotelAddress ? `<div class="field-box"><div class="field-label">Address</div><div class="field-value">${d.hotelAddress}</div></div>` : ''}
    ${d.hotelEmail ? `<div class="field-box"><div class="field-label">Contact Email</div><div class="field-value">${d.hotelEmail}</div></div>` : ''}
    ${d.hotelPhone ? `<div class="field-box"><div class="field-label">Phone</div><div class="field-value">${d.hotelPhone}</div></div>` : ''}
    ${d.hotelConfirmationNumber ? `<div class="field-box"><div class="field-label">Hotel Confirmation #</div><div class="field-value">${d.hotelConfirmationNumber}</div></div>` : ''}
  </div>

  <div class="section-title">🛏 Room Details</div>
  <div class="grid-2">
    <div class="field-box"><div class="field-label">Room Type</div><div class="field-value">${d.roomType || '—'}</div></div>
    <div class="field-box"><div class="field-label">Board Basis</div><div class="field-value">${d.boardBasis || '—'}</div></div>
    <div class="field-box"><div class="field-label">Rooms</div><div class="field-value">${d.rooms ?? '—'}</div></div>
    <div class="field-box"><div class="field-label">Occupancy</div><div class="field-value">${d.adults ?? '—'} Adult(s)${d.children ? ` + ${d.children} Child(ren)` : ''}</div></div>
    ${d.childAges ? `<div class="field-box"><div class="field-label">Child Ages</div><div class="field-value">${d.childAges}</div></div>` : ''}
  </div>

  <div class="section-title">📅 Stay Details</div>
  <div class="grid-3">
    <div class="field-box"><div class="field-label">Check-in</div><div class="field-value">${fmt(d.checkinDate)}</div></div>
    <div class="field-box"><div class="field-label">Check-out</div><div class="field-value">${fmt(d.checkoutDate)}</div></div>
    <div class="field-box"><div class="field-label">Nights</div><div class="field-value">${d.nights}</div></div>
    <div class="field-box"><div class="field-label">Check-in Time</div><div class="field-value">${d.checkinTime || '3:00 PM'}</div></div>
    <div class="field-box"><div class="field-label">Check-out Time</div><div class="field-value">${d.checkoutTime || '12:00 PM'}</div></div>
  </div>

  <div class="section-title">👤 Guest Details</div>
  <div class="grid-2">
    <div class="field-box"><div class="field-label">Lead Guest</div><div class="field-value">${d.guestName || '—'}</div></div>
    ${d.nationality ? `<div class="field-box"><div class="field-label">Nationality</div><div class="field-value">${d.nationality}</div></div>` : ''}
    ${d.passportNo ? `<div class="field-box"><div class="field-label">Passport No</div><div class="field-value">${d.passportNo}</div></div>` : ''}
    <div class="field-box"><div class="field-label">Agent / Company</div><div class="field-value">${agent}</div></div>
    ${d.agentEmail ? `<div class="field-box"><div class="field-label">Agent Contact</div><div class="field-value">${d.agentEmail}</div></div>` : ''}
  </div>



  ${d.specialRequests ? `
  <div class="section-title" style="margin-top:16px">Special Requests</div>
  <div class="info-box"><p>"${d.specialRequests}"</p></div>` : ''}

  <div class="section-title" style="margin-top:20px">🛡 Terms &amp; Conditions</div>
  <ul class="terms-list">
    <li>This voucher confirms accommodation only.</li>
    <li>Extras not included unless specified.</li>
    <li>Hotel standard check-in/out times apply.</li>
    <li>Tourism Dirham payable directly at hotel (if applicable).</li>
    <li>This document must be presented at check-in.</li>
  </ul>

  <div class="footer">
    <div class="footer-contact">
      <strong>UAE Hotels TMS — Reservations Team</strong><br/>
      Email: reservations@uaehotels.com &nbsp;|&nbsp; Phone: +971 4 000 0000<br/>
      <span style="font-size:10px;color:#94a3b8">Generated on ${today}</span>
    </div>
    <div class="signature-line">
      <div class="line"></div>
      <div class="role">Authorized Signature</div>
    </div>
  </div>
  <div class="watermark-confirmed">${d.status}</div>`;
}

export interface InvoiceData {
  invoiceNumber: string;
  reservationRef: string;
  hotelName?: string;
  destination?: string;
  roomType?: string;
  boardBasis?: string;
  checkinDate?: string;
  checkoutDate?: string;
  nights: number;
  rooms?: number | null;
  adults?: number | null;
  children?: number | null;
  agentName?: string;
  agentCompany?: string;
  agentEmail?: string;
  subtotal: number;
  vat: number;
  total: number;
  dueDate?: string;
  invoiceNotes?: string;
}

export function buildInvoiceHtml(d: InvoiceData): string {
  const fmt = (v?: string | null) => { try { return v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; } catch { return v ?? '—'; } };
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const billTo = d.agentCompany || d.agentName || '—';

  return `${brandHeader()}
    <div class="doc-meta">
      <div class="doc-type">Invoice</div>
      <div class="doc-ref">Invoice #: <span>${d.invoiceNumber}</span></div>
      <div class="doc-ref">Date: <span>${today}</span></div>
      ${d.dueDate ? `<div class="doc-ref">Due: <span>${fmt(d.dueDate)}</span></div>` : ''}
    </div>
  </div>
  <hr class="divider-accent" />

  <div class="grid-2" style="margin-bottom:24px">
    <div>
      <div class="section-title">Bill To</div>
      <div class="field-box">
        <div class="field-value">${billTo}</div>
        ${d.agentEmail ? `<div style="font-size:11px;color:#64748b;margin-top:4px">${d.agentEmail}</div>` : ''}
      </div>
    </div>
    <div>
      <div class="section-title">Booking Reference</div>
      <div class="field-box">
        <div class="field-label">Reservation Ref</div>
        <div class="field-value">${d.reservationRef}</div>
      </div>
    </div>
  </div>

  <div class="section-title">Services Rendered</div>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Details</th>
        <th style="text-align:right">Amount (AED)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <strong>${d.hotelName || 'Hotel Accommodation'}</strong><br/>
          <span style="font-size:11px;color:#64748b">${d.roomType || ''}${d.boardBasis ? ` — ${d.boardBasis}` : ''}</span>
        </td>
        <td>
          ${fmt(d.checkinDate)} → ${fmt(d.checkoutDate)}<br/>
          <span style="font-size:11px;color:#64748b">${d.nights} night(s) × ${d.rooms ?? 1} room(s) · ${d.adults ?? 2} Adult(s)${d.children ? ` + ${d.children} Child(ren)` : ''}</span>
        </td>
        <td style="text-align:right;font-weight:600">${d.subtotal.toLocaleString('en', { minimumFractionDigits: 2 })}</td>
      </tr>
    </tbody>
  </table>

  <div class="total-box">
    <div class="total-row"><span class="label">Subtotal</span><span>AED ${d.subtotal.toLocaleString('en', { minimumFractionDigits: 2 })}</span></div>
    <div class="total-row"><span class="label">VAT (5%)</span><span>AED ${d.vat.toLocaleString('en', { minimumFractionDigits: 2 })}</span></div>
    <div class="total-row grand"><span class="label">Total Due</span><span>AED ${d.total.toLocaleString('en', { minimumFractionDigits: 2 })}</span></div>
  </div>

  ${d.invoiceNotes ? `<div class="info-box" style="margin-top:16px"><p><strong>Notes:</strong> ${d.invoiceNotes}</p></div>` : ''}

  <div class="section-title" style="margin-top:20px">Payment Terms</div>
  <ul class="terms-list">
    <li>Payment due within 30 days of invoice date</li>
    <li>Bank transfer to UAE Hotels TMS — IBAN: AE00 0000 0000 0000 0000 000</li>
    <li>Please quote invoice number as payment reference</li>
    <li>Late payments may incur a 2% monthly charge</li>
  </ul>

  <div class="footer">
    <div class="footer-contact">
      <strong>UAE Hotels TMS — Finance Department</strong><br/>
      Email: finance@uaehotels.com &nbsp;|&nbsp; Phone: +971 4 000 0000<br/>
      <span style="font-size:10px;color:#94a3b8">Generated on ${today}</span>
    </div>
    <div class="signature-line">
      <div class="line"></div>
      <div class="role">Authorized Signature</div>
    </div>
  </div>`;
}

export interface LpoData {
  lpoNumber: string;
  status: string;
  hotelName?: string;
  destination?: string;
  reservationRef?: string;
  agentName?: string;
  checkinDate?: string;
  checkoutDate?: string;
  nights: number;
  rooms?: number | null;
  adults?: number | null;
  children?: number | null;
  roomType?: string;
  boardBasis?: string;
  netRateAed?: number | null;
  ratePerNight: number;
  supplierEmail?: string;
}

export function buildLpoHtml(d: LpoData): string {
  const fmt = (v?: string | null) => { try { return v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; } catch { return v ?? '—'; } };
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const netTotal = d.netRateAed ?? 0;
  const statusClass = d.status === 'Sent' ? 'badge-sent' : 'badge-draft';

  return `${brandHeader()}
    <div class="doc-meta">
      <div class="doc-type">Local Purchase Order</div>
      <div class="doc-ref">LPO #: <span>${d.lpoNumber}</span></div>
      <div class="doc-ref">Date: <span>${today}</span></div>
      <div style="margin-top:6px"><span class="status-badge ${statusClass}">${d.status}</span></div>
    </div>
  </div>
  <hr class="divider-accent" />

  <div class="section-title">Supplier / Hotel Details</div>
  <div class="grid-2">
    <div class="field-box"><div class="field-label">Hotel Name</div><div class="field-value">${d.hotelName || '—'}</div></div>
    <div class="field-box"><div class="field-label">Destination</div><div class="field-value">${d.destination || '—'}, UAE</div></div>
    ${d.supplierEmail ? `<div class="field-box"><div class="field-label">Reservation Contact</div><div class="field-value">${d.supplierEmail}</div></div>` : ''}
  </div>

  <div class="section-title">Reservation Details</div>
  <div class="grid-3">
    <div class="field-box"><div class="field-label">Booking Ref</div><div class="field-value">${d.reservationRef || '—'}</div></div>
    <div class="field-box"><div class="field-label">Guest / Agent</div><div class="field-value">${d.agentName || '—'}</div></div>
    <div class="field-box"><div class="field-label">Room Type</div><div class="field-value">${d.roomType || '—'}</div></div>
    <div class="field-box"><div class="field-label">Check-in</div><div class="field-value">${fmt(d.checkinDate)}</div></div>
    <div class="field-box"><div class="field-label">Check-out</div><div class="field-value">${fmt(d.checkoutDate)}</div></div>
    <div class="field-box"><div class="field-label">Nights</div><div class="field-value">${d.nights}</div></div>
    <div class="field-box"><div class="field-label">Rooms</div><div class="field-value">${d.rooms ?? '—'}</div></div>
    <div class="field-box"><div class="field-label">Board Basis</div><div class="field-value">${d.boardBasis || '—'}</div></div>
    <div class="field-box"><div class="field-label">Occupancy</div><div class="field-value">${d.adults ?? '—'} AD${d.children ? ` + ${d.children} CH` : ''}</div></div>
  </div>

  <div class="section-title">Rate & Amount</div>
  <table>
    <thead>
      <tr><th>Description</th><th>Qty</th><th style="text-align:right">Rate (AED)</th><th style="text-align:right">Total (AED)</th></tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>${d.roomType || 'Room'}</strong><br/><span style="font-size:11px;color:#64748b">${d.boardBasis || ''}</span></td>
        <td>${d.rooms ?? 1} room(s) × ${d.nights} night(s)</td>
        <td style="text-align:right">${d.ratePerNight.toLocaleString('en', { minimumFractionDigits: 2 })}</td>
        <td style="text-align:right;font-weight:700">${netTotal.toLocaleString('en', { minimumFractionDigits: 2 })}</td>
      </tr>
    </tbody>
  </table>
  <div class="total-box">
    <div style="font-size:11px;color:#64748b;margin-bottom:8px">Rates are inclusive of VAT (5%)</div>
    <div class="total-row grand"><span class="label">NET PAYABLE TO HOTEL</span><span>AED ${netTotal.toLocaleString('en', { minimumFractionDigits: 2 })}</span></div>
  </div>

  <div class="section-title" style="margin-top:20px">Terms & Conditions</div>
  <ul class="terms-list">
    <li>Payment will be processed within 30 days of guest check-out</li>
    <li>Please confirm reservation via email within 24 hours</li>
    <li>Cancellation policy as per hotel's standard terms</li>
    <li>Any modifications must be communicated in writing</li>
    <li>Hotel to provide invoice after guest check-out</li>
  </ul>

  <div class="footer">
    <div class="footer-contact">
      <strong>UAE Hotels TMS — Reservations Team</strong><br/>
      Email: reservations@uaehotels.com &nbsp;|&nbsp; Phone: +971 4 000 0000<br/>
      <span style="font-size:10px;color:#94a3b8">Generated on ${today}</span>
    </div>
    <div class="signature-line">
      <div class="line"></div>
      <div class="role">Operations Manager</div>
    </div>
  </div>`;
}
