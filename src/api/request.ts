export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const BEARER_TOKEN_KEY = "bearer_token";

const getBearerToken = () => {
	return localStorage.getItem(BEARER_TOKEN_KEY) || "";
};

const parseResponseData = async ({
	response,
}: {
	response: Response;
}): Promise<unknown> => {
	const contentType = response.headers.get("content-type") ?? "";
	const raw = await response.text();
	if (!raw) return null;
	if (contentType.includes("application/json")) {
		return JSON.parse(raw);
	}
	return raw;
};

export const request = async <TData>({
	url,
	method = "GET",
	body,
	signal,
}: {
	url: string;
	method?: HttpMethod;
	body?: unknown;
	signal?: AbortSignal;
}): Promise<TData | null> => {
	const token = getBearerToken();
	const response = await fetch(url, {
		method,
		headers: {
			"Content-Type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
		signal,
	});

	if (response.status === 401 && typeof window !== "undefined") {
		localStorage.removeItem(BEARER_TOKEN_KEY);
	}

	const data = (await parseResponseData({ response })) as TData | null;
	return data;
};
