import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    // Clerk subject identifier (stable user id from Clerk)
    subject: v.string(),
  }).index('by_subject', ['subject']),
  searches: defineTable({
    userId: v.id('users'),
    query: v.string(),
    refinedQuery: v.string(),
    candidatesCount: v.number(),
  }).index('by_user', ['userId']),
  videos: defineTable({
    youtubeId: v.string(),
    title: v.string(),
    url: v.string(),
    channel: v.string(),
    durationMs: v.optional(v.number()),
    views: v.optional(v.number()),
    thumbnailUrl: v.optional(v.string()),
  }).index('by_youtubeId', ['youtubeId']),
  selections: defineTable({
    userId: v.id('users'),
    searchId: v.id('searches'),
    videoId: v.id('videos'),
    reason: v.optional(v.string()),
  })
    .index('by_user', ['userId'])
    .index('by_search', ['searchId']),
});
