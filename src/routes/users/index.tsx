import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getPrisma } from "#/db";
import { auth } from "#/lib/auth";
import { jsonResponse } from "#/server";
import { getSessionUser } from "#/server/auth";

const UsersQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const Route = createFileRoute("/users/")({
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

				const url = new URL(request.url);
				const parsed = UsersQuerySchema.safeParse({
					page: url.searchParams.get("page") ?? undefined,
					pageSize: url.searchParams.get("pageSize") ?? undefined,
				});

				if (!parsed.success) {
					return jsonResponse({
						status: 400,
						data: { error: "查询参数不合法", details: parsed.error.message },
					});
				}

				const prisma = getPrisma();
				const skip = (parsed.data.page - 1) * parsed.data.pageSize;

				const [total, items] = await Promise.all([
					prisma.user.count(),
					prisma.user.findMany({
						skip,
						take: parsed.data.pageSize,
						orderBy: { createdAt: "desc" },
						select: {
							id: true,
							name: true,
							email: true,
							emailVerified: true,
							image: true,
							createdAt: true,
							updatedAt: true,
						},
					}),
				]);

				return jsonResponse({
					status: 200,
					data: {
						items,
						pagination: {
							page: parsed.data.page,
							pageSize: parsed.data.pageSize,
							total,
						},
					},
				});
			},
		},
	},
});
