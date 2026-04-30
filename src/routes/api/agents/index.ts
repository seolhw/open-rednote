import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getPrisma } from "#/db";
import { jsonResponse } from "#/server";
import { getSessionUser } from "#/server/auth";

const AgentCreateSchema = z.object({
	name: z.string().min(1),
	baseUrl: z.url(),
	token: z.string().min(1),
	description: z.string().optional(),
	isEnabled: z.boolean().optional().default(true),
});

type AgentPublic = {
	id: string;
	name: string;
	baseUrl: string;
	description: string | null;
	isEnabled: boolean;
	createdAt: Date;
	updatedAt: Date;
};

const toAgentPublic = ({ agent }: { agent: AgentPublic }) => ({
	id: agent.id,
	name: agent.name,
	baseUrl: agent.baseUrl,
	description: agent.description,
	isEnabled: agent.isEnabled,
	createdAt: agent.createdAt,
	updatedAt: agent.updatedAt,
});

export const Route = createFileRoute("/api/agents/")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const user = await getSessionUser({ request });
				if (!user) {
					return jsonResponse({ status: 401, data: { error: "未登录" } });
				}

				const prisma = getPrisma();
				const agents = await prisma.agent.findMany({
					orderBy: { createdAt: "desc" },
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
					status: 200,
					data: { items: agents.map((agent) => toAgentPublic({ agent })) },
				});
			},
			POST: async ({ request }) => {
				const user = await getSessionUser({ request });
				if (!user) {
					return jsonResponse({ status: 401, data: { error: "未登录" } });
				}

				const parsed = AgentCreateSchema.safeParse(await request.json());
				if (!parsed.success) {
					return jsonResponse({
						status: 400,
						data: { error: "请求参数不合法", details: parsed.error.message },
					});
				}

				const prisma = getPrisma();
				const created = await prisma.agent.create({
					data: {
						name: parsed.data.name,
						baseUrl: parsed.data.baseUrl,
						token: parsed.data.token,
						description: parsed.data.description,
						isEnabled: parsed.data.isEnabled,
					},
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
					status: 201,
					data: toAgentPublic({ agent: created }),
				});
			},
		},
	},
});
