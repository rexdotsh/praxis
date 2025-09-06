import { mutation } from './_generated/server';
import { v } from 'convex/values';

export const upsertCurrent = mutation({
  args: {},
  returns: v.id('users'),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.subject) {
      throw new Error('Not authenticated');
    }

    const existing = await ctx.db
      .query('users')
      .withIndex('by_subject', (q) => q.eq('subject', identity.subject))
      .unique();

    if (existing) return existing._id;

    const userId = await ctx.db.insert('users', {
      subject: identity.subject,
    });
    return userId;
  },
});
