import { createFileRoute } from "@tanstack/react-router";
import { getPrisma } from "#/db";
import { env } from "#/env";

type EndpointProbe = {
	ok: boolean;
	status: number;
	url: string;
	body: string;
};

const jsonResponse = ({ status, data }: { status: number; data: unknown }) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});

const buildGatewayUrl = ({
	baseUrl,
	path,
}: {
	baseUrl: string;
	path: string;
}) => {
	const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
	return new URL(path, normalized).toString();
};

const probeEndpoint = async ({
	baseUrl,
	token,
	path,
}: {
	baseUrl: string;
	token: string;
	path: string;
}): Promise<EndpointProbe> => {
	const url = buildGatewayUrl({ baseUrl, path });
	const settled = await Promise.allSettled([
		fetch(url, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/json, text/plain, */*",
			},
		}),
	]);

	const result = settled[0];
	if (result.status === "rejected") {
		const reason = result.reason;
		return {
			ok: false,
			status: 0,
			url,
			body: reason instanceof Error ? reason.message : "gateway 请求失败",
		};
	}

	const response = result.value;
	const body = await response.text();

	return {
		ok: response.ok,
		status: response.status,
		url,
		body,
	};
};

export const Route = createFileRoute("/api/agents/$agentId/observe/")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				if (!env.DATABASE_URL) {
					return jsonResponse({
						status: 500,
						data: { error: "DATABASE_URL 未配置" },
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

				const [health, status, apiHealth, runningSessions] = await Promise.all([
					probeEndpoint({
						baseUrl: agent.baseUrl,
						token: agent.token,
						path: "/health",
					}),
					probeEndpoint({
						baseUrl: agent.baseUrl,
						token: agent.token,
						path: "/api/status",
					}),
					probeEndpoint({
						baseUrl: agent.baseUrl,
						token: agent.token,
						path: "/api/health",
					}),
					probeEndpoint({
						baseUrl: agent.baseUrl,
						token: agent.token,
						path: "/api/sessions/running",
					}),
				]);

				return jsonResponse({
					status: 200,
					data: {
						agent: {
							id: agent.id,
							name: agent.name,
							baseUrl: agent.baseUrl,
							isEnabled: agent.isEnabled,
						},
						probes: {
							health,
							status,
							apiHealth,
							runningSessions,
						},
					},
				});
			},
		},
	},
});
