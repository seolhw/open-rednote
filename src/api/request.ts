export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

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
	const response = await fetch(url, {
		method,
		headers: { "Content-Type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
		signal,
	});
	const data = (await parseResponseData({ response })) as TData | null;
	return data;
};
