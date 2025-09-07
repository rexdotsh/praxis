import { auth } from '@clerk/nextjs/server';

export async function getAuthToken(): Promise<string | undefined> {
  const a = await auth();
  const token = await a.getToken({ template: 'convex' });
  return token ?? undefined;
}
