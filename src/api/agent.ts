export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type AgentItem = {
	id: string;
	name: string;
	baseUrl: string;
	description: string | null;
	isEnabled: boolean;
	createdAt: string;
	updatedAt: string;
};

export type CreateAgentPayload = {
	name: string;
	baseUrl: string;
	token: string;
	description?: string;
	isEnabled?: boolean;
};

export type UpdateAgentPayload = {
	name?: string;
	baseUrl?: string;
	token?: string;
	description?: string | null;
	isEnabled?: boolean;
};

type AgentListResponse = {
	items: AgentItem[];
};

export type GatewayProbeResponse = {
	ok: boolean;
	status: number;
	contentType: string;
	targetUrl: string;
	endpoint: {
		key: string;
		path: string;
		method: HttpMethod;
	};
	ws: {
		chatPath: string;
		chatUrl: string;
	};
	data: unknown;
};

const BEARER_TOKEN_KEY = "bearer_token";

const getBearerToken = () => {
	if (typeof window === "undefined") return "";
	return localStorage.getItem(BEARER_TOKEN_KEY) || "";
};

const parseResponseData = async ({
	response,
}: {
	response: Response;
}): Promise<unknown> => {
	const contentType = response.headers.get("content-type") ?? "";
	const raw = await response.text();
	if (!raw) return null;
	if (contentType.includes("application/json")) {
		return JSON.parse(raw);
	}
	return raw;
};

const extractErrorMessage = ({
	data,
	status,
}: {
	data: unknown;
	status: number;
}) => {
	if (typeof data === "object" && data !== null && "error" in data) {
		const message = (data as { error?: unknown }).error;
		if (typeof message === "string" && message) {
			return message;
		}
	}
	return `请求失败(${status})`;
};

const requestAgentApi = async <TData>({
	url,
	method = "GET",
	body,
}: {
	url: string;
	method?: HttpMethod;
	body?: unknown;
}): Promise<TData> => {
	const token = getBearerToken();
	const response = await fetch(url, {
		method,
		headers: {
			"Content-Type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const data = await parseResponseData({ response });
	if (!response.ok) {
		throw new Error(
			extractErrorMessage({
				data,
				status: response.status,
			}),
		);
	}
	return data as TData;
};

export const listAgents = async (): Promise<AgentItem[]> => {
	const result = await requestAgentApi<AgentListResponse>({
		url: "/api/agents",
		method: "GET",
	});
	return result.items ?? [];
};

export const createAgent = async ({
	payload,
}: {
	payload: CreateAgentPayload;
}): Promise<AgentItem> =>
	requestAgentApi<AgentItem>({
		url: "/api/agents",
		method: "POST",
		body: payload,
	});

export const updateAgent = async ({
	agentId,
	payload,
}: {
	agentId: string;
	payload: UpdateAgentPayload;
}): Promise<AgentItem> =>
	requestAgentApi<AgentItem>({
		url: `/api/agents/${agentId}`,
		method: "PATCH",
		body: payload,
	});

export const deleteAgent = async ({
	agentId,
}: {
	agentId: string;
}): Promise<{ success: boolean }> =>
	requestAgentApi<{ success: boolean }>({
		url: `/api/agents/${agentId}`,
		method: "DELETE",
	});

export const probeByGatewayRequest = async ({
	agentId,
	path,
}: {
	agentId: string;
	path: string;
}): Promise<GatewayProbeResponse> =>
	requestAgentApi<GatewayProbeResponse>({
		url: `/api/agents/${agentId}/gateway/request`,
		method: "POST",
		body: {
			method: "GET",
			path,
		},
	});
