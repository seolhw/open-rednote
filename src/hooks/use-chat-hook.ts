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

const getTextPart = ({ message }: { message: ChatMessage }): string => {
	const textPart = message.parts.find((part) => part.type === "text");
	if (!textPart || textPart.type !== "text") {
		return "";
	}
	return textPart.content;
};

const toConversationText = ({ messages }: { messages: ChatMessages }): string =>
	messages
		.map((item) => `${item.role}: ${getTextPart({ message: item })}`)
		.filter((item) => item.length > 0)
		.join("\n");

const extractAssistantContent = ({ payload }: { payload: unknown }): string => {
	if (!payload || typeof payload !== "object") {
		return "";
	}
	const dataField = (payload as { data?: unknown }).data;

	if (typeof dataField === "string") {
		return dataField;
	}
	if (!dataField || typeof dataField !== "object") {
		return "";
	}

	const responseText = (dataField as { response?: unknown }).response;
	if (typeof responseText === "string") {
		return responseText;
	}

	const contentText = (dataField as { content?: unknown }).content;
	if (typeof contentText === "string") {
		return contentText;
	}

	const messageContent = (dataField as { message?: { content?: unknown } })
		.message?.content;
	if (typeof messageContent === "string") {
		return messageContent;
	}

	return "";
};

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

export const useChatHook = () => {
	const [sessions, setSessions] = useState<ChatSession[]>([]);
	const [selectedSessionId, setSelectedSessionId] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const abortRef = useRef<AbortController | null>(null);
	const preferredAgentIdRef = useRef<string | null>(null);

	const selectedSession =
		sessions.find((item) => item.id === selectedSessionId) ?? sessions[0];
	const messages = selectedSession?.messages ?? [];

	const refreshSessions = async ({ signal }: { signal?: AbortSignal }) => {
		const agentId = await resolveAgentId({ signal });
		if (!agentId) return;
		const [listResult, runningResult] = await Promise.all([
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
		if (!listResult.ok) return;
		const next = toChatSessions({
			sessionsPayload: listResult.data,
			runningPayload: runningResult.ok ? runningResult.data : null,
			previous: sessions,
		});
		setSessions(next);
		if (!selectedSessionId && next[0]) setSelectedSessionId(next[0].id);
		if (
			selectedSessionId &&
			!next.find((item) => item.id === selectedSessionId) &&
			next[0]
		) {
			setSelectedSessionId(next[0].id);
		}
	};

	const createSession = () => {
		void refreshSessions({});
	};

	const selectSession = ({ sessionId }: { sessionId: string }) => {
		setSelectedSessionId(sessionId);
		void loadSessionState({ sessionId });
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

	const sendMessage = async (input: string) => {
		const content = input.trim();
		if (!content || !selectedSession || !selectedSession.id) return;
		const userMessage: ChatMessage = {
			id: crypto.randomUUID(),
			role: "user",
			parts: [{ type: "text", content }],
		};
		const baseMessages = selectedSession.messages;
		const nextMessages = [...baseMessages, userMessage];
		setSessions((prev) =>
			appendMessageToSession({
				sessions: prev,
				sessionId: selectedSession.id,
				message: userMessage,
			}),
		);
		setIsLoading(true);
		const controller = new AbortController();
		abortRef.current = controller;

		const agentId = await resolveAgentId({ signal: controller.signal });
		if (!agentId) {
			const errorMessage: ChatMessage = {
				id: crypto.randomUUID(),
				role: "assistant",
				parts: [{ type: "text", content: "没有可用的已启用 Agent" }],
			};
			setSessions((prev) =>
				appendMessageToSession({
					sessions: prev,
					sessionId: selectedSession.id,
					message: errorMessage,
				}),
			);
			setIsLoading(false);
			abortRef.current = null;
			return;
		}

		const result = await requestGateway({
			agentId,
			path: "/webhook",
			method: "POST",
			body: {
				message: content,
				session_id: selectedSession.id,
				context: toConversationText({ messages: nextMessages }),
			},
			signal: controller.signal,
		});

		if (!result.ok) {
			const errorMessage: ChatMessage = {
				id: crypto.randomUUID(),
				role: "assistant",
				parts: [{ type: "text", content: `Agent 请求失败(${result.status})` }],
			};
			setSessions((prev) =>
				appendMessageToSession({
					sessions: prev,
					sessionId: selectedSession.id,
					message: errorMessage,
				}),
			);
			setIsLoading(false);
			abortRef.current = null;
			return;
		}

		const assistantText =
			extractAssistantContent({ payload: result.data }) || "Agent 暂无返回内容";
		const assistantMessage: ChatMessage = {
			id: crypto.randomUUID(),
			role: "assistant",
			parts: [{ type: "text", content: assistantText }],
		};
		setSessions((prev) =>
			appendMessageToSession({
				sessions: prev,
				sessionId: selectedSession.id,
				message: assistantMessage,
			}),
		);
		setIsLoading(false);
		abortRef.current = null;
	};

	const loadSessionState = async ({ sessionId }: { sessionId: string }) => {
		const agentId = await resolveAgentId({});
		if (!agentId || !sessionId) return;
		const stateResult = await requestGateway({
			agentId,
			path: `/api/sessions/${encodeURIComponent(sessionId)}/state`,
			method: "GET",
		});
		if (!stateResult.ok) return;
		const stateMessages = toStateMessages({ payload: stateResult.data });
		if (!stateMessages.length) return;
		setSessions((prev) =>
			prev.map((item) =>
				item.id === sessionId
					? { ...item, messages: stateMessages, updatedAt: nowIso() }
					: item,
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

const toIdList = ({ payload }: { payload: unknown }): string[] =>
	asArray({ value: unwrapGatewayData({ payload }) })
		.map((item) => {
			const row = asRecord({ value: item });
			if (!row) return "";
			const id = row.id;
			return typeof id === "string" ? id : "";
		})
		.filter((item) => item.length > 0);

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
	const rows = asArray({
		value: unwrapGatewayData({ payload: sessionsPayload }),
	});
	return rows
		.map((item) => {
			const row = asRecord({ value: item });
			if (!row || typeof row.id !== "string") return null;
			const old = previous.find((p) => p.id === row.id);
			const titleRaw = typeof row.name === "string" ? row.name : row.id;
			const title = runningIds.has(row.id) ? `${titleRaw} · 运行中` : titleRaw;
			const createdAt =
				typeof row.createdAt === "string" ? row.createdAt : nowIso();
			const updatedAt =
				typeof row.updatedAt === "string" ? row.updatedAt : nowIso();
			return {
				id: row.id,
				title,
				createdAt,
				updatedAt,
				messages: old?.messages ?? [],
			} as ChatSession;
		})
		.filter((item): item is ChatSession => Boolean(item));
};

const toStateMessages = ({ payload }: { payload: unknown }): ChatMessages => {
	const data = unwrapGatewayData({ payload });
	const record = asRecord({ value: data });
	if (!record) return [];
	const messagesRaw = "messages" in record ? record.messages : [];
	const rows = asArray({ value: messagesRaw });
	return rows
		.map((item) => {
			const row = asRecord({ value: item });
			if (!row) return null;
			const id = typeof row.id === "string" ? row.id : crypto.randomUUID();
			const role = row.role;
			const content = typeof row.content === "string" ? row.content : "";
			if (
				(role !== "user" && role !== "assistant" && role !== "system") ||
				!content
			)
				return null;
			return { id, role, parts: [{ type: "text", content }] } as ChatMessage;
		})
		.filter((item): item is ChatMessage => Boolean(item));
};

const requestGateway = async ({
	agentId,
	path,
	method,
	body,
	signal,
}: {
	agentId: string;
	path: string;
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	body?: unknown;
	signal?: AbortSignal;
}): Promise<RequestResult> =>
	requestJson({
		url: `/api/agents/${agentId}/gateway/request`,
		method: "POST",
		body: {
			method,
			path,
			body,
			contentType: "application/json",
		},
		signal,
	});
