import { authClient } from "#/lib/auth-client";

export const useCurrentUser = () => {
	const { data: session, isPending } = authClient.useSession();

	const user = session?.user ?? null;
	const isLoggedIn = Boolean(user);
	const displayName = user?.name?.trim() || user?.email || "用户";

	const signOut = () => {
		void authClient.signOut();
	};

	return {
		isPending,
		isLoggedIn,
		user,
		displayName,
		signOut,
	};
};