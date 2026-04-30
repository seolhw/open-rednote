export const jsonResponse = ({
	status,
	data,
}: {
	status?: number;
	data: unknown;
}) =>
	new Response(JSON.stringify(data), {
		status: status ?? 200,
		headers: { "Content-Type": "application/json" },
	});
