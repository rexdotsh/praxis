import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const getByVideo = query({
  args: { youtubeId: v.string() },
  returns: v.union(
    v.object({ youtubeId: v.string(), suggestions: v.array(v.string()) }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query('video_suggestions')
      .withIndex('by_youtubeId', (q) => q.eq('youtubeId', args.youtubeId))
      .unique();
    if (!doc) return null;
    return { youtubeId: doc.youtubeId, suggestions: doc.suggestions };
  },
});

export const upsertForVideo = mutation({
  args: { youtubeId: v.string(), suggestions: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('video_suggestions')
      .withIndex('by_youtubeId', (q) => q.eq('youtubeId', args.youtubeId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { suggestions: args.suggestions });
      return null;
    }
    await ctx.db.insert('video_suggestions', {
      youtubeId: args.youtubeId,
      suggestions: args.suggestions,
    });
    return null;
  },
});
