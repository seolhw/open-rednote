import { useRef, useState } from "react";

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

export const useChatHook = () => {
	const [messages, setMessages] = useState<ChatMessages>([]);
	const [isLoading, setIsLoading] = useState(false);
	const abortRef = useRef<AbortController | null>(null);
	const preferredAgentIdRef = useRef<string | null>(null);

	const resolveAgentId = async ({
		signal,
	}: {
		signal?: AbortSignal;
	}): Promise<string | null> => {
		if (preferredAgentIdRef.current) {
			return preferredAgentIdRef.current;
		}

		const listResult = await requestJson({
			url: "/api/agents",
			method: "GET",
			signal,
		});
		if (!listResult.ok) {
			return null;
		}

		const payload = listResult.data as AgentListResponse;
		const enabled = (payload.items ?? []).filter((item) => item.isEnabled);
		const target = enabled[0];
		if (!target) {
			return null;
		}

		preferredAgentIdRef.current = target.id;
		return target.id;
	};

	const sendMessage = async (input: string) => {
		const content = input.trim();
		if (!content) {
			return;
		}

		const userMessage: ChatMessage = {
			id: crypto.randomUUID(),
			role: "user",
			parts: [{ type: "text", content }],
		};

		const nextMessages = [...messages, userMessage];
		setMessages((prev) => [...prev, userMessage]);
		setIsLoading(true);

		const controller = new AbortController();
		abortRef.current = controller;

		const agentId = await resolveAgentId({ signal: controller.signal });
		if (!agentId) {
			setMessages((prev) => [
				...prev,
				{
					id: crypto.randomUUID(),
					role: "assistant",
					parts: [{ type: "text", content: "没有可用的已启用 Agent" }],
				},
			]);
			setIsLoading(false);
			abortRef.current = null;
			return;
		}

		const result = await requestJson({
			url: `/api/agents/${agentId}/gateway/request`,
			method: "POST",
			body: {
				method: "POST",
				path: "/webhook",
				body: {
					message: content,
					context: toConversationText({ messages: nextMessages }),
				},
				contentType: "application/json",
			},
			signal: controller.signal,
		});

		if (!result.ok) {
			setMessages((prev) => [
				...prev,
				{
					id: crypto.randomUUID(),
					role: "assistant",
					parts: [
						{ type: "text", content: `Agent 请求失败(${result.status})` },
					],
				},
			]);
			setIsLoading(false);
			abortRef.current = null;
			return;
		}

		const assistantText =
			extractAssistantContent({ payload: result.data }) || "Agent 暂无返回内容";
		setMessages((prev) => [
			...prev,
			{
				id: crypto.randomUUID(),
				role: "assistant",
				parts: [{ type: "text", content: assistantText }],
			},
		]);

		setIsLoading(false);
		abortRef.current = null;
	};

	const stop = () => {
		if (abortRef.current) {
			abortRef.current.abort();
			abortRef.current = null;
		}
		setIsLoading(false);
	};

	return { messages, sendMessage, isLoading, stop };
};
