import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getPrisma } from "#/db";
import { env } from "#/env";

const GatewayRequestSchema = z.object({
	method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
	path: z
		.string()
		.min(1)
		.refine((value) => value.startsWith("/"), {
			message: "path 必须以 / 开头",
		}),
	query: z.record(z.string(), z.string()).optional(),
	body: z.unknown().optional(),
	contentType: z.string().optional(),
});

const jsonResponse = ({ status, data }: { status: number; data: unknown }) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});

const buildGatewayUrl = ({
	baseUrl,
	path,
	query,
}: {
	baseUrl: string;
	path: string;
	query?: Record<string, string>;
}) => {
	const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
	const url = new URL(path, normalized);
	if (query) {
		for (const [key, value] of Object.entries(query)) {
			url.searchParams.set(key, value);
		}
	}
	return url.toString();
};

export const Route = createFileRoute("/api/agents/$agentId/gateway/request/")({
	server: {
		handlers: {
			POST: async ({ request, params }) => {
				if (!env.DATABASE_URL) {
					return jsonResponse({
						status: 500,
						data: { error: "DATABASE_URL 未配置" },
					});
				}

				const parsed = GatewayRequestSchema.safeParse(await request.json());
				if (!parsed.success) {
					return jsonResponse({
						status: 400,
						data: { error: "请求参数不合法", details: parsed.error.message },
					});
				}

				const prisma = getPrisma();
				const agent = await prisma.agent.findUnique({
					where: { id: params.agentId },
					select: {
						id: true,
						name: true,
						baseUrl: true,
						token: true,
						isEnabled: true,
					},
				});

				if (!agent) {
					return jsonResponse({ status: 404, data: { error: "Agent 不存在" } });
				}
				if (!agent.isEnabled) {
					return jsonResponse({ status: 409, data: { error: "Agent 已禁用" } });
				}

				const endpointResolved = resolveGatewayEndpoint({
					path: parsed.data.path,
					method: parsed.data.method,
				});
				if (!endpointResolved.ok) {
					return jsonResponse({
						status: 400,
						data: { error: endpointResolved.error },
					});
				}

				const targetUrl = buildGatewayUrl({
					baseUrl: agent.baseUrl,
					path: endpointResolved.path,
					query: parsed.data.query,
				});

				const contentType = parsed.data.contentType ?? "application/json";
				const outboundBody = parsed.data.body
					? JSON.stringify(parsed.data.body)
					: undefined;

				const headers: Record<string, string> = {
					Authorization: `Bearer ${agent.token}`,
					Accept: "application/json, text/plain, */*",
				};

				if (outboundBody !== undefined) {
					headers["Content-Type"] = contentType;
				}

				const settled = await Promise.allSettled([
					fetch(targetUrl, {
						method: endpointResolved.method,
						headers,
						body: outboundBody,
					}),
				]);

				const result = settled[0];
				if (result.status === "rejected") {
					const reason = result.reason;
					return jsonResponse({
						status: 502,
						data: {
							error: "Gateway 请求失败",
							details:
								reason instanceof Error ? reason.message : "unknown error",
							targetUrl,
						},
					});
				}

				const response = result.value;
				const responseContentType = response.headers.get("content-type") ?? "";
				const raw = await response.text();
				const data =
					responseContentType.includes("application/json") && raw.length > 0
						? JSON.parse(raw)
						: raw;

				return jsonResponse({
					status: response.status,
					data: {
						ok: response.ok,
						status: response.status,
						contentType: responseContentType,
						targetUrl,
						endpoint: {
							key: endpointResolved.key,
							path: endpointResolved.path,
							method: endpointResolved.method,
						},
						ws: {
							chatPath: ZEROCLAW_WS_CHAT_PATH,
							chatUrl: buildWsChatUrl({
								baseUrl: agent.baseUrl,
								token: agent.token,
							}),
						},
						data,
					},
				});
			},
		},
	},
});

type ZeroClawMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
const ZEROCLAW_WS_CHAT_PATH = "/ws/chat";

const ALLOWED_STATIC_ENDPOINTS: Record<ZeroClawMethod, readonly string[]> = {
	GET: [
		"/health",
		"/metrics",
		"/pair/code",
		"/whatsapp",
		"/wati",
		"/api/status",
		"/api/config",
		"/api/tools",
		"/api/cron",
		"/api/cron/settings",
		"/api/integrations",
		"/api/integrations/settings",
		"/api/memory",
		"/api/cost",
		"/api/cli-tools",
		"/api/channels",
		"/api/health",
		"/api/sessions",
		"/api/sessions/running",
		"/api/devices",
		"/api/canvas",
		"/api/events",
		"/api/events/history",
	],
	POST: [
		"/pair",
		"/webhook",
		"/whatsapp",
		"/linq",
		"/wati",
		"/nextcloud-talk",
		"/webhook/gmail",
		"/api/cron",
		"/api/doctor",
		"/api/memory",
		"/api/pairing/initiate",
		"/api/pair",
	],
	PUT: ["/api/config"],
	PATCH: ["/api/cron/settings"],
	DELETE: [],
};

const DYNAMIC_ENDPOINT_RULES: Array<{
	key: string;
	method: ZeroClawMethod;
	pattern: RegExp;
}> = [
	{ key: "apiCronById", method: "PATCH", pattern: /^\/api\/cron\/[^/]+$/ },
	{ key: "apiCronById", method: "DELETE", pattern: /^\/api\/cron\/[^/]+$/ },
	{ key: "apiCronRuns", method: "GET", pattern: /^\/api\/cron\/[^/]+\/runs$/ },
	{
		key: "apiMemoryByKey",
		method: "DELETE",
		pattern: /^\/api\/memory\/[^/]+$/,
	},
	{
		key: "apiSessionById",
		method: "DELETE",
		pattern: /^\/api\/sessions\/[^/]+$/,
	},
	{ key: "apiSessionById", method: "PUT", pattern: /^\/api\/sessions\/[^/]+$/ },
	{
		key: "apiSessionState",
		method: "GET",
		pattern: /^\/api\/sessions\/[^/]+\/state$/,
	},
	{
		key: "apiSessionAbort",
		method: "POST",
		pattern: /^\/api\/sessions\/[^/]+\/abort$/,
	},
	{
		key: "apiDeviceById",
		method: "DELETE",
		pattern: /^\/api\/devices\/[^/]+$/,
	},
	{ key: "apiCanvasById", method: "GET", pattern: /^\/api\/canvas\/[^/]+$/ },
	{ key: "apiCanvasById", method: "PUT", pattern: /^\/api\/canvas\/[^/]+$/ },
	{ key: "apiCanvasById", method: "DELETE", pattern: /^\/api\/canvas\/[^/]+$/ },
	{
		key: "apiCanvasExecute",
		method: "POST",
		pattern: /^\/api\/canvas\/[^/]+\/execute$/,
	},
	{
		key: "apiCanvasExport",
		method: "GET",
		pattern: /^\/api\/canvas\/[^/]+\/export$/,
	},
	{
		key: "apiCanvasImport",
		method: "POST",
		pattern: /^\/api\/canvas\/[^/]+\/import$/,
	},
	{
		key: "apiCanvasPublish",
		method: "POST",
		pattern: /^\/api\/canvas\/[^/]+\/publish$/,
	},
	{
		key: "apiCanvasSubscribe",
		method: "GET",
		pattern: /^\/api\/canvas\/[^/]+\/subscribe$/,
	},
	{
		key: "apiCanvasLock",
		method: "POST",
		pattern: /^\/api\/canvas\/[^/]+\/lock$/,
	},
	{
		key: "apiCanvasUnlock",
		method: "POST",
		pattern: /^\/api\/canvas\/[^/]+\/unlock$/,
	},
	{
		key: "apiCanvasHistory",
		method: "GET",
		pattern: /^\/api\/canvas\/[^/]+\/history$/,
	},
];

const buildWsChatUrl = ({
	baseUrl,
	token,
}: {
	baseUrl: string;
	token: string;
}) => {
	const httpUrl = buildGatewayUrl({
		baseUrl,
		path: ZEROCLAW_WS_CHAT_PATH,
		query: { token },
	});
	if (httpUrl.startsWith("https://"))
		return httpUrl.replace("https://", "wss://");
	if (httpUrl.startsWith("http://")) return httpUrl.replace("http://", "ws://");
	return httpUrl;
};

const resolveGatewayEndpoint = ({
	path,
	method,
}: {
	path: string;
	method: ZeroClawMethod;
}):
	| { ok: true; key: string; path: string; method: ZeroClawMethod }
	| { ok: false; error: string } => {
	if (path.includes(":"))
		return { ok: false, error: "path 不支持模板参数，请传完整路径" };
	if (path.startsWith("/admin/"))
		return { ok: false, error: "Admin 接口不允许调用" };
	if (ALLOWED_STATIC_ENDPOINTS[method].includes(path)) {
		return { ok: true, key: path, path, method };
	}
	const dynamic = DYNAMIC_ENDPOINT_RULES.find(
		(item) => item.method === method && item.pattern.test(path),
	);
	if (!dynamic)
		return {
			ok: false,
			error: `path 不在允许列表中或 method 不匹配: ${method} ${path}`,
		};
	return { ok: true, key: dynamic.key, path, method };
};
