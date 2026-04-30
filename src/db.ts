import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "#/env";
import { PrismaClient } from "./generated/prisma/client.js";

declare global {
	var __prisma: PrismaClient | undefined;
}

export const getPrisma = (): PrismaClient => {
	if (globalThis.__prisma) {
		return globalThis.__prisma;
	}

	const adapter = new PrismaPg({
		connectionString: env.DATABASE_URL,
	});

	const client = new PrismaClient({ adapter });

	if (process.env.NODE_ENV !== "production") {
		globalThis.__prisma = client;
	}

	return client;
};
