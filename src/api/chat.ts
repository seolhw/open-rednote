import { type HttpMethod, request } from "./request";

export interface AgentItem {
	id: string;
	name: string;
	baseUrl: string;
	description: string | null;
	isEnabled: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface AgentListData {
	items: AgentItem[];
}

export interface GatewaySessionItem {
	created_at: string;
	last_activity: string;
	message_count: number;
	session_id: string;
}

export interface GatewaySessionList {
	sessions: GatewaySessionItem[];
}

export interface GatewayRunningList {
	sessions: GatewaySessionItem[];
}

interface WsConfig {
	chatUrl: string;
}

export interface GatewayHealth {
	ws: WsConfig;
}

interface WithSignal {
	signal?: AbortSignal;
}

interface WithAgentId extends WithSignal {
	agentId: string;
}

interface GatewayRequestParams extends WithAgentId {
	path: string;
	method: HttpMethod;
	body?: unknown;
	query?: Record<string, string>;
}

interface AbortGatewaySessionParams {
	agentId: string;
	sessionId: string;
}

const requestGateway = async <TData>({
	agentId,
	path,
	method,
	body,
	query,
	signal,
}: GatewayRequestParams): Promise<TData | null> =>
	request<TData>({
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
}: WithSignal): Promise<string | null> => {
	const result = await request<AgentListData>({
		url: "/api/agents",
		method: "GET",
		signal,
	});
	if (!result) return null;
	const target = result.items.find((item) => item.isEnabled);
	return target?.id ?? null;
};

export const getGatewaySessions = async ({
	agentId,
	signal,
}: WithAgentId): Promise<GatewaySessionList | null> => {
	const result = await requestGateway<GatewaySessionList>({
		agentId,
		path: "/api/sessions",
		method: "GET",
		signal,
	});
	return result;
};

export const getGatewayRunningSessions = async ({
	agentId,
	signal,
}: WithAgentId): Promise<GatewayRunningList | null> => {
	const result = await requestGateway<GatewayRunningList>({
		agentId,
		path: "/api/sessions/running",
		method: "GET",
		signal,
	});
	return result;
};

export const abortGatewaySession = async ({
	agentId,
	sessionId,
}: AbortGatewaySessionParams): Promise<null> => {
	const result = await requestGateway<null>({
		agentId,
		path: `/api/sessions/${encodeURIComponent(sessionId)}/abort`,
		method: "POST",
	});
	return result;
};

export const getWsChatUrl = async ({
	agentId,
}: Pick<WithAgentId, "agentId">): Promise<string | null> => {
	const result = await requestGateway<GatewayHealth>({
		agentId,
		path: "/health",
		method: "GET",
	});
	if (!result) return null;
	return result.ws.chatUrl;
};
