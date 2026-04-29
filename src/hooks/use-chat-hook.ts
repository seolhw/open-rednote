import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
	abortGatewaySession,
	type GatewayRunningList,
	type GatewaySessionList,
	getEnabledAgentId,
	getGatewayRunningSessions,
	getGatewaySessions,
	getWsChatUrl,
} from "../api/chat";

export type ChatPart =
	| { type: "text"; content: string }
	| {
			type: "tool-call";
			id: string;
			name: string;
			output?: unknown;
	  };

export type ChatMessage = {
	id: string;
	role: "user" | "assistant" | "system";
	parts: ChatPart[];
};

export type ChatMessages = ChatMessage[];

export type ChatSession = {
	id: string;
	title: string;
	messages: ChatMessages;
	createdAt: string;
	updatedAt: string;
};

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

const nowIso = () => new Date().toISOString();

const createLocalSession = ({ title }: { title: string }): ChatSession => ({
	id: crypto.randomUUID(),
	title,
	messages: [],
	createdAt: nowIso(),
	updatedAt: nowIso(),
});

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

export const useChatHook = () => {
	const initialLocalSession = createLocalSession({ title: "新会话" });
	const [sessions, setSessions] = useState<ChatSession[]>([
		initialLocalSession,
	]);
	const [selectedSessionId, setSelectedSessionId] = useState(
		initialLocalSession.id,
	);
	const [isLoading, setIsLoading] = useState(false);
	const abortRef = useRef<AbortController | null>(null);
	const wsBaseChatUrlRef = useRef("");
	const wsSocketRef = useRef<WebSocket | null>(null);
	const activeWsSessionIdRef = useRef("");
	const pendingSessionIdRef = useRef("");
	const streamBufferRef = useRef("");

	const queryClient = useQueryClient();

	const agentIdQuery = useQuery({
		queryKey: ["chat", "enabled-agent-id"],
		queryFn: () => getEnabledAgentId({}),
		staleTime: 60_000,
	});

	const sessionsQuery = useQuery({
		queryKey: ["chat", "sessions", agentIdQuery.data],
		enabled: Boolean(agentIdQuery.data),
		queryFn: async () => {
			const agentId = agentIdQuery.data;
			if (!agentId) return { sessions: null, running: null };
			const [sessionsResult, runningResult] = await Promise.all([
				getGatewaySessions({ agentId }),
				getGatewayRunningSessions({ agentId }),
			]);
			return {
				sessions: sessionsResult.ok ? sessionsResult.data : null,
				running: runningResult.ok ? runningResult.data : null,
			};
		},
		refetchInterval: 10_000,
	});

	const resolveAgentId = async (): Promise<string | null> => {
		const cached = queryClient.getQueryData<string | null>([
			"chat",
			"enabled-agent-id",
		]);
		if (cached !== undefined) return cached;
		return queryClient.fetchQuery({
			queryKey: ["chat", "enabled-agent-id"],
			queryFn: () => getEnabledAgentId({}),
			staleTime: 60_000,
		});
	};

	const abortSessionMutation = useMutation({
		mutationFn: async ({ sessionId }: { sessionId: string }) => {
			const agentId = await resolveAgentId();
			if (!agentId) return;
			await abortGatewaySession({ agentId, sessionId });
		},
		onSuccess: () => {
			void sessionsQuery.refetch();
		},
	});

	const selectedSession =
		sessions.find((item) => item.id === selectedSessionId) ?? sessions[0];
	const messages = selectedSession?.messages ?? [];

	const createSession = () => {
		const created = createLocalSession({
			title: `新会话 ${sessions.length + 1}`,
		});
		setSessions((prev) => [created, ...prev]);
		setSelectedSessionId(created.id);
	};

	const selectSession = ({ sessionId }: { sessionId: string }) => {
		setSelectedSessionId(sessionId);
	};

	useEffect(() => {
		const sessionsPayload = sessionsQuery.data?.sessions ?? null;
		if (!sessionsPayload) return;
		setSessions((previous) => {
			const merged = toChatSessions({
				sessionsPayload,
				runningPayload: sessionsQuery.data?.running ?? null,
				previous,
			});
			if (!merged.length) return previous;
			setSelectedSessionId((current) =>
				current && merged.some((item) => item.id === current)
					? current
					: merged[0].id,
			);
			return merged;
		});
	}, [sessionsQuery.data]);

	const sendMessage = async (input: string) => {
		const content = input.trim();
		if (!content || !selectedSession || !selectedSession.id) return;
		const userMessage: ChatMessage = {
			id: crypto.randomUUID(),
			role: "user",
			parts: [{ type: "text", content }],
		};
		setSessions((prev) =>
			appendMessageToSession({
				sessions: prev,
				sessionId: selectedSession.id,
				message: userMessage,
			}),
		);
		setIsLoading(true);
		const socket = await connectSessionViaWs({
			sessionId: selectedSession.id,
			sessionName: selectedSession.title,
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
					sessionId: selectedSession.id,
					message: errorMessage,
				}),
			);
			setIsLoading(false);
			return;
		}
		pendingSessionIdRef.current = selectedSession.id;
		streamBufferRef.current = "";
		socket.send(
			JSON.stringify(
				toWsPayload({
					content,
					sessionId: selectedSession.id,
					sessionName: selectedSession.title,
				}),
			),
		);
	};

	const stop = () => {
		if (abortRef.current) {
			abortRef.current.abort();
			abortRef.current = null;
		}
		if (selectedSessionId) {
			void abortSessionMutation.mutateAsync({ sessionId: selectedSessionId });
		}
		setIsLoading(false);
	};

	useEffect(() => {
		return () => {
			if (wsSocketRef.current) {
				wsSocketRef.current.close();
				wsSocketRef.current = null;
			}
		};
	}, []);

	return {
		sessions,
		selectedSessionId,
		selectSession,
		createSession,
		messages,
		sendMessage,
		isLoading,
		stop,
	};

	async function connectSessionViaWs({
		sessionId,
		sessionName,
	}: {
		sessionId: string;
		sessionName: string;
	}): Promise<WebSocket | null> {
		const agentId = await resolveAgentId();
		if (!agentId) return null;
		if (!wsBaseChatUrlRef.current) {
			const wsChatUrl = await queryClient.fetchQuery({
				queryKey: ["chat", "ws-chat-url", agentId],
				queryFn: () => getWsChatUrl({ agentId }),
				staleTime: 60_000,
			});
			if (!wsChatUrl) return null;
			wsBaseChatUrlRef.current = wsChatUrl;
		}
		if (
			activeWsSessionIdRef.current === sessionId &&
			wsSocketRef.current &&
			wsSocketRef.current.readyState === WebSocket.OPEN
		) {
			return wsSocketRef.current;
		}
		if (wsSocketRef.current) {
			wsSocketRef.current.close();
			wsSocketRef.current = null;
		}
		const url = new URL(wsBaseChatUrlRef.current);
		url.searchParams.set("session_id", sessionId);
		url.searchParams.set("name", sessionName);
		const socket = new WebSocket(url.toString());
		socket.onopen = () => {
			activeWsSessionIdRef.current = sessionId;
		};
		socket.onmessage = (event) => {
			const raw = typeof event.data === "string" ? event.data : "";
			if (!raw) return;
			const payload = JSON.parse(raw) as Record<string, unknown>;
			const textChunk = extractWsTextChunk({ payload });
			if (textChunk) {
				streamBufferRef.current = `${streamBufferRef.current}${textChunk}`;
			}
			const type = typeof payload.type === "string" ? payload.type : "";
			if (type === "done" || type === "message") {
				const finalText =
					extractWsFinalText({ payload }) ||
					streamBufferRef.current ||
					"Agent 暂无返回内容";
				const sessionIdForReply = pendingSessionIdRef.current;
				if (sessionIdForReply) {
					const assistantMessage: ChatMessage = {
						id: crypto.randomUUID(),
						role: "assistant",
						parts: [{ type: "text", content: finalText }],
					};
					setSessions((prev) =>
						appendMessageToSession({
							sessions: prev,
							sessionId: sessionIdForReply,
							message: assistantMessage,
						}),
					);
				}
				pendingSessionIdRef.current = "";
				streamBufferRef.current = "";
				setIsLoading(false);
			}
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

const toChatSessions = ({
	sessionsPayload,
	runningPayload,
	previous,
}: {
	sessionsPayload: GatewaySessionList | null;
	runningPayload: GatewayRunningList | null;
	previous: ChatSession[];
}): ChatSession[] => {
	if (!sessionsPayload) return [];
	const runningIds = new Set(
		(runningPayload?.items ?? []).map((item) => item.id),
	);
	return sessionsPayload.items.map((row) => {
		const old = previous.find((p) => p.id === row.id);
		const title = runningIds.has(row.id) ? `${row.name} · 运行中` : row.name;
		return {
			id: row.id,
			title,
			messages: old?.messages ?? [],
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		};
	});
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
