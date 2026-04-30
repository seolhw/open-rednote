import { request } from "./request";

export type AgentSessionStatus = "active" | "archived";
export type AgentMessageRole = "system" | "user" | "assistant";

export interface AgentSessionItem {
	id: string;
	title: string;
	status: AgentSessionStatus;
	agentId: string | null;
	lastMessageAt: string | null;
	createdAt: string;
	updatedAt: string;
	messageCount: number;
	lastMessage: AgentMessageItem | null;
}

export interface AgentMessageItem {
	id: string;
	conversationId: string;
	role: AgentMessageRole;
	content: string;
	meta: unknown;
	createdAt: string;
	updatedAt: string;
}

export interface ChatMessage {
	id: string;
	role: AgentMessageRole;
	parts: { type: "text"; content: string }[];
	createdAt: string;
}

export interface ChatSession {
	id: string;
	title: string;
	messages: ChatMessage[];
	lastMessage: ChatMessage | null;
	createdAt: string;
	updatedAt: string;
}

export const listAgentSessions = async ({
	agentId,
	status,
}: {
	agentId?: string;
	status?: AgentSessionStatus;
}): Promise<AgentSessionItem[]> => {
	const query = new URLSearchParams();
	if (agentId) query.set("agentId", agentId);
	if (status) query.set("status", status);
	const suffix = query.toString();
	const result = await request<{ items: AgentSessionItem[] }>({
		url: suffix ? `/api/agent-sessions?${suffix}` : "/api/agent-sessions",
		method: "GET",
	});
	return result?.items ?? [];
};

export const createAgentSession = async ({
	title,
	agentId,
}: {
	title?: string;
	agentId?: string;
}): Promise<AgentSessionItem | null> =>
	request<AgentSessionItem>({
		url: "/api/agent-sessions",
		method: "POST",
		body: { title, agentId },
	});

export const updateAgentSession = async ({
	sessionId,
	title,
	status,
}: {
	sessionId: string;
	title?: string;
	status?: AgentSessionStatus;
}): Promise<AgentSessionItem | null> =>
	request<AgentSessionItem>({
		url: `/api/agent-sessions/${sessionId}`,
		method: "PATCH",
		body: { title, status },
	});

export const deleteAgentSession = async ({
	sessionId,
}: {
	sessionId: string;
}): Promise<{ success: boolean } | null> =>
	request<{ success: boolean }>({
		url: `/api/agent-sessions/${sessionId}`,
		method: "DELETE",
	});

export const listAgentSessionMessages = async ({
	sessionId,
	take = 200,
}: {
	sessionId: string;
	take?: number;
}): Promise<AgentMessageItem[]> => {
	const result = await request<{ items: AgentMessageItem[] }>({
		url: `/api/agent-sessions/${sessionId}/messages?take=${take}`,
		method: "GET",
	});
	return result?.items ?? [];
};

export const createAgentSessionMessage = async ({
	sessionId,
	role,
	content,
	meta,
}: {
	sessionId: string;
	role: AgentMessageRole;
	content: string;
	meta?: unknown;
}): Promise<AgentMessageItem | null> =>
	request<AgentMessageItem>({
		url: `/api/agent-sessions/${sessionId}/messages`,
		method: "POST",
		body: { role, content, meta },
	});

export const getWsChatUrl = async ({
	sessionId,
}: {
	sessionId: string;
}): Promise<{ url: string } | null> =>
	request<{ url: string }>({
		url: `/api/agent-sessions/${sessionId}/ws`,
		method: "GET",
	});

export const getEnabledAgentId = async () =>
	request<{ id: string } | null>({
		url: "/api/agents/enabled",
		method: "GET",
	});
