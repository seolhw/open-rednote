import { createFileRoute } from "@tanstack/react-router";
import { jsonResponse } from "#/server";
import { getSessionUser } from "#/server/auth";
import { ZEROCLAW_API } from "#/server/zeroclaw";

export const Route = createFileRoute("/api/zeroclaw/")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const user = await getSessionUser({ request });
				if (!user) {
					return jsonResponse({ status: 401, data: { error: "未登录" } });
				}

				const body: {
					key: "health" | "apiHealth" | "sessions" | "sessionsRunning";
				} = await request.json();

				if (!body.key) {
					return jsonResponse({
						status: 400,
						data: { error: "key is required" },
					});
				}

				const api = ZEROCLAW_API[body.key];

				if (!api) {
					return jsonResponse({
						status: 400,
						data: { error: `key ${body.key} not found` },
					});
				}

				const result = await api.fetch();
				return jsonResponse({ status: 200, data: result });
			},
		},
	},
});
