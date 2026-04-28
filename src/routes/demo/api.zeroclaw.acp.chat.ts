import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { env } from "#/env";

const ZeroClawMessageSchema = z.object({
	role: z.enum(["system", "user", "assistant"]),
	content: z.string().min(1),
});

const ZeroClawChatBodySchema = z.object({
	messages: z.array(ZeroClawMessageSchema).min(1),
});

type ZeroClawAcpResponse = {
	output?: string;
	content?: string;
	message?: {
		content?: string;
	};
	data?: {
		output?: string;
		content?: string;
	};
};

const extractAcpContent = ({
	payload,
}: {
	payload: ZeroClawAcpResponse;
}): string => {
	if (typeof payload.output === "string") {
		return payload.output.trim();
	}

	if (typeof payload.content === "string") {
		return payload.content.trim();
	}

	if (typeof payload.message?.content === "string") {
		return payload.message.content.trim();
	}

	if (typeof payload.data?.output === "string") {
		return payload.data.output.trim();
	}

	if (typeof payload.data?.content === "string") {
		return payload.data.content.trim();
	}

	return "";
};

export const Route = createFileRoute("/demo/api/zeroclaw/acp/chat")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const parsed = ZeroClawChatBodySchema.safeParse(await request.json());
				if (!parsed.success) {
					console.error("[zeroclaw-chat] invalid request body", {
						details: z.treeifyError(parsed.error),
					});
					return new Response(
						JSON.stringify({
							error: "请求参数不合法",
							details: parsed.error.message,
						}),
						{
							status: 400,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				if (!env.ZEROCLAW_ACP_URL || !env.ZEROCLAW_TOKEN) {
					console.error("[zeroclaw-chat] missing env", {
						hasAcpUrl: Boolean(env.ZEROCLAW_ACP_URL),
						hasToken: Boolean(env.ZEROCLAW_TOKEN),
					});
					return new Response(
						JSON.stringify({
							error: "ZEROCLAW_ACP_URL 或 ZEROCLAW_TOKEN 未配置",
						}),
						{
							status: 500,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				const userInput =
					parsed.data.messages
						.filter((message) => message.role === "user")
						.at(-1)?.content ?? "";

				const response = await fetch(env.ZEROCLAW_ACP_URL, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${env.ZEROCLAW_TOKEN}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						input: userInput,
						messages: parsed.data.messages,
					}),
				});

				if (!response.ok) {
					const errorText = await response.text();
					console.error("[zeroclaw-chat] upstream acp request failed", {
						status: response.status,
						statusText: response.statusText,
						url: env.ZEROCLAW_ACP_URL,
						errorText,
					});
					return new Response(
						JSON.stringify({
							error: "ZeroClaw ACP 请求失败",
							details: errorText || `status=${response.status}`,
						}),
						{
							status: 502,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				const payload = (await response.json()) as ZeroClawAcpResponse;
				const content = extractAcpContent({ payload });

				return new Response(
					JSON.stringify({
						content: content || "ZeroClaw ACP 暂无返回内容",
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			},
		},
	},
});
