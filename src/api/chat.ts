import { type HttpMethod, type RequestResult, request } from "./request";

export type AgentItem = {
	id: string;
	name: string;
	baseUrl: string;
	description: string | null;
	isEnabled: boolean;
	createdAt: string;
	updatedAt: string;
};

export type ApiEnvelope<TData> = { data: TData };

export type AgentListData = { items: AgentItem[] };

export type GatewaySessionItem = {
	id: string;
	name: string;
	createdAt: string;
	updatedAt: string;
};

export type GatewaySessionList = { items: GatewaySessionItem[] };
export type GatewayRunningList = { items: { id: string }[] };
export type GatewayHealth = { ws: { chatUrl: string } };

const requestGateway = async <TData>({
	agentId,
	path,
	method,
	body,
	query,
	signal,
}: {
	agentId: string;
	path: string;
	method: HttpMethod;
	body?: unknown;
	query?: Record<string, string>;
	signal?: AbortSignal;
}): Promise<RequestResult<ApiEnvelope<TData>>> =>
	request<ApiEnvelope<TData>>({
		url: `/api/agents/${agentId}/gateway/request`,
		method: "POST",
		body: {
			method,
			path,
			query,
			body,
			contentType: "application/json",
		},
		signal,
	});

export const getEnabledAgentId = async ({
	signal,
}: {
	signal?: AbortSignal;
}): Promise<string | null> => {
	const result = await request<ApiEnvelope<AgentListData>>({
		url: "/api/agents",
		method: "GET",
		signal,
	});
	if (!result.ok || !result.data) return null;
	const target = result.data.data.items.find((item) => item.isEnabled);
	return target?.id ?? null;
};

export const getGatewaySessions = async ({
	agentId,
	signal,
}: {
	agentId: string;
	signal?: AbortSignal;
}): Promise<RequestResult<GatewaySessionList>> => {
	const result = await requestGateway<GatewaySessionList>({
		agentId,
		path: "/api/sessions",
		method: "GET",
		signal,
	});
	return { ...result, data: result.data?.data ?? null };
};

export const getGatewayRunningSessions = async ({
	agentId,
	signal,
}: {
	agentId: string;
	signal?: AbortSignal;
}): Promise<RequestResult<GatewayRunningList>> => {
	const result = await requestGateway<GatewayRunningList>({
		agentId,
		path: "/api/sessions/running",
		method: "GET",
		signal,
	});
	return { ...result, data: result.data?.data ?? null };
};

export const abortGatewaySession = async ({
	agentId,
	sessionId,
}: {
	agentId: string;
	sessionId: string;
}): Promise<RequestResult<null>> => {
	const result = await requestGateway<null>({
		agentId,
		path: `/api/sessions/${encodeURIComponent(sessionId)}/abort`,
		method: "POST",
	});
	return { ...result, data: null };
};

export const getWsChatUrl = async ({
	agentId,
}: {
	agentId: string;
}): Promise<string | null> => {
	const result = await requestGateway<GatewayHealth>({
		agentId,
		path: "/health",
		method: "GET",
	});
	if (!result.ok || !result.data) return null;
	return result.data.data.ws.chatUrl;
};
