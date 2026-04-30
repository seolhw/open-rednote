import { createAuthClient } from "better-auth/react";

const BEARER_TOKEN_KEY = "bearer_token";

const getBearerToken = () => {
	if (typeof window === "undefined") return "";
	return localStorage.getItem(BEARER_TOKEN_KEY) || "";
};

const setBearerToken = ({ token }: { token: string }) => {
	if (typeof window === "undefined") return;
	localStorage.setItem(BEARER_TOKEN_KEY, token);
};

const clearBearerToken = () => {
	if (typeof window === "undefined") return;
	localStorage.removeItem(BEARER_TOKEN_KEY);
};

export const authClient = createAuthClient({
	fetchOptions: {
		auth: {
			type: "Bearer",
			token: () => getBearerToken(),
		},
		onSuccess: (ctx) => {
			const authToken = ctx.response.headers.get("set-auth-token");
			if (authToken) {
				setBearerToken({ token: authToken });
			}
			if (ctx.response.status === 401) {
				clearBearerToken();
			}
		},
	},
});
