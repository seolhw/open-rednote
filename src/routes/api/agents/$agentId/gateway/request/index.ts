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

const isBodyMethod = ({ method }: { method: string }) =>
	method === "POST" || method === "PUT" || method === "PATCH";

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

				const targetUrl = buildGatewayUrl({
					baseUrl: agent.baseUrl,
					path: parsed.data.path,
					query: parsed.data.query,
				});

				const contentType = parsed.data.contentType ?? "application/json";
				const outboundBody =
					isBodyMethod({ method: parsed.data.method }) &&
					parsed.data.body !== undefined
						? contentType === "application/json"
							? JSON.stringify(parsed.data.body)
							: String(parsed.data.body)
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
						method: parsed.data.method,
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
						data,
					},
				});
			},
		},
	},
});
