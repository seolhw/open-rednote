import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getPrisma } from "#/db";
import { env } from "#/env";
import { auth } from "#/lib/auth";

const UpdateSchema = z
	.object({
		title: z.string().min(1).max(100).optional(),
		status: z.enum(["active", "archived"]).optional(),
	})
	.refine((value) => value.title !== undefined || value.status !== undefined, {
		message: "至少提供一个可更新字段",
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

export const Route = createFileRoute("/api/agent-sessions/$sessionId/")({
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
				const row = await prisma.agentSession.findFirst({
					where: { id: params.sessionId, userId: user.id },
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
				if (!row)
					return jsonResponse({ status: 404, data: { error: "会话不存在" } });

				return jsonResponse({
					status: 200,
					data: {
						id: row.id,
						title: row.title,
						status: row.status,
						agentId: row.agentId,
						lastMessageAt: row.lastMessageAt,
						createdAt: row.createdAt,
						updatedAt: row.updatedAt,
						messageCount: row._count.messages,
					},
				});
			},
			PATCH: async ({ request, params }) => {
				if (!env.DATABASE_URL)
					return jsonResponse({
						status: 500,
						data: { error: "DATABASE_URL 未配置" },
					});
				const user = await getSessionUser({ request });
				if (!user)
					return jsonResponse({ status: 401, data: { error: "未登录" } });

				const parsed = UpdateSchema.safeParse(await request.json());
				if (!parsed.success)
					return jsonResponse({
						status: 400,
						data: { error: "请求参数不合法", details: parsed.error.message },
					});

				const prisma = getPrisma();
				const exists = await prisma.agentSession.findFirst({
					where: { id: params.sessionId, userId: user.id },
					select: { id: true },
				});
				if (!exists)
					return jsonResponse({ status: 404, data: { error: "会话不存在" } });

				const updated = await prisma.agentSession.update({
					where: { id: params.sessionId },
					data: {
						...(parsed.data.title !== undefined
							? { title: parsed.data.title }
							: {}),
						...(parsed.data.status !== undefined
							? { status: parsed.data.status }
							: {}),
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
					status: 200,
					data: {
						id: updated.id,
						title: updated.title,
						status: updated.status,
						agentId: updated.agentId,
						lastMessageAt: updated.lastMessageAt,
						createdAt: updated.createdAt,
						updatedAt: updated.updatedAt,
						messageCount: updated._count.messages,
					},
				});
			},
			DELETE: async ({ request, params }) => {
				if (!env.DATABASE_URL)
					return jsonResponse({
						status: 500,
						data: { error: "DATABASE_URL 未配置" },
					});
				const user = await getSessionUser({ request });
				if (!user)
					return jsonResponse({ status: 401, data: { error: "未登录" } });

				const prisma = getPrisma();
				const exists = await prisma.agentSession.findFirst({
					where: { id: params.sessionId, userId: user.id },
					select: { id: true },
				});
				if (!exists)
					return jsonResponse({ status: 404, data: { error: "会话不存在" } });

				await prisma.agentSession.delete({ where: { id: params.sessionId } });
				return jsonResponse({ status: 200, data: { success: true } });
			},
		},
	},
});
