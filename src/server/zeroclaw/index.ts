import { z } from "zod";
import { getPrisma } from "#/db";

enum HttpMethod {
	Get = "GET",
	Post = "POST",
	Put = "PUT",
	Patch = "PATCH",
	Delete = "DELETE",
}

const RuntimeComponentSchema = z.object({
	last_error: z.unknown().nullable(),
	last_ok: z.string().optional(),
	restart_count: z.number().optional(),
	status: z.string(),
	updated_at: z.string().optional(),
});

const getUrlAndToken = async (url: string) => {
	const prisma = getPrisma();
	const agent = await prisma.agent.findFirst({
		where: {
			isEnabled: true,
		},
		select: {
			id: true,
			runtimeType: true,
			baseUrl: true,
			token: true,
		},
	});

	if (!agent) {
		throw new Error("Agent not found or disabled");
	}

	const u = new URL(url, agent.baseUrl);
	return {
		url: u.toString(),
		token: agent.token,
	};
};

const requestZeroClaw = async ({
	path,
	method,
	needToken = true,
}: {
	path: string;
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	needToken?: boolean;
}) => {
	const { url, token } = await getUrlAndToken(path);
	const response = await fetch(url, {
		method,
		headers: {
			"Content-Type": "application/json",
			...(needToken ? { Authorization: `Bearer ${token}` } : {}),
		},
	});
	return response.json();
};

const ComponentHealthSnapshotSchema = z.object({
	components: z.record(z.string(), RuntimeComponentSchema),
	pid: z.number().optional(),
	updated_at: z.string().optional(),
	uptime_seconds: z.number().optional(),
});

const ApiHealthResponseSchema = z.object({
	health: ComponentHealthSnapshotSchema,
});

const SessionItemSchema = z.object({
	session_id: z.string(),
	created_at: z.string().optional(),
	last_activity: z.string().optional(),
	message_count: z.number().optional(),
});

const SessionListSchema = z.object({
	sessions: z.array(SessionItemSchema),
});

const ZEROCLAW_API = {
	health: {
		path: "/health",
		method: HttpMethod.Get,
		description: "检查 ZeroClaw 是否运行正常",
		responseSchema: z.object({
			paired: z.boolean(),
			require_pairing: z.boolean(),
			status: z.string(),
			runtime: z.object({
				components: z.object({
					channels: RuntimeComponentSchema,
					daemon: RuntimeComponentSchema,
					gateway: RuntimeComponentSchema,
					heartbeat: RuntimeComponentSchema,
					mqtt: RuntimeComponentSchema,
					scheduler: RuntimeComponentSchema,
				}),
				pid: z.number(),
				updated_at: z.string(),
				uptime_seconds: z.number(),
			}),
		}),
		async fetch() {
			const result = await requestZeroClaw({
				path: this.path,
				method: this.method,
				needToken: false,
			});
			return result;
		},
	},
	status: {
		path: "/api/status",
		method: HttpMethod.Get,
		description: "获取 ZeroClaw 的运行信息",
		responseSchema: z.object({
			channels: z.record(z.string(), z.boolean()),
			gateway_port: z.number(),
			health: z.object({
				components: z.object({
					channels: RuntimeComponentSchema,
					daemon: RuntimeComponentSchema,
					gateway: RuntimeComponentSchema,
					heartbeat: RuntimeComponentSchema,
					mqtt: RuntimeComponentSchema,
					scheduler: RuntimeComponentSchema,
				}),
				pid: z.number(),
				updated_at: z.string(),
				uptime_seconds: z.number(),
			}),
			locale: z.string(),
			memory_backend: z.string(),
			model: z.string(),
			paired: z.boolean(),
			provider: z.string(),
			temperature: z.number(),
			uptime_seconds: z.number(),
		}),
		async fetch() {
			const result = await requestZeroClaw({
				path: this.path,
				method: this.method,
			});
			return result;
		},
	},
	apiHealth: {
		path: "/api/health",
		method: HttpMethod.Get,
		description: "组件健康快照",
		responseSchema: ApiHealthResponseSchema,
		async fetch() {
			const result = await requestZeroClaw({
				path: this.path,
				method: this.method,
			});
			return result;
		},
	},
	sessions: {
		path: "/api/sessions",
		method: HttpMethod.Get,
		description: "会话列表",
		responseSchema: SessionListSchema,
		async fetch(): Promise<typeof this.responseSchema.parseAsync> {
			const result = await requestZeroClaw({
				path: this.path,
				method: this.method,
			});
			return result;
		},
	},
	sessionsRunning: {
		path: "/api/sessions/running",
		method: HttpMethod.Get,
		description: "运行中会话列表",
		responseSchema: SessionListSchema,
		async fetch(): Promise<typeof this.responseSchema.parseAsync> {
			const result = await requestZeroClaw({
				path: this.path,
				method: this.method,
			});
			return result;
		},
	},
	sessionById: {
		path: "/api/sessions/:id",
		method: HttpMethod.Delete,
		description: "删除会话",
		responseSchema: z.object({
			deleted: z.boolean(),
			session_id: z.string(),
		}),
		async fetch({
			sessionId,
		}: {
			sessionId: string;
		}): Promise<typeof this.responseSchema.parseAsync> {
			const path = this.path.replace(":id", encodeURIComponent(sessionId));
			const result = await requestZeroClaw({
				path: path,
				method: this.method,
			});
			return result;
		},
	},
	sessionState: {
		path: "/api/sessions/:id/state",
		method: HttpMethod.Get,
		description: "会话状态",
		responseSchema: z.object({
			session_id: z.string(),
			state: z.string(),
		}),
		async fetch({
			sessionId,
		}: {
			sessionId: string;
		}): Promise<typeof this.responseSchema.parseAsync> {
			const path = this.path.replace(":id", encodeURIComponent(sessionId));
			const result = await requestZeroClaw({
				path: path,
				method: this.method,
			});
			return result;
		},
	},
};

export { ZEROCLAW_API };
