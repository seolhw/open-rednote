import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getPrisma } from "#/db";
import { env } from "#/env";
import { auth } from "#/lib/auth";

const QuerySchema = z.object({
	take: z.coerce.number().int().positive().max(200).default(200),
});

const CreateMessageSchema = z.object({
	role: z.enum(["system", "user", "assistant"]),
	content: z.string().min(1),
	meta: z.unknown().optional(),
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

export const Route = createFileRoute(
	"/api/agent-sessions/$sessionId/messages/",
)({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				if (!env.DATABASE_URL)
					return jsonResponse({
						status: 500,
						data: { error: "DATABASE_URL 未配置" },
					});
				const user = await getSessionUser({ request });
				if (!user)
					return jsonResponse({ status: 401, data: { error: "未登录" } });

				const prisma = getPrisma();
				const owns = await prisma.agentSession.findFirst({
					where: { id: params.sessionId, userId: user.id },
					select: { id: true },
				});
				if (!owns)
					return jsonResponse({ status: 404, data: { error: "会话不存在" } });

				const url = new URL(request.url);
				const parsed = QuerySchema.safeParse({
					take: url.searchParams.get("take") ?? undefined,
				});
				if (!parsed.success)
					return jsonResponse({
						status: 400,
						data: { error: "查询参数不合法", details: parsed.error.message },
					});

				const rows = await prisma.agentMessage.findMany({
					where: { conversationId: params.sessionId },
					orderBy: { createdAt: "asc" },
					take: parsed.data.take,
					select: {
						id: true,
						conversationId: true,
						role: true,
						content: true,
						meta: true,
						createdAt: true,
						updatedAt: true,
					},
				});

				return jsonResponse({ status: 200, data: { items: rows } });
			},
			POST: async ({ request, params }) => {
				if (!env.DATABASE_URL)
					return jsonResponse({
						status: 500,
						data: { error: "DATABASE_URL 未配置" },
					});
				const user = await getSessionUser({ request });
				if (!user)
					return jsonResponse({ status: 401, data: { error: "未登录" } });

				const parsed = CreateMessageSchema.safeParse(await request.json());
				if (!parsed.success)
					return jsonResponse({
						status: 400,
						data: { error: "请求参数不合法", details: parsed.error.message },
					});

				const prisma = getPrisma();
				const owns = await prisma.agentSession.findFirst({
					where: { id: params.sessionId, userId: user.id },
					select: { id: true },
				});
				if (!owns)
					return jsonResponse({ status: 404, data: { error: "会话不存在" } });

				const now = new Date();
				const [created] = await prisma.$transaction([
					prisma.agentMessage.create({
						data: {
							conversationId: params.sessionId,
							role: parsed.data.role,
							content: parsed.data.content,
							meta: parsed.data.meta ?? undefined,
						},
						select: {
							id: true,
							conversationId: true,
							role: true,
							content: true,
							meta: true,
							createdAt: true,
							updatedAt: true,
						},
					}),
					prisma.agentSession.update({
						where: { id: params.sessionId },
						data: { lastMessageAt: now },
						select: { id: true },
					}),
				]);

				return jsonResponse({ status: 201, data: created });
			},
		},
	},
});
