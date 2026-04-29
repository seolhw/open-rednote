import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getPrisma } from "#/db";
import { env } from "#/env";
import { auth } from "#/lib/auth";

const ListQuerySchema = z.object({
	agentId: z.string().min(1).optional(),
	status: z.enum(["active", "archived"]).optional(),
	take: z.coerce.number().int().positive().max(100).default(30),
});

const CreateSchema = z.object({
	title: z.string().min(1).max(100).optional().default("新会话"),
	agentId: z.string().min(1).optional(),
});

const jsonResponse = ({ status, data }: { status: number; data: unknown }) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});

const getSessionUser = async ({ request }: { request: Request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	return session?.user ?? null;
};

export const Route = createFileRoute("/api/agent-sessions/")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				if (!env.DATABASE_URL)
					return jsonResponse({
						status: 500,
						data: { error: "DATABASE_URL 未配置" },
					});
				const user = await getSessionUser({ request });
				if (!user)
					return jsonResponse({ status: 401, data: { error: "未登录" } });

				const url = new URL(request.url);
				const parsed = ListQuerySchema.safeParse({
					agentId: url.searchParams.get("agentId") ?? undefined,
					status: url.searchParams.get("status") ?? undefined,
					take: url.searchParams.get("take") ?? undefined,
				});
				if (!parsed.success)
					return jsonResponse({
						status: 400,
						data: { error: "查询参数不合法", details: parsed.error.message },
					});

				const prisma = getPrisma();
				const items = await prisma.agentSession.findMany({
					where: {
						userId: user.id,
						...(parsed.data.agentId ? { agentId: parsed.data.agentId } : {}),
						...(parsed.data.status ? { status: parsed.data.status } : {}),
					},
					orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
					take: parsed.data.take,
					select: {
						id: true,
						title: true,
						status: true,
						agentId: true,
						lastMessageAt: true,
						createdAt: true,
						updatedAt: true,
						_count: { select: { messages: true } },
					},
				});

				return jsonResponse({
					status: 200,
					data: {
						items: items.map((row) => ({
							id: row.id,
							title: row.title,
							status: row.status,
							agentId: row.agentId,
							lastMessageAt: row.lastMessageAt,
							createdAt: row.createdAt,
							updatedAt: row.updatedAt,
							messageCount: row._count.messages,
						})),
					},
				});
			},
			POST: async ({ request }) => {
				if (!env.DATABASE_URL)
					return jsonResponse({
						status: 500,
						data: { error: "DATABASE_URL 未配置" },
					});
				const user = await getSessionUser({ request });
				if (!user)
					return jsonResponse({ status: 401, data: { error: "未登录" } });

				const parsed = CreateSchema.safeParse(await request.json());
				if (!parsed.success)
					return jsonResponse({
						status: 400,
						data: { error: "请求参数不合法", details: parsed.error.message },
					});

				const prisma = getPrisma();
				if (parsed.data.agentId) {
					const agent = await prisma.agent.findUnique({
						where: { id: parsed.data.agentId },
						select: { id: true },
					});
					if (!agent)
						return jsonResponse({
							status: 404,
							data: { error: "Agent 不存在" },
						});
				}

				const created = await prisma.agentSession.create({
					data: {
						title: parsed.data.title,
						userId: user.id,
						agentId: parsed.data.agentId ?? null,
					},
					select: {
						id: true,
						title: true,
						status: true,
						agentId: true,
						lastMessageAt: true,
						createdAt: true,
						updatedAt: true,
						_count: { select: { messages: true } },
					},
				});

				return jsonResponse({
					status: 201,
					data: {
						id: created.id,
						title: created.title,
						status: created.status,
						agentId: created.agentId,
						lastMessageAt: created.lastMessageAt,
						createdAt: created.createdAt,
						updatedAt: created.updatedAt,
						messageCount: created._count.messages,
					},
				});
			},
		},
	},
});
