export type FieldType = "text" | "bool" | "number" | "json";

export interface CustomField {
  key: string;
  type: FieldType;
  value: string | boolean | number | Record<string, unknown> | unknown[];
}

export function castFieldValue(
  type: FieldType,
  value: unknown,
): string | boolean | number | Record<string, unknown> | unknown[] {
  switch (type) {
    case "bool": {
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        const s = value.trim().toLowerCase();
        return s === "true" || s === "1" || s === "yes" || s === "on";
      }
      if (typeof value === "number") return value === 1;
      return Boolean(value);
    }
    case "number": {
      if (typeof value === "number" && !isNaN(value)) return value;
      const parsed = Number(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    case "json": {
      if (value !== null && typeof value === "object") return value as Record<string, unknown>;
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return {};
    }
    case "text":
    default: {
      return value == null ? "" : String(value);
    }
  }
}

export function sanitizeCustomField(input: unknown): CustomField | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;

  const rawKey = typeof raw.key === "string" ? raw.key.trim() : "";
  if (!rawKey) return null;

  // Key normalization: snake_case / alphanumeric + underscores/hyphens
  const key = rawKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!key) return null;

  const validTypes: FieldType[] = ["text", "bool", "number", "json"];
  const type: FieldType =
    typeof raw.type === "string" && validTypes.includes(raw.type as FieldType)
      ? (raw.type as FieldType)
      : "text";

  const value = castFieldValue(type, raw.value);

  return { key, type, value };
}

export function sanitizeCustomResponse(raw: unknown): CustomField[] {
  if (!Array.isArray(raw)) return [];
  const fields: CustomField[] = [];
  const seenKeys = new Set<string>();

  for (const item of raw) {
    const sanitized = sanitizeCustomField(item);
    if (sanitized && !seenKeys.has(sanitized.key)) {
      seenKeys.add(sanitized.key);
      fields.push(sanitized);
    }
  }

  return fields;
}

export function formatCustomResponseData(
  fields: CustomField[],
): Record<string, string | boolean | number | Record<string, unknown> | unknown[]> {
  const result: Record<
    string,
    string | boolean | number | Record<string, unknown> | unknown[]
  > = {};

  for (const field of fields) {
    result[field.key] = field.value;
  }

  return result;
}
