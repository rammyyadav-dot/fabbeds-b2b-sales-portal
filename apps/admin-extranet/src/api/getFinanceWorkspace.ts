import { z } from 'zod';
import { zite } from 'zitejs/db';
import { createEndpoint } from 'zitejs/backend';
import { requireFinance } from '../lib/requireFinance';

const ledger = "WITH receipts AS (\n SELECT l.\"reservationInvoicesId\" AS invoice_id, SUM(CASE WHEN p.\"paymentStatus\"='Received' THEN ROUND(COALESCE(p.\"amount\",0)*100) ELSE 0 END) AS paid\n FROM \"ReservationPayments\" p JOIN \"ReservationInvoicesReservationPayments\" l ON l.\"reservationPaymentsId\"=p.id GROUP BY l.\"reservationInvoicesId\"\n), ledger AS (\n SELECT i.id, COALESCE(i.\"invoiceNumber\",'') AS reference, COALESCE(i.\"invoiceStatus\",'Draft') AS status,\n i.\"dueDate\" AS due, COALESCE(i.\"totalAmount\",0) AS total,\n COALESCE(rc.paid,0)/100.0 AS paid,\n GREATEST(ROUND(COALESCE(i.\"totalAmount\",0)*100)-COALESCE(rc.paid,0),0)/100.0 AS outstanding,\n COALESCE(r.\"agentCompany\",r.\"agentName\",'Unassigned') AS agent,\n COALESCE(r.\"reservationRef\",'Unlinked') AS reservation,\n CASE WHEN i.\"dueDate\" IS NULL THEN NULL ELSE GREATEST(CURRENT_DATE-i.\"dueDate\"::date,0) END AS age\n FROM \"ReservationInvoices\" i\n LEFT JOIN receipts rc ON rc.invoice_id=i.id\n LEFT JOIN \"ReservationInvoicesReservations\" il ON il.\"reservationInvoicesId\"=i.id\n LEFT JOIN \"Reservations\" r ON r.id=il.\"reservationsId\"\n WHERE COALESCE(r.\"currencyCode\",'AED')='AED'\n)";
export default createEndpoint({
 description: 'Server aggregated AED finance workspace with paged receivables, receipts and supplier LPOs',
 authenticated: true,
 inputSchema: z.object({ view:z.enum(['receivables','receipts','suppliers']), page:z.number().int().min(0).default(0), search:z.string().max(100).default(''), overdue:z.boolean().default(false) }),
 outputSchema: z.object({ summary:z.record(z.string(),z.unknown()), rows:z.array(z.record(z.string(),z.unknown())), total:z.number(), asOf:z.string() }),
 execute: async ({input,context}) => {
  await requireFinance(context);
  const summary = await zite.sql({query: ledger + ` SELECT COUNT(*) AS invoices,
 SUM(CASE WHEN status NOT IN ('Draft','Void') THEN total ELSE 0 END) AS billed,
 SUM(CASE WHEN status NOT IN ('Draft','Void') THEN paid ELSE 0 END) AS received,
 SUM(CASE WHEN status NOT IN ('Draft','Void') THEN outstanding ELSE 0 END) AS outstanding,
 SUM(CASE WHEN status NOT IN ('Draft','Void') AND age>0 THEN outstanding ELSE 0 END) AS overdue,
 SUM(CASE WHEN age BETWEEN 1 AND 30 AND status NOT IN ('Draft','Void') THEN outstanding ELSE 0 END) AS age30,
 SUM(CASE WHEN age BETWEEN 31 AND 60 AND status NOT IN ('Draft','Void') THEN outstanding ELSE 0 END) AS age60,
 SUM(CASE WHEN age BETWEEN 61 AND 90 AND status NOT IN ('Draft','Void') THEN outstanding ELSE 0 END) AS age90,
 SUM(CASE WHEN age>90 AND status NOT IN ('Draft','Void') THEN outstanding ELSE 0 END) AS ageOver90,
 COUNT(*) FILTER (WHERE due IS NULL AND outstanding>0 AND status NOT IN ('Draft','Void')) AS missingDue,
 COUNT(*) FILTER (WHERE paid>total OR (status='Paid' AND outstanding>0)) AS exceptions FROM ledger` });
  const term='%'+input.search+'%';
  let source:string;
  if(input.view==='receivables') source=ledger+` SELECT * FROM ledger WHERE (reference ILIKE $1 OR agent ILIKE $1 OR reservation ILIKE $1) AND ($2::boolean=false OR (age>0 AND outstanding>0 AND status NOT IN ('Draft','Void')))`;
  else if(input.view==='receipts') source=`SELECT p.id, p."paymentReference" AS reference,p."paymentStatus" AS status,p."paymentMethod" AS method,p."amount" AS amount,p."receivedAt" AS received,i."invoiceNumber" AS invoice,
 CASE WHEN l."reservationInvoicesId" IS NULL THEN 'Unallocated' ELSE 'Linked to invoice' END AS allocation
 FROM "ReservationPayments" p LEFT JOIN "ReservationInvoicesReservationPayments" l ON l."reservationPaymentsId"=p.id LEFT JOIN "ReservationInvoices" i ON i.id=l."reservationInvoicesId"
 WHERE (COALESCE(p."paymentReference",'') ILIKE $1 OR COALESCE(i."invoiceNumber",'') ILIKE $1) AND $2::boolean=false`;
  else source=`SELECT l.id,l."lpoNumber" AS reference,l."lpoStatus" AS status,l."supplierEmail" AS supplier,l."sentAt" AS sent,r."reservationRef" AS reservation,r."hotelName" AS hotel,
 'Supplier invoice / settlement not recorded' AS control
 FROM "ReservationLpOs" l LEFT JOIN "ReservationLpOsReservations" lr ON lr."reservationLpOsId"=l.id LEFT JOIN "Reservations" r ON r.id=lr."reservationsId"
 WHERE (COALESCE(l."lpoNumber",'') ILIKE $1 OR COALESCE(l."supplierEmail",'') ILIKE $1) AND $2::boolean=false`;
  const params=[term,input.view==='receivables' && input.overdue];
  const count=await zite.sql({query:'SELECT COUNT(*) AS total FROM ('+source+') q',params});
  const result=await zite.sql({query:source+' ORDER BY reference,id LIMIT 50 OFFSET $3',params:[...params,input.page*50]});
  return {summary:summary.rows[0]??{},rows:result.rows,total:Number(count.rows[0]?.total??0),asOf:new Date().toISOString()};
 }
});