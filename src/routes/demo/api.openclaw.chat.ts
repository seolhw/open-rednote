import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { env } from "#/env";

const OpenClawMessageSchema = z.object({
	role: z.enum(["system", "user", "assistant"]),
	content: z.string().min(1),
});

const OpenClawChatBodySchema = z.object({
	messages: z.array(OpenClawMessageSchema).min(1),
});

type OpenClawChatResponse = {
	choices?: Array<{
		message?: {
			content?:
				| string
				| Array<{
						type?: string;
						text?: string;
				  }>;
		};
	}>;
};

const normalizeBaseUrl = ({ baseUrl }: { baseUrl: string }) =>
	baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

const extractAssistantContent = ({
	payload,
}: {
	payload: OpenClawChatResponse;
}): string => {
	const content = payload.choices?.[0]?.message?.content;

	if (typeof content === "string") {
		return content;
	}

	if (Array.isArray(content)) {
		return content
			.map((item) => (item.type === "text" ? (item.text ?? "") : ""))
			.join("")
			.trim();
	}

	return "";
};

export const Route = createFileRoute("/demo/api/openclaw/chat")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const parsed = OpenClawChatBodySchema.safeParse(await request.json());
				if (!parsed.success) {
					console.error("[openclaw-chat] invalid request body", {
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

				if (!env.OPENCLAW_BASE_URL || !env.OPENCLAW_TOKEN) {
					console.error("[openclaw-chat] missing env", {
						hasBaseUrl: Boolean(env.OPENCLAW_BASE_URL),
						hasToken: Boolean(env.OPENCLAW_TOKEN),
						model: env.OPENCLAW_MODEL ?? "gpt-4o-mini",
					});
					return new Response(
						JSON.stringify({
							error: "OPENCLAW_BASE_URL 或 OPENCLAW_TOKEN 未配置",
						}),
						{
							status: 500,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				const openclawUrl = `${normalizeBaseUrl({ baseUrl: env.OPENCLAW_BASE_URL })}/v1/chat/completions`;
				const response = await fetch(openclawUrl, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${env.OPENCLAW_TOKEN}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: env.OPENCLAW_MODEL ?? "gpt-4o-mini",
						messages: parsed.data.messages,
						stream: false,
					}),
				});

				if (!response.ok) {
					const errorText = await response.text();
					console.error("[openclaw-chat] upstream request failed", {
						status: response.status,
						statusText: response.statusText,
						url: openclawUrl,
						model: env.OPENCLAW_MODEL ?? "gpt-4o-mini",
						errorText,
					});
					return new Response(
						JSON.stringify({
							error: "OpenClaw 请求失败",
							details: errorText || `status=${response.status}`,
						}),
						{
							status: 502,
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				const payload = (await response.json()) as OpenClawChatResponse;
				const content = extractAssistantContent({ payload });

				return new Response(
					JSON.stringify({
						content: content || "OpenClaw 暂无返回内容",
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
