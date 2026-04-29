import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getPrisma } from "#/db";
import { auth } from "#/lib/auth";

const UpdateCurrentUserSchema = z
	.object({
		name: z.string().min(1).max(100).optional(),
		image: z.string().url().nullable().optional(),
	})
	.refine((data) => data.name !== undefined || data.image !== undefined, {
		message: "至少提供一个待更新字段",
	});

const jsonResponse = ({ status, data }: { status: number; data: unknown }) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});

const getSessionUser = async ({ request }: { request: Request }) => {
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session?.user) {
		return null;
	}

	return session.user;
};

export const Route = createFileRoute("/api/users/me/")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const sessionUser = await getSessionUser({ request });
				if (!sessionUser) {
					return jsonResponse({
						status: 401,
						data: { error: "未登录" },
					});
				}

				const prisma = getPrisma();
				const user = await prisma.user.findUnique({
					where: { id: sessionUser.id },
					select: {
						id: true,
						name: true,
						email: true,
						emailVerified: true,
						image: true,
						createdAt: true,
						updatedAt: true,
					},
				});

				if (!user) {
					return jsonResponse({
						status: 404,
						data: { error: "用户不存在" },
					});
				}

				return jsonResponse({
					status: 200,
					data: user,
				});
			},
			PATCH: async ({ request }) => {
				const sessionUser = await getSessionUser({ request });
				if (!sessionUser) {
					return jsonResponse({
						status: 401,
						data: { error: "未登录" },
					});
				}

				const parsed = UpdateCurrentUserSchema.safeParse(await request.json());
				if (!parsed.success) {
					return jsonResponse({
						status: 400,
						data: { error: "请求参数不合法", details: parsed.error.message },
					});
				}

				const prisma = getPrisma();
				const updated = await prisma.user.update({
					where: { id: sessionUser.id },
					data: {
						...(parsed.data.name !== undefined
							? { name: parsed.data.name }
							: {}),
						...(parsed.data.image !== undefined
							? { image: parsed.data.image }
							: {}),
					},
					select: {
						id: true,
						name: true,
						email: true,
						emailVerified: true,
						image: true,
						createdAt: true,
						updatedAt: true,
					},
				});

				return jsonResponse({
					status: 200,
					data: updated,
				});
			},
		},
	},
});
