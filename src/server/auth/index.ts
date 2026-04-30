import { auth } from "#/lib/auth";

export const getSessionUser = async ({ request }: { request: Request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	return session?.user ?? null;
};
