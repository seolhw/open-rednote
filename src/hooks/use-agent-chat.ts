import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	type AgentMessageItem,
	type AgentMessageRole,
	type AgentSessionItem,
	type ChatMessage,
	type ChatSession,
	createAgentSession,
	createAgentSessionMessage,
	deleteAgentSession,
	getEnabledAgentId,
	getWsChatUrl,
	listAgentSessionMessages,
	listAgentSessions,
} from "#/api/agent-chat";

const toChatMessage = ({ item }: { item: AgentMessageItem }): ChatMessage => ({
	id: item.id,
	role: item.role,
	createdAt: item.createdAt,
	parts: [{ type: "text", content: item.content }],
});

const toChatSession = ({
	item,
	messages,
}: {
	item: AgentSessionItem;
	messages: ChatMessage[];
}): ChatSession => ({
	id: item.id,
	title: item.title,
	messages,
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

const hasTaggedBlocks = ({ text }: { text: string }) =>
	/<think>[\s\S]*?<\/think>|<tool_call>[\s\S]*?<\/tool_call>/.test(text);

const extractWsErrorText = ({
	payload,
}: {
	payload: Record<string, unknown>;
}) => {
	const message = payload.message;
	const error = payload.error;
	const code = payload.code;
	if (typeof message === "string" && message.trim()) {
		if (typeof code === "string" && code.trim()) {
			return `[${code}] ${message}`;
		}
		return message;
	}
	if (typeof error === "string" && error.trim()) return error;
	if (typeof code === "string" && code.trim())
		return `[${code}] Agent 执行失败`;
	return "Agent 执行失败，请稍后重试";
};

export const useAgentChatHook = () => {
	const queryClient = useQueryClient();
	const [selectedSessionId, setSelectedSessionId] = useState("");
	const [streamingAssistantText, setStreamingAssistantText] = useState("");
	const [streamingSessionId, setStreamingSessionId] = useState("");

	const wsSocketRef = useRef<WebSocket | null>(null);
	const activeWsSessionIdRef = useRef("");
	const pendingSessionIdRef = useRef("");
	const streamBufferRef = useRef("");

	const agentIdQuery = useQuery({
		queryKey: ["agent-chat", "enabled-agent-id"],
		queryFn: async () => {
			const agent = await getEnabledAgentId();
			return agent?.id ?? null;
		},
		staleTime: 60_000,
	});

	const sessionsQuery = useQuery({
		queryKey: ["agent-chat", "sessions", agentIdQuery.data],
		enabled: Boolean(agentIdQuery.data),
		queryFn: () =>
			listAgentSessions({
				agentId: agentIdQuery.data ?? undefined,
				status: "active",
			}),
		refetchInterval: 10_000,
	});

	const wsUrlQuery = useQuery({
		queryKey: ["agent-chat", "ws-url", selectedSessionId],
		enabled: Boolean(selectedSessionId),
		queryFn: () => getWsChatUrl({ sessionId: selectedSessionId }),
		staleTime: 60_000,
	});

	const messagesQuery = useQuery({
		queryKey: ["agent-chat", "messages", selectedSessionId],
		enabled: Boolean(selectedSessionId),
		queryFn: () => listAgentSessionMessages({ sessionId: selectedSessionId }),
	});

	const createSessionMutation = useMutation({
		mutationFn: ({ title, agentId }: { title: string; agentId: string }) =>
			createAgentSession({ title, agentId }),
		onSuccess: (created) => {
			void queryClient.invalidateQueries({
				queryKey: ["agent-chat", "sessions", agentIdQuery.data],
			});
			if (created) {
				setSelectedSessionId(created.id);
			}
		},
	});

	const deleteSessionMutation = useMutation({
		mutationFn: ({ sessionId }: { sessionId: string }) =>
			deleteAgentSession({ sessionId }),
		onSuccess: (_, params) => {
			void queryClient.invalidateQueries({
				queryKey: ["agent-chat", "sessions", agentIdQuery.data],
			});
			queryClient.removeQueries({
				queryKey: ["agent-chat", "messages", params.sessionId],
			});
			setSelectedSessionId((current) =>
				current === params.sessionId ? "" : current,
			);
		},
	});

	const createMessageMutation = useMutation({
		mutationFn: ({
			sessionId,
			role,
			content,
		}: {
			sessionId: string;
			role: AgentMessageRole;
			content: string;
		}) =>
			createAgentSessionMessage({
				sessionId,
				role,
				content,
			}),
		onSuccess: (_, params) => {
			void queryClient.invalidateQueries({
				queryKey: ["agent-chat", "sessions", agentIdQuery.data],
			});
			void queryClient.invalidateQueries({
				queryKey: ["agent-chat", "messages", params.sessionId],
			});
		},
	});

	const sessions = useMemo(() => {
		const rows = sessionsQuery.data ?? [];
		return rows.map((row) => {
			const cachedRows = (queryClient.getQueryData<AgentMessageItem[]>([
				"agent-chat",
				"messages",
				row.id,
			]) ?? []) as AgentMessageItem[];
			return toChatSession({
				item: row,
				messages: cachedRows.map((item) => toChatMessage({ item })),
			});
		});
	}, [queryClient, sessionsQuery.data, messagesQuery.data]);

	const selectedSession =
		sessions.find((item) => item.id === selectedSessionId) ?? sessions[0];
	const messages = selectedSession?.messages ?? [];

	useEffect(() => {
		if (
			selectedSessionId &&
			sessions.some((item) => item.id === selectedSessionId)
		)
			return;
		if (sessions.length > 0) {
			setSelectedSessionId(sessions[0].id);
		}
	}, [selectedSessionId, sessions]);

	useEffect(() => {
		return () => {
			if (wsSocketRef.current) {
				wsSocketRef.current.close();
				wsSocketRef.current = null;
			}
		};
	}, []);

	const createSession = async () => {
		const agentId = agentIdQuery.data;
		if (!agentId) return;
		await createSessionMutation.mutateAsync({
			title: `新会话 ${sessions.length + 1}`,
			agentId,
		});
	};

	const selectSession = ({ sessionId }: { sessionId: string }) => {
		setSelectedSessionId(sessionId);
	};

	const deleteSession = async ({ sessionId }: { sessionId: string }) => {
		await deleteSessionMutation.mutateAsync({ sessionId });
	};

	const sendMessage = async (input: string) => {
		const content = input.trim();
		const currentSession =
			sessions.find((item) => item.id === selectedSessionId) ?? sessions[0];
		if (!content || !currentSession) return;

		await createMessageMutation.mutateAsync({
			sessionId: currentSession.id,
			role: "user",
			content,
		});

		const socket = await connectSessionViaWs({
			sessionId: currentSession.id,
			sessionName: currentSession.title,
		});

		if (!socket || socket.readyState !== WebSocket.OPEN) {
			await createMessageMutation.mutateAsync({
				sessionId: currentSession.id,
				role: "assistant",
				content: "WebSocket 未连接，无法发送消息",
			});
			setStreamingAssistantText("");
			setStreamingSessionId("");
			return;
		}

		setStreamingAssistantText("");
		setStreamingSessionId(currentSession.id);
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

	const isSessionsLoading = agentIdQuery.isPending || sessionsQuery.isPending;
	const isLoading =
		agentIdQuery.isPending ||
		sessionsQuery.isPending ||
		messagesQuery.isPending ||
		createSessionMutation.isPending ||
		deleteSessionMutation.isPending ||
		createMessageMutation.isPending;

	return {
		sessions,
		selectedSessionId,
		selectSession,
		createSession,
		deleteSession,
		messages,
		sendMessage,
		streamingAssistantText,
		streamingSessionId,
		isLoading,
		isSessionsLoading,
	};

	async function connectSessionViaWs({
		sessionId,
		sessionName,
	}: {
		sessionId: string;
		sessionName: string;
	}): Promise<WebSocket | null> {
		const wsUrl = wsUrlQuery.data;

		if (!wsUrl?.url) return null;

		if (
			activeWsSessionIdRef.current === sessionId &&
			wsSocketRef.current?.readyState === WebSocket.OPEN
		) {
			return wsSocketRef.current;
		}

		if (wsSocketRef.current) {
			wsSocketRef.current.close();
			wsSocketRef.current = null;
		}

		const url = new URL(wsUrl.url);
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
			if (textChunk) {
				streamBufferRef.current = `${streamBufferRef.current}${textChunk}`;
				setStreamingAssistantText(streamBufferRef.current);
			}

			const type = typeof payload.type === "string" ? payload.type : "";
			if (type === "error") {
				const replySessionId = pendingSessionIdRef.current;
				if (replySessionId) {
					await createMessageMutation.mutateAsync({
						sessionId: replySessionId,
						role: "assistant",
						content: `❌ ${extractWsErrorText({ payload })}`,
					});
				}
				pendingSessionIdRef.current = "";
				streamBufferRef.current = "";
				setStreamingAssistantText("");
				setStreamingSessionId("");
				return;
			}
			if (type !== "done" && type !== "message") return;

			const extractedFinalText = extractWsFinalText({ payload });
			const bufferedText = streamBufferRef.current;
			const finalText =
				hasTaggedBlocks({ text: bufferedText }) &&
				!hasTaggedBlocks({ text: extractedFinalText })
					? bufferedText
					: extractedFinalText || bufferedText || "Agent 暂无返回内容";

			const replySessionId = pendingSessionIdRef.current;
			if (replySessionId) {
				await createMessageMutation.mutateAsync({
					sessionId: replySessionId,
					role: "assistant",
					content: finalText,
				});
			}

			pendingSessionIdRef.current = "";
			streamBufferRef.current = "";
			setStreamingAssistantText("");
			setStreamingSessionId("");
		};

		socket.onclose = () => {
			if (activeWsSessionIdRef.current === sessionId) {
				activeWsSessionIdRef.current = "";
			}
		};

		wsSocketRef.current = socket;

		return new Promise((resolve) => {
			socket.addEventListener("open", () => resolve(socket), { once: true });
			socket.addEventListener("error", () => resolve(null), { once: true });
		});
	}
};
