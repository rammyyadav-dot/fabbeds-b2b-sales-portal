import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Returns active fabBeds booking support contact details',
  inputSchema: z.object({}),
  outputSchema: z.object({
    bookingEmail: z.string(),
    customerCareNumber: z.string().optional(),
    whatsAppNumber: z.string().optional(),
    supportHours: z.string().optional(),
    emergencyNumber: z.string().optional(),
  }),
  execute: async () => {
    const { rows } = await zite.sql({
      query: `
        SELECT
          "bookingEmail",
          "customerCareNumber",
          "whatsAppNumber",
          "supportHours",
          "emergencyNumber"
        FROM "SupportSettings"
        WHERE "isActive" = TRUE
        ORDER BY "created_at" DESC
        LIMIT 1
      `,
    }).catch(() => ({ rows: [] as any[] }));

    const r:any = rows[0] || {};
    return {
      bookingEmail: r.bookingEmail || 'book@fbeds.com',
      customerCareNumber: r.customerCareNumber || undefined,
      whatsAppNumber: r.whatsAppNumber || undefined,
      supportHours: r.supportHours || undefined,
      emergencyNumber: r.emergencyNumber || undefined,
    };
  },
});
