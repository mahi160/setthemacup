export function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function lower(name: string | undefined): string {
	return (name ?? "").trim().toLowerCase();
}
