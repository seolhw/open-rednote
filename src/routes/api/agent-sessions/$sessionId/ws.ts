import { createFileRoute } from "@tanstack/react-router";
import { getPrisma } from "#/db";
import { jsonResponse } from "#/server";
import { getSessionUser } from "#/server/auth";

export const Route = createFileRoute("/api/agent-sessions/$sessionId/ws")({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				const user = await getSessionUser({ request });
				if (!user) {
					return jsonResponse({ status: 401, data: { message: "未登录" } });
				}

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
						agent: {
							select: { id: true, name: true, token: true, baseUrl: true },
						},
					},
				});
				if (!row) {
					return jsonResponse({ status: 404, data: { message: "会话不存在" } });
				}

				const baseUrl = row.agent?.baseUrl ?? "";
				const token = row.agent?.token ?? "";
				if (!baseUrl || !token || !URL.canParse(baseUrl)) {
					return jsonResponse({
						status: 400,
						data: { message: "Agent 配置无效" },
					});
				}

				const url = new URL(baseUrl);
				url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
				url.pathname = `/ws/chat`;
				url.searchParams.set("token", encodeURIComponent(token));
				url.searchParams.set("session_id", params.sessionId);

				return jsonResponse({
					data: {
						url: url.toString(),
					},
				});
			},
		},
	},
});
