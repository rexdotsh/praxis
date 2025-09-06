import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    // Clerk subject identifier (stable user id from Clerk)
    subject: v.string(),
  }).index('by_subject', ['subject']),
});
