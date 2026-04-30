import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getPrisma } from "#/db";
import { jsonResponse } from "#/server";

const AgentUpdateSchema = z
	.object({
		name: z.string().min(1).optional(),
		baseUrl: z.url().optional(),
		token: z.string().min(1).optional(),
		description: z.string().nullable().optional(),
		isEnabled: z.boolean().optional(),
	})
	.refine((value) => Object.keys(value).length > 0, {
		message: "至少提供一个可更新字段",
	});

export const Route = createFileRoute("/api/agents/$agentId/")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const prisma = getPrisma();
				const agent = await prisma.agent.findUnique({
					where: { id: params.agentId },
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

				if (!agent) {
					return jsonResponse({ status: 404, data: { error: "Agent 不存在" } });
				}

				return jsonResponse({ status: 200, data: agent });
			},
			PATCH: async ({ request, params }) => {
				const parsed = AgentUpdateSchema.safeParse(await request.json());
				if (!parsed.success) {
					return jsonResponse({
						status: 400,
						data: { error: "请求参数不合法", details: parsed.error.message },
					});
				}

				const prisma = getPrisma();
				const existing = await prisma.agent.findUnique({
					where: { id: params.agentId },
					select: { id: true },
				});
				if (!existing) {
					return jsonResponse({ status: 404, data: { error: "Agent 不存在" } });
				}

				const updated = await prisma.agent.update({
					where: { id: params.agentId },
					data: parsed.data,
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

				return jsonResponse({ status: 200, data: updated });
			},
			DELETE: async ({ params }) => {
				const prisma = getPrisma();
				const existing = await prisma.agent.findUnique({
					where: { id: params.agentId },
					select: { id: true },
				});
				if (!existing) {
					return jsonResponse({ status: 404, data: { error: "Agent 不存在" } });
				}

				await prisma.agent.delete({ where: { id: params.agentId } });
				return jsonResponse({ status: 200, data: { success: true } });
			},
		},
	},
});
