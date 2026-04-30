import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { jwt } from "better-auth/plugins/jwt";
import { getPrisma } from "#/db";
import { env } from "#/env";

export const auth = betterAuth({
	...(env.BETTER_AUTH_SECRET ? { secret: env.BETTER_AUTH_SECRET } : {}),
	...(env.BETTER_AUTH_URL ? { baseURL: env.BETTER_AUTH_URL } : {}),
	database: prismaAdapter(getPrisma(), {
		provider: "postgresql",
	}),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false,
	},
	user: {
		modelName: "User",
	},
	account: {
		modelName: "Account",
	},
	verification: {
		modelName: "Verification",
	},
	plugins: [jwt()],
});
