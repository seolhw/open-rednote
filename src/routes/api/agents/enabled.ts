import { createFileRoute } from "@tanstack/react-router";
import { getPrisma } from "#/db";
import { jsonResponse } from "#/server";

export const Route = createFileRoute("/api/agents/enabled")({
	server: {
		handlers: {
			GET: async () => {
				const prisma = getPrisma();
				const agent = await prisma.agent.findFirst({
					where: { isEnabled: true },
					select: {
						id: true,
						name: true,
						baseUrl: true,
						description: true,
						isEnabled: true,
						createdAt: true,
						updatedAt: true,
					},
				});

				return jsonResponse({
					data: agent,
				});
			},
		},
	},
});
