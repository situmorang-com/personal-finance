import { SvelteKitAuth } from '@auth/sveltekit';
import Google from '@auth/core/providers/google';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const { handle, signIn, signOut } = SvelteKitAuth({
	providers: [
		Google({
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET
		})
	],
	secret: env.AUTH_SECRET,
	trustHost: true,
	session: { strategy: 'jwt' },
	callbacks: {
		async signIn({ user }) {
			if (!user.email) return false;

			const existing = db.select().from(users).where(eq(users.email, user.email)).get();
			if (existing) {
				db.update(users)
					.set({ name: user.name, image: user.image })
					.where(eq(users.id, existing.id))
					.run();
			} else {
				db.insert(users)
					.values({
						id: crypto.randomUUID(),
						email: user.email,
						name: user.name,
						image: user.image
					})
					.run();
			}
			return true;
		},
		async jwt({ token }) {
			if (token.email) {
				const dbUser = db.select().from(users).where(eq(users.email, token.email)).get();
				if (dbUser) token.userId = dbUser.id;
			}
			return token;
		},
		async session({ session, token }) {
			if (session.user) {
				session.user.id = token.userId as string;
			}
			return session;
		}
	}
});
