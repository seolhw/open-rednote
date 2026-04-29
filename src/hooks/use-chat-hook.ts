import { useEffect, useRef, useState } from "react";

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

type AgentItem = {
	id: string;
	name: string;
	baseUrl: string;
	description: string | null;
	isEnabled: boolean;
	createdAt: string;
	updatedAt: string;
};

type AgentListResponse = {
	items: AgentItem[];
};

type RequestResult = {
	ok: boolean;
	status: number;
	data: unknown;
};

const parseResponseData = async ({
	response,
}: {
	response: Response;
}): Promise<unknown> => {
	const contentType = response.headers.get("content-type") ?? "";
	const raw = await response.text();

	if (!raw) {
		return null;
	}
	if (contentType.includes("application/json")) {
		return JSON.parse(raw);
	}
	return raw;
};

const requestJson = async ({
	url,
	method = "GET",
	body,
	signal,
}: {
	url: string;
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	body?: unknown;
	signal?: AbortSignal;
}): Promise<RequestResult> => {
	const settled = await Promise.allSettled([
		fetch(url, {
			method,
			headers: { "Content-Type": "application/json" },
			body: body === undefined ? undefined : JSON.stringify(body),
			signal,
		}),
	]);

	const result = settled[0];
	if (result.status === "rejected") {
		return {
			ok: false,
			status: 0,
			data: {
				error: "请求失败",
				details:
					result.reason instanceof Error
						? result.reason.message
						: "unknown error",
			},
		};
	}

	const data = await parseResponseData({ response: result.value });
	return {
		ok: result.value.ok,
		status: result.value.status,
		data,
	};
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
	const preferredAgentIdRef = useRef<string | null>(null);
	const wsBaseChatUrlRef = useRef("");
	const wsSocketRef = useRef<WebSocket | null>(null);
	const activeWsSessionIdRef = useRef("");
	const pendingSessionIdRef = useRef("");
	const streamBufferRef = useRef("");

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

	const resolveAgentId = async ({
		signal,
	}: {
		signal?: AbortSignal;
	}): Promise<string | null> => {
		if (preferredAgentIdRef.current) return preferredAgentIdRef.current;
		const listResult = await requestJson({
			url: "/api/agents",
			method: "GET",
			signal,
		});
		if (!listResult.ok) return null;
		const payload = listResult.data as AgentListResponse;
		const target = (payload.items ?? []).find((item) => item.isEnabled);
		if (!target) return null;
		preferredAgentIdRef.current = target.id;
		return target.id;
	};

	const refreshSessions = async ({ signal }: { signal?: AbortSignal }) => {
		const agentId = await resolveAgentId({ signal });
		if (!agentId) return;
		const [sessionsResult, runningResult] = await Promise.all([
			requestGateway({
				agentId,
				path: "/api/sessions",
				method: "GET",
				signal,
			}),
			requestGateway({
				agentId,
				path: "/api/sessions/running",
				method: "GET",
				signal,
			}),
		]);
		if (!sessionsResult.ok) return;
		setSessions((previous) => {
			const merged = toChatSessions({
				sessionsPayload: sessionsResult.data,
				runningPayload: runningResult.ok ? runningResult.data : null,
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
	};

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
			void (async () => {
				const agentId = await resolveAgentId({});
				if (!agentId) return;
				await requestGateway({
					agentId,
					path: `/api/sessions/${encodeURIComponent(selectedSessionId)}/abort`,
					method: "POST",
				});
			})();
		}
		setIsLoading(false);
	};

	useEffect(() => {
		void refreshSessions({});
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
		const agentId = await resolveAgentId({});
		if (!agentId) return null;
		if (!wsBaseChatUrlRef.current) {
			const wsInfoResult = await requestGateway({
				agentId,
				path: "/health",
				method: "GET",
			});
			if (!wsInfoResult.ok) return null;
			const wsChatUrl = extractWsChatUrl({ payload: wsInfoResult.data });
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

type RecordValue = Record<string, unknown>;

const asRecord = ({ value }: { value: unknown }): RecordValue | null =>
	typeof value === "object" && value !== null ? (value as RecordValue) : null;

const asArray = ({ value }: { value: unknown }): unknown[] =>
	Array.isArray(value) ? value : [];

const unwrapGatewayData = ({ payload }: { payload: unknown }): unknown => {
	const record = asRecord({ value: payload });
	if (!record) return payload;
	return "data" in record ? record.data : payload;
};

const toIdList = ({ payload }: { payload: unknown }): string[] => {
	const data = unwrapGatewayData({ payload });
	const root = asRecord({ value: data });
	const rows = root && Array.isArray(root.items) ? root.items : asArray({ value: data });
	return rows
		.map((item) => {
			const row = asRecord({ value: item });
			if (!row) return "";
			const id = row.id;
			return typeof id === "string" ? id : "";
		})
		.filter((item) => item.length > 0);
};

const toChatSessions = ({
	sessionsPayload,
	runningPayload,
	previous,
}: {
	sessionsPayload: unknown;
	runningPayload: unknown;
	previous: ChatSession[];
}): ChatSession[] => {
	const runningIds = new Set(toIdList({ payload: runningPayload }));
	const data = unwrapGatewayData({ payload: sessionsPayload });
	const root = asRecord({ value: data });
	const rows = root && Array.isArray(root.items) ? root.items : asArray({ value: data });
	return rows
		.map((item) => {
			const row = asRecord({ value: item });
			if (!row || typeof row.id !== "string") return null;
			const old = previous.find((p) => p.id === row.id);
			const rawName = typeof row.name === "string" ? row.name : row.id;
			const title = runningIds.has(row.id) ? `${rawName} · 运行中` : rawName;
			const createdAt = typeof row.createdAt === "string" ? row.createdAt : nowIso();
			const updatedAt = typeof row.updatedAt === "string" ? row.updatedAt : nowIso();
			return {
				id: row.id,
				title,
				messages: old?.messages ?? [],
				createdAt,
				updatedAt,
			} as ChatSession;
		})
		.filter((item): item is ChatSession => Boolean(item));
};

const requestGateway = async ({
	agentId,
	path,
	method,
	body,
	query,
	signal,
}: {
	agentId: string;
	path: string;
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	body?: unknown;
	query?: Record<string, string>;
	signal?: AbortSignal;
}): Promise<RequestResult> =>
	requestJson({
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

const extractWsChatUrl = ({ payload }: { payload: unknown }): string => {
	const root = asRecord({ value: payload });
	if (!root) return "";
	const data = asRecord({ value: root.data });
	if (!data) return "";
	const ws = asRecord({ value: data.ws });
	if (!ws) return "";
	const chatUrl = ws.chatUrl;
	return typeof chatUrl === "string" ? chatUrl : "";
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
