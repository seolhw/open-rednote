import { useEffect, useRef, useState } from "react";
import {
	type AgentMessageItem,
	type AgentMessageRole,
	type AgentSessionItem,
	abortGatewaySession,
	createAgentSession,
	createAgentSessionMessage,
	deleteAgentSession,
	getEnabledAgentId,
	getWsChatUrl,
	listAgentSessionMessages,
	listAgentSessions,
} from "#/api/agent-chat";

export interface ChatTextPart {
	type: "text";
	content: string;
}
export interface ChatToolCallPart {
	type: "tool-call";
	id: string;
	name: string;
	output?: unknown;
}
export type ChatPart = ChatTextPart | ChatToolCallPart;
export interface ChatMessage {
	id: string;
	role: "user" | "assistant" | "system";
	parts: ChatPart[];
}
export type ChatMessages = ChatMessage[];
export interface ChatSession {
	id: string;
	title: string;
	messages: ChatMessages;
	createdAt: string;
	updatedAt: string;
}

const nowIso = () => new Date().toISOString();

const appendMessageToSession = ({
	sessions,
	sessionId,
	message,
}: {
	sessions: ChatSession[];
	sessionId: string;
	message: ChatMessage;
}): ChatSession[] =>
	sessions.map((session) =>
		session.id === sessionId
			? {
					...session,
					messages: [...session.messages, message],
					updatedAt: nowIso(),
				}
			: session,
	);

const toChatMessage = ({ item }: { item: AgentMessageItem }): ChatMessage => ({
	id: item.id,
	role: item.role,
	parts: [{ type: "text", content: item.content }],
});

const toChatSession = ({
	item,
	oldMessages,
}: {
	item: AgentSessionItem;
	oldMessages?: ChatMessages;
}): ChatSession => ({
	id: item.id,
	title: item.title,
	messages: oldMessages ?? [],
	createdAt: item.createdAt,
	updatedAt: item.updatedAt,
});

const toWsPayload = ({
	content,
	sessionId,
	sessionName,
}: {
	content: string;
	sessionId: string;
	sessionName: string;
}) => ({
	type: "message",
	content,
	session_id: sessionId,
	name: sessionName,
});

export const useAgentChatHook = () => {
	const [sessions, setSessions] = useState<ChatSession[]>([]);
	const [selectedSessionId, setSelectedSessionId] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [agentId, setAgentId] = useState<string | null>(null);

	const wsBaseChatUrlRef = useRef("");
	const wsSocketRef = useRef<WebSocket | null>(null);
	const activeWsSessionIdRef = useRef("");
	const pendingSessionIdRef = useRef("");
	const streamBufferRef = useRef("");

	const selectedSession =
		sessions.find((item) => item.id === selectedSessionId) ?? sessions[0];
	const messages = selectedSession?.messages ?? [];

	useEffect(() => {
		void init();
		return () => {
			if (wsSocketRef.current) wsSocketRef.current.close();
		};
	}, []);

	useEffect(() => {
		if (!selectedSessionId) return;
		const current = sessions.find((item) => item.id === selectedSessionId);
		if (!current || current.messages.length > 0) return;
		void loadMessages({ sessionId: selectedSessionId });
	}, [selectedSessionId, sessions]);

	const createSessionAndSelect = async () => {
		if (!agentId) return;
		const created = await createAgentSession({
			title: `新会话 ${sessions.length + 1}`,
			agentId,
		});
		if (!created) return;
		const session = toChatSession({ item: created });
		setSessions((prev) => [session, ...prev]);
		setSelectedSessionId(session.id);
	};

	const selectSession = ({ sessionId }: { sessionId: string }) =>
		setSelectedSessionId(sessionId);

	const deleteSession = async ({ sessionId }: { sessionId: string }) => {
		await deleteAgentSession({ sessionId });
		setSessions((prev) => prev.filter((item) => item.id !== sessionId));
		setSelectedSessionId((current) => (current === sessionId ? "" : current));
	};

	const sendMessage = async (input: string) => {
		const content = input.trim();
		const currentSession =
			sessions.find((item) => item.id === selectedSessionId) ?? sessions[0];
		if (!content || !currentSession) return;

		const createdUser = await createAgentSessionMessage({
			sessionId: currentSession.id,
			role: "user",
			content,
		});
		const userMessage: ChatMessage = createdUser
			? toChatMessage({ item: createdUser })
			: {
					id: crypto.randomUUID(),
					role: "user",
					parts: [{ type: "text", content }],
				};

		setSessions((prev) =>
			appendMessageToSession({
				sessions: prev,
				sessionId: currentSession.id,
				message: userMessage,
			}),
		);
		setIsLoading(true);

		const socket = await connectSessionViaWs({
			sessionId: currentSession.id,
			sessionName: currentSession.title,
		});
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			const errorMessage: ChatMessage = {
				id: crypto.randomUUID(),
				role: "assistant",
				parts: [{ type: "text", content: "WebSocket 未连接，无法发送消息" }],
			};
			setSessions((prev) =>
				appendMessageToSession({
					sessions: prev,
					sessionId: currentSession.id,
					message: errorMessage,
				}),
			);
			setIsLoading(false);
			return;
		}

		pendingSessionIdRef.current = currentSession.id;
		streamBufferRef.current = "";
		socket.send(
			JSON.stringify(
				toWsPayload({
					content,
					sessionId: currentSession.id,
					sessionName: currentSession.title,
				}),
			),
		);
	};

	const stop = () => {
		if (agentId && selectedSessionId)
			void abortGatewaySession({ agentId, sessionId: selectedSessionId });
		setIsLoading(false);
	};

	return {
		sessions,
		selectedSessionId,
		selectSession,
		createSession: createSessionAndSelect,
		deleteSession,
		messages,
		sendMessage,
		isLoading,
		stop,
	};

	async function init() {
		const id = await getEnabledAgentId({});
		setAgentId(id);
		if (!id) return;
		await loadSessions({ targetAgentId: id });
	}

	async function loadSessions({ targetAgentId }: { targetAgentId: string }) {
		const rows = await listAgentSessions({
			agentId: targetAgentId,
			status: "active",
		});
		setSessions((prev) =>
			rows.map((row) =>
				toChatSession({
					item: row,
					oldMessages: prev.find((old) => old.id === row.id)?.messages,
				}),
			),
		);
		setSelectedSessionId((current) =>
			current && rows.some((row) => row.id === current)
				? current
				: (rows[0]?.id ?? ""),
		);
	}

	async function loadMessages({ sessionId }: { sessionId: string }) {
		const rows = await listAgentSessionMessages({ sessionId });
		const mapped = rows.map((item) => toChatMessage({ item }));
		setSessions((prev) =>
			prev.map((item) =>
				item.id === sessionId ? { ...item, messages: mapped } : item,
			),
		);
	}

	async function connectSessionViaWs({
		sessionId,
		sessionName,
	}: {
		sessionId: string;
		sessionName: string;
	}): Promise<WebSocket | null> {
		if (!agentId) return null;
		if (!wsBaseChatUrlRef.current) {
			const wsChatUrl = await getWsChatUrl({ agentId });
			if (!wsChatUrl) return null;
			wsBaseChatUrlRef.current = wsChatUrl;
		}

		if (
			activeWsSessionIdRef.current === sessionId &&
			wsSocketRef.current?.readyState === WebSocket.OPEN
		)
			return wsSocketRef.current;
		if (wsSocketRef.current) wsSocketRef.current.close();

		const url = new URL(wsBaseChatUrlRef.current);
		url.searchParams.set("session_id", sessionId);
		url.searchParams.set("name", sessionName);

		const socket = new WebSocket(url.toString());

		socket.onopen = () => {
			activeWsSessionIdRef.current = sessionId;
		};
		socket.onmessage = async (event) => {
			const raw = typeof event.data === "string" ? event.data : "";
			if (!raw) return;

			const payload = JSON.parse(raw) as Record<string, unknown>;
			const textChunk = extractWsTextChunk({ payload });
			if (textChunk)
				streamBufferRef.current = `${streamBufferRef.current}${textChunk}`;

			const type = typeof payload.type === "string" ? payload.type : "";
			if (type !== "done" && type !== "message") return;

			const finalText =
				extractWsFinalText({ payload }) ||
				streamBufferRef.current ||
				"Agent 暂无返回内容";
			const replySessionId = pendingSessionIdRef.current;
			if (replySessionId) {
				const persisted = await createAgentSessionMessage({
					sessionId: replySessionId,
					role: "assistant" satisfies AgentMessageRole,
					content: finalText,
				});

				const assistantMessage: ChatMessage = persisted
					? toChatMessage({ item: persisted })
					: {
							id: crypto.randomUUID(),
							role: "assistant",
							parts: [{ type: "text", content: finalText }],
						};

				setSessions((prev) =>
					appendMessageToSession({
						sessions: prev,
						sessionId: replySessionId,
						message: assistantMessage,
					}),
				);
			}

			pendingSessionIdRef.current = "";
			streamBufferRef.current = "";
			setIsLoading(false);
		};
		socket.onclose = () => {
			if (activeWsSessionIdRef.current === sessionId)
				activeWsSessionIdRef.current = "";
		};

		wsSocketRef.current = socket;
		return new Promise((resolve) => {
			socket.addEventListener("open", () => resolve(socket), { once: true });
			socket.addEventListener("error", () => resolve(null), { once: true });
		});
	}
};

const extractWsTextChunk = ({
	payload,
}: {
	payload: Record<string, unknown>;
}): string => {
	const delta = payload.delta;
	if (typeof delta === "string") return delta;
	const content = payload.content;
	if (typeof content === "string") return content;
	return "";
};

const extractWsFinalText = ({
	payload,
}: {
	payload: Record<string, unknown>;
}): string => {
	const full = payload.full_response;
	if (typeof full === "string") return full;
	const message = payload.message;
	if (typeof message === "string") return message;
	const content = payload.content;
	if (typeof content === "string") return content;
	return "";
};
