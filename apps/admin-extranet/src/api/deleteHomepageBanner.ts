import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { enrichCurrentUser } from '../lib/currentUser';

export default createEndpoint({
  description: 'Deletes a fabBeds homepage campaign banner',
  inputSchema: z.object({ id: z.string() }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input, context }) => {
    await enrichCurrentUser(context);
    await zite.homepageCampaignBanners.delete({ id: input.id });
    return { success: true };
  },
});
