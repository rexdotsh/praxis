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

export const createSearch = mutation({
  args: {
    query: v.string(),
    refinedQuery: v.string(),
    candidatesCount: v.number(),
  },
  returns: v.id('searches'),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error('Not authenticated');

    const user = await ctx.db
      .query('users')
      .withIndex('by_subject', (q) => q.eq('subject', identity.subject))
      .unique();
    if (!user) throw new Error('User not found');

    const searchId = await ctx.db.insert('searches', {
      userId: user._id,
      query: args.query,
      refinedQuery: args.refinedQuery,
      candidatesCount: args.candidatesCount,
    });
    return searchId;
  },
});

export const upsertVideo = mutation({
  args: {
    youtubeId: v.string(),
    title: v.string(),
    url: v.string(),
    channel: v.string(),
    durationMs: v.optional(v.number()),
    views: v.optional(v.number()),
    thumbnailUrl: v.optional(v.string()),
  },
  returns: v.id('videos'),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('videos')
      .withIndex('by_youtubeId', (q) => q.eq('youtubeId', args.youtubeId))
      .unique();
    if (existing) {
      // Shallow update basic metadata if changed
      await ctx.db.patch(existing._id, {
        title: args.title,
        url: args.url,
        channel: args.channel,
        durationMs: args.durationMs,
        views: args.views,
        thumbnailUrl: args.thumbnailUrl,
      });
      return existing._id;
    }
    return await ctx.db.insert('videos', args);
  },
});

export const createSelection = mutation({
  args: {
    searchId: v.id('searches'),
    videoId: v.id('videos'),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error('Not authenticated');
    const user = await ctx.db
      .query('users')
      .withIndex('by_subject', (q) => q.eq('subject', identity.subject))
      .unique();
    if (!user) throw new Error('User not found');
    await ctx.db.insert('selections', {
      userId: user._id,
      searchId: args.searchId,
      videoId: args.videoId,
      reason: args.reason,
    });
    return null;
  },
});
