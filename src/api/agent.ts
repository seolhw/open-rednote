import { request } from "./request";

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

export const listAgents = async () => {
	const result = await request<{ items: AgentItem[] }>({
		url: "/api/agents",
		method: "GET",
	});
	return result?.items ?? [];
};

export const createAgent = ({ payload }: { payload: CreateAgentPayload }) =>
	request<AgentItem>({
		url: "/api/agents",
		method: "POST",
		body: payload,
	});

export const updateAgent = ({
	agentId,
	payload,
}: {
	agentId: string;
	payload: UpdateAgentPayload;
}) =>
	request<AgentItem>({
		url: `/api/agents/${agentId}`,
		method: "PATCH",
		body: payload,
	});

export const deleteAgent = ({ agentId }: { agentId: string }) =>
	request<{ success: boolean }>({
		url: `/api/agents/${agentId}`,
		method: "DELETE",
	});

type RuntimeComponent = {
	last_error: unknown | null;
	last_ok?: string;
	restart_count?: number;
	status: string;
	updated_at?: string;
};

export const getAgentHealth = () =>
	request<{
		paired: boolean;
		require_pairing: boolean;
		status: string;
		runtime: {
			components: Record<string, RuntimeComponent>;
			pid?: number;
			updated_at?: string;
			uptime_seconds?: number;
		};
	}>({
		url: "/api/zeroclaw",
		method: "POST",
		body: { key: "health" },
	});

export const getAgentApiHealth = () =>
	request<{
		health: {
			components: Record<string, RuntimeComponent>;
			pid?: number;
			updated_at?: string;
			uptime_seconds?: number;
		};
	}>({
		url: "/api/zeroclaw",
		method: "POST",
		body: { key: "apiHealth" },
	});
