import { zite } from 'zitejs/db';
import { allAttractionRecords } from './allAttractionRecords';

/**
 * ONE agency credit ledger for every product (hotels, attractions, transfers).
 * A booking consumes credit from creation until it is Settled or Released; Cancelled / Rejected never count.
 * Any open booking past its credit due date blocks new credit bookings.
 */
export type CreditPosition = {
  creditStatus: string; creditLimit: number; termsDays: number;
  hotelUsed: number; attractionUsed: number; transferUsed: number; used: number; available: number;
  overdue: number; openBookings: number; canBook: boolean; blockReason: string | null;
};

const money = (n: number) => Math.round(n * 100) / 100;
const lid = (v: unknown) => Array.isArray(v) ? String(v[0] || '') : String(v || '');
const released = (s: unknown) => ['Settled', 'Released'].includes(String(s || 'Open'));

export async function getPartnerCreditPosition(partnerId: string): Promise<CreditPosition> {
  const today = new Date().toISOString().slice(0, 10);
  const [account, hotel, attractions, transfers] = await Promise.all([
    zite.partnerAccounts.findOne({ id: partnerId }) as Promise<any>,
    zite.sql({
      query: `
        SELECT
          COALESCE(SUM(CASE WHEN (b."creditSettlementStatus" IS NULL OR b."creditSettlementStatus" = 'Open') AND b."status" NOT IN ('Cancelled','Rejected') THEN COALESCE(b."sellTotal",0) ELSE 0 END),0) AS "used",
          COUNT(*) FILTER (WHERE (b."creditSettlementStatus" IS NULL OR b."creditSettlementStatus" = 'Open') AND b."status" NOT IN ('Cancelled','Rejected')) AS "open",
          COUNT(*) FILTER (WHERE (b."creditSettlementStatus" IS NULL OR b."creditSettlementStatus" = 'Open') AND b."status" NOT IN ('Cancelled','Rejected') AND b."creditDueDate" IS NOT NULL AND b."creditDueDate" < CURRENT_DATE) AS "overdue"
        FROM "Bookings" b JOIN "BookingsPartnerAccounts" bpa ON bpa."bookingsId" = b."id"
        WHERE bpa."partnerAccountsId" = $1`,
      params: [partnerId],
    }),
    allAttractionRecords(zite.attractionBookings, { filters: { partnerAccount: partnerId } }),
    allAttractionRecords((zite as any).transferBookings, { filters: { partnerAccount: partnerId } }),
  ]);

  const h: any = hotel.rows[0] || {};
  let attractionUsed = 0, transferUsed = 0, overdue = Number(h.overdue || 0), openBookings = Number(h.open || 0);
  for (const b of attractions.records as any[]) {
    if (lid(b.partnerAccount) !== partnerId || released(b.creditSettlementStatus)) continue;
    if (['Cancelled', 'Rejected'].includes(String(b.reservationStatus || b.bookingStatus || ''))) continue;
    attractionUsed += Math.max(0, Number(b.totalSellPrice || 0)); openBookings++;
    if (b.creditDueDate && String(b.creditDueDate).slice(0, 10) < today) overdue++;
  }
  for (const b of transfers.records as any[]) {
    if (lid(b.partnerAccount) !== partnerId || released(b.creditSettlementStatus)) continue;
    if (String(b.bookingStatus || '') === 'Cancelled') continue;
    transferUsed += Math.max(0, Number(b.totalPrice || 0)); openBookings++;
    if (b.creditDueDate && String(b.creditDueDate).slice(0, 10) < today) overdue++;
  }

  const creditStatus = String(account?.creditStatus || 'Disabled');
  const creditLimit = Math.max(0, Number(account?.creditLimitAed || 0));
  const hotelUsed = money(Math.max(0, Number(h.used || 0)));
  const used = money(hotelUsed + attractionUsed + transferUsed);
  const available = money(Math.max(0, creditLimit - used));
  const blockReason =
    !account ? 'Agency account not found.' :
    account.accountStatus === 'Suspended' ? 'Agency account is suspended.' :
    creditStatus !== 'Approved' || creditLimit <= 0 ? 'Agency credit is not approved. Contact your account manager.' :
    overdue > 0 ? `New bookings are blocked: ${overdue} booking(s) are past their credit due date.` :
    available <= 0 ? 'Agency credit limit is fully used.' : null;
  return { creditStatus, creditLimit, termsDays: Math.max(0, Number(account?.creditTermsDays || 0)), hotelUsed, attractionUsed: money(attractionUsed), transferUsed: money(transferUsed), used, available, overdue, openBookings, canBook: !blockReason, blockReason };
}

/** Throws a human-readable error unless the agency can put `amount` on credit now. */
export function assertCreditFor(position: CreditPosition, amount: number) {
  if (position.blockReason) throw new Error(position.blockReason);
  if (amount > position.available + 0.001) throw new Error(`Insufficient agency credit. Available AED ${position.available.toFixed(2)}; this booking needs AED ${amount.toFixed(2)}.`);
}

export function creditDueDate(termsDays: number) {
  const d = new Date(); d.setUTCDate(d.getUTCDate() + Math.max(0, termsDays));
  return d.toISOString().slice(0, 10);
}
