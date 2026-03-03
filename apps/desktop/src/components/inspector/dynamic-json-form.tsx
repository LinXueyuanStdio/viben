import {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Minus, Code2, FormInput } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Type Definitions
// ============================================================================

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export interface JsonSchemaConst {
  const: JsonValue;
  title?: string;
  description?: string;
}

export interface JsonSchemaType {
  type?:
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "array"
    | "object"
    | "null"
    | (
        | "string"
        | "number"
        | "integer"
        | "boolean"
        | "array"
        | "object"
        | "null"
      )[];
  title?: string;
  description?: string;
  required?: string[];
  default?: JsonValue;
  properties?: Record<string, JsonSchemaType>;
  items?: JsonSchemaType;
  // Validation constraints
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minLength?: number;
  maxLength?: number;
  nullable?: boolean;
  pattern?: string;
  format?: string;
  enum?: string[];
  enumNames?: string[];
  const?: JsonValue;
  oneOf?: (JsonSchemaType | JsonSchemaConst)[];
  anyOf?: (JsonSchemaType | JsonSchemaConst)[];
  $ref?: string;
  $defs?: Record<string, JsonSchemaType>;
  definitions?: Record<string, JsonSchemaType>;
  // Example value for hints
  example?: JsonValue;
  examples?: JsonValue[];
}

export interface DynamicJsonFormRef {
  validateJson: () => { isValid: boolean; error: string | null };
  hasJsonError: () => boolean;
}

interface DynamicJsonFormProps {
  schema: JsonSchemaType;
  value: JsonValue;
  onChange: (value: JsonValue) => void;
  maxDepth?: number;
  rootSchema?: JsonSchemaType;
}

// ============================================================================
// Schema Utilities
// ============================================================================

/**
 * Resolves $ref references in JSON schema
 */
function resolveRef(
  schema: JsonSchemaType,
  rootSchema: JsonSchemaType,
  visitedRefs: Set<string> = new Set()
): JsonSchemaType {
  if (!schema) return schema;

  if (!("$ref" in schema) || !schema.$ref) {
    // Recursively resolve $ref in anyOf/oneOf
    if (schema.anyOf && Array.isArray(schema.anyOf)) {
      return {
        ...schema,
        anyOf: schema.anyOf.map((item) =>
          typeof item === "object" && item !== null
            ? resolveRef(item as JsonSchemaType, rootSchema, visitedRefs)
            : item
        ),
      };
    }
    if (schema.oneOf && Array.isArray(schema.oneOf)) {
      return {
        ...schema,
        oneOf: schema.oneOf.map((item) =>
          typeof item === "object" && item !== null
            ? resolveRef(item as JsonSchemaType, rootSchema, visitedRefs)
            : item
        ),
      };
    }
    return schema;
  }

  const ref = schema.$ref;

  if (ref.startsWith("#/")) {
    if (visitedRefs.has(ref)) {
      console.warn(`Circular reference detected: ${ref}`);
      return schema;
    }

    visitedRefs.add(ref);
    const path = ref.substring(2).split("/");
    let current: unknown = rootSchema;

    for (const segment of path) {
      if (current && typeof current === "object" && segment in current) {
        current = (current as Record<string, unknown>)[segment];
      } else {
        visitedRefs.delete(ref);
        console.warn(`Could not resolve $ref: ${ref}`);
        return schema;
      }
    }

    return resolveRef(current as JsonSchemaType, rootSchema, visitedRefs);
  }

  return schema;
}

/**
 * Normalizes union types (like string|null) to simple types for form rendering
 */
function normalizeUnionType(schema: JsonSchemaType): JsonSchemaType {
  // Handle anyOf with exactly 2 items (type and null)
  if (
    schema.anyOf &&
    schema.anyOf.length === 2 &&
    schema.anyOf.some((t) => (t as JsonSchemaType).type === "null")
  ) {
    const nonNullItem = schema.anyOf.find(
      (t) => (t as JsonSchemaType).type !== "null"
    ) as JsonSchemaType;

    if (nonNullItem?.type || nonNullItem?.enum) {
      return {
        ...schema,
        ...nonNullItem,
        type: nonNullItem.type || (nonNullItem.enum ? "string" : undefined),
        nullable: true,
        anyOf: undefined,
      };
    }
  }

  // Handle array type with null
  if (Array.isArray(schema.type) && schema.type.length === 2 && schema.type.includes("null")) {
    const nonNullType = schema.type.find((t) => t !== "null");
    if (nonNullType) {
      return { ...schema, type: nonNullType, nullable: true };
    }
  }

  return schema;
}

/**
 * Check if a property is required in the parent schema
 */
function isPropertyRequired(propertyName: string, parentSchema?: JsonSchemaType): boolean {
  return parentSchema?.required?.includes(propertyName) ?? false;
}

/**
 * Generates a default value based on JSON schema
 */
export function generateDefaultValue(
  schema: JsonSchemaType,
  propertyName?: string,
  parentSchema?: JsonSchemaType
): JsonValue {
  // Use explicit default if provided
  if ("default" in schema && schema.default !== undefined) {
    return schema.default;
  }

  // Use example as fallback
  if ("example" in schema && schema.example !== undefined) {
    return schema.example;
  }

  if (schema.examples && schema.examples.length > 0) {
    return schema.examples[0];
  }

  // For enum, use first value as default
  if (schema.enum && schema.enum.length > 0) {
    const isRequired = propertyName ? isPropertyRequired(propertyName, parentSchema) : false;
    return isRequired ? schema.enum[0] : undefined;
  }

  // Check if required
  const isRequired = propertyName ? isPropertyRequired(propertyName, parentSchema) : false;
  const isRootSchema = propertyName === undefined && parentSchema === undefined;

  // Normalize type
  const normalizedSchema = normalizeUnionType(schema);
  const type = Array.isArray(normalizedSchema.type)
    ? normalizedSchema.type[0]
    : normalizedSchema.type;

  switch (type) {
    case "string":
      return isRequired ? "" : undefined;
    case "number":
      // Use minimum if specified
      if (normalizedSchema.minimum !== undefined) {
        return normalizedSchema.minimum;
      }
      return isRequired ? 0 : undefined;
    case "integer":
      if (normalizedSchema.minimum !== undefined) {
        return Math.ceil(normalizedSchema.minimum);
      }
      return isRequired ? 0 : undefined;
    case "boolean":
      return isRequired ? false : undefined;
    case "array":
      if (normalizedSchema.minItems && normalizedSchema.minItems > 0 && normalizedSchema.items) {
        // Create array with minimum items
        const arr: JsonValue[] = [];
        for (let i = 0; i < normalizedSchema.minItems; i++) {
          arr.push(generateDefaultValue(normalizedSchema.items));
        }
        return arr;
      }
      return isRequired || isRootSchema ? [] : undefined;
    case "object": {
      if (!normalizedSchema.properties) {
        return isRequired || isRootSchema ? {} : undefined;
      }

      const obj: JsonObject = {};
      // Include required properties and properties with defaults
      Object.entries(normalizedSchema.properties).forEach(([key, prop]) => {
        const hasExplicitDefault = "default" in prop && prop.default !== undefined;
        if (isPropertyRequired(key, normalizedSchema) || hasExplicitDefault) {
          const value = generateDefaultValue(prop, key, normalizedSchema);
          if (value !== undefined) {
            obj[key] = value;
          }
        }
      });

      if (Object.keys(obj).length === 0) {
        return isRequired || isRootSchema ? {} : undefined;
      }
      return obj;
    }
    case "null":
      return null;
    default:
      return undefined;
  }
}

/**
 * Get default value for array item
 */
function getArrayItemDefault(schema: JsonSchemaType): JsonValue {
  if ("default" in schema && schema.default !== undefined) {
    return schema.default;
  }

  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

  switch (type) {
    case "string":
      return schema.enum?.[0] ?? "";
    case "number":
      return schema.minimum ?? 0;
    case "integer":
      return schema.minimum !== undefined ? Math.ceil(schema.minimum) : 0;
    case "boolean":
      return false;
    case "array":
      return [];
    case "object":
      return {};
    case "null":
      return null;
    default:
      return "";
  }
}

/**
 * Check if schema type is simple (can be rendered as basic form field)
 */
function isSimpleType(schema: JsonSchemaType): boolean {
  const simpleTypes = ["string", "number", "integer", "boolean", "null"];
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  return simpleTypes.includes(type || "");
}

/**
 * Update value at nested path
 */
export function updateValueAtPath(
  obj: JsonValue,
  path: string[],
  newValue: JsonValue
): JsonValue {
  if (path.length === 0) return newValue;

  if (obj === null || obj === undefined) {
    obj = !isNaN(Number(path[0])) ? [] : {};
  }

  const [head, ...rest] = path;

  if (Array.isArray(obj)) {
    const index = parseInt(head, 10);
    const newArray = [...obj];
    if (rest.length === 0) {
      newArray[index] = newValue;
    } else {
      newArray[index] = updateValueAtPath(obj[index], rest, newValue);
    }
    return newArray;
  }

  if (typeof obj === "object" && obj !== null) {
    return {
      ...obj,
      [head]:
        rest.length === 0
          ? newValue
          : updateValueAtPath((obj as JsonObject)[head], rest, newValue),
    };
  }

  return obj;
}

/**
 * Format field label from key
 */
function formatFieldLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

// ============================================================================
// DynamicJsonForm Component
// ============================================================================

const DynamicJsonForm = forwardRef<DynamicJsonFormRef, DynamicJsonFormProps>(
  ({ schema, value, onChange, maxDepth = 4, rootSchema }, ref) => {
    const effectiveRootSchema = rootSchema || schema;
    const [isJsonMode, setIsJsonMode] = useState(false);
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [rawJsonValue, setRawJsonValue] = useState<string>(
      JSON.stringify(value ?? generateDefaultValue(schema), null, 2)
    );
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

    // Resolve and normalize schema
    const resolvedSchema = normalizeUnionType(resolveRef(schema, effectiveRootSchema));

    // Sync raw JSON when value changes externally
    useEffect(() => {
      if (!isJsonMode) {
        setRawJsonValue(JSON.stringify(value ?? generateDefaultValue(resolvedSchema), null, 2));
      }
    }, [value, resolvedSchema, isJsonMode]);

    // Debounced JSON parsing
    const debouncedUpdateParent = useCallback(
      (jsonString: string) => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          try {
            const parsed = JSON.parse(jsonString);
            onChange(parsed);
            setJsonError(null);
          } catch (err) {
            setJsonError(err instanceof Error ? err.message : "Invalid JSON");
          }
        }, 300);
      },
      [onChange]
    );

    const validateJson = useCallback(() => {
      if (!isJsonMode) return { isValid: true, error: null };
      try {
        const parsed = JSON.parse(rawJsonValue);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        onChange(parsed);
        setJsonError(null);
        return { isValid: true, error: null };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Invalid JSON";
        setJsonError(errorMessage);
        return { isValid: false, error: errorMessage };
      }
    }, [isJsonMode, rawJsonValue, onChange]);

    const hasJsonError = useCallback(() => !!jsonError, [jsonError]);

    useImperativeHandle(ref, () => ({
      validateJson,
      hasJsonError,
    }));

    const handleFieldChange = (path: string[], fieldValue: JsonValue) => {
      if (path.length === 0) {
        onChange(fieldValue);
        return;
      }
      const newValue = updateValueAtPath(value ?? generateDefaultValue(resolvedSchema), path, fieldValue);
      onChange(newValue);
    };

    const handleSwitchMode = () => {
      if (isJsonMode) {
        try {
          const parsed = JSON.parse(rawJsonValue);
          onChange(parsed);
          setIsJsonMode(false);
          setJsonError(null);
        } catch (err) {
          setJsonError(err instanceof Error ? err.message : "Invalid JSON");
        }
      } else {
        setRawJsonValue(JSON.stringify(value ?? generateDefaultValue(resolvedSchema), null, 2));
        setIsJsonMode(true);
      }
    };

    const formatJson = () => {
      try {
        const formatted = JSON.stringify(JSON.parse(rawJsonValue), null, 2);
        setRawJsonValue(formatted);
        setJsonError(null);
      } catch (err) {
        setJsonError(err instanceof Error ? err.message : "Invalid JSON");
      }
    };

    // ========================================================================
    // Render Form Fields
    // ========================================================================

    const renderFormFields = (
      propSchema: JsonSchemaType,
      currentValue: JsonValue,
      path: string[] = [],
      depth: number = 0,
      parentSchema?: JsonSchemaType,
      propertyName?: string
    ): React.ReactNode => {
      // Resolve and normalize
      const resolved = normalizeUnionType(resolveRef(propSchema, effectiveRootSchema));

      // Fallback to JSON editor at max depth
      if (depth >= maxDepth && (resolved.type === "object" || resolved.type === "array")) {
        return (
          <Textarea
            value={JSON.stringify(currentValue ?? generateDefaultValue(resolved, propertyName, parentSchema), null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleFieldChange(path, parsed);
              } catch {
                // Allow typing
              }
            }}
            className="font-mono text-xs min-h-[80px]"
            placeholder={resolved.description}
          />
        );
      }

      const isRequired = isPropertyRequired(propertyName || "", parentSchema);
      const isNullable = resolved.nullable || false;
      let fieldType = resolved.type;
      if (Array.isArray(fieldType)) {
        fieldType = fieldType.find((t) => t !== "null") ?? fieldType[0];
      }

      // Build constraint hints
      const hints: string[] = [];
      if (resolved.minimum !== undefined) hints.push(`min: ${resolved.minimum}`);
      if (resolved.maximum !== undefined) hints.push(`max: ${resolved.maximum}`);
      if (resolved.minLength !== undefined) hints.push(`minLength: ${resolved.minLength}`);
      if (resolved.maxLength !== undefined) hints.push(`maxLength: ${resolved.maxLength}`);
      if (resolved.pattern) hints.push(`pattern: ${resolved.pattern}`);
      if (resolved.format) hints.push(`format: ${resolved.format}`);
      if (resolved.minItems !== undefined) hints.push(`minItems: ${resolved.minItems}`);
      if (resolved.maxItems !== undefined) hints.push(`maxItems: ${resolved.maxItems}`);

      switch (fieldType) {
        case "string": {
          // Check for oneOf/anyOf with const values (titled options)
          const titledOptions = (
            (resolved.oneOf ?? resolved.anyOf) as (JsonSchemaType | JsonSchemaConst)[] | undefined
          )?.filter((opt): opt is JsonSchemaConst => "const" in opt);

          if (titledOptions && titledOptions.length > 0) {
            return (
              <div className="space-y-1">
                {hints.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">{hints.join(", ")}</p>
                )}
                <Select
                  value={(currentValue as string) ?? ""}
                  onValueChange={(val) => handleFieldChange(path, val || (isNullable ? null : ""))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={resolved.description || "Select..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {isNullable && (
                      <SelectItem value="__null__">
                        <span className="text-muted-foreground italic">null</span>
                      </SelectItem>
                    )}
                    {titledOptions.map((opt) => (
                      <SelectItem key={String(opt.const)} value={String(opt.const)}>
                        {opt.title ?? String(opt.const)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          }

          // Check for enum
          if (resolved.enum && resolved.enum.length > 0) {
            const names = resolved.enumNames;
            return (
              <div className="space-y-1">
                {hints.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">{hints.join(", ")}</p>
                )}
                <Select
                  value={(currentValue as string) ?? ""}
                  onValueChange={(val) => {
                    if (val === "__null__") {
                      handleFieldChange(path, null);
                    } else {
                      handleFieldChange(path, val || "");
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={resolved.description || "Select..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {isNullable && (
                      <SelectItem value="__null__">
                        <span className="text-muted-foreground italic">null</span>
                      </SelectItem>
                    )}
                    {resolved.enum.map((opt, idx) => (
                      <SelectItem key={opt} value={opt}>
                        {names?.[idx] ?? opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          }

          // Determine input type based on format
          let inputType = "text";
          switch (resolved.format) {
            case "email":
              inputType = "email";
              break;
            case "uri":
            case "url":
              inputType = "url";
              break;
            case "date":
              inputType = "date";
              break;
            case "date-time":
              inputType = "datetime-local";
              break;
            case "time":
              inputType = "time";
              break;
            case "password":
              inputType = "password";
              break;
          }

          // Use textarea for longer strings
          const useTextarea = !resolved.format && (!resolved.maxLength || resolved.maxLength > 100);

          return (
            <div className="space-y-1">
              {isNullable && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={currentValue === null}
                    onCheckedChange={(checked) =>
                      handleFieldChange(path, checked ? null : "")
                    }
                  />
                  <span className="text-xs text-muted-foreground">null</span>
                </div>
              )}
              {hints.length > 0 && (
                <p className="text-[10px] text-muted-foreground">{hints.join(", ")}</p>
              )}
              {useTextarea ? (
                <Textarea
                  value={currentValue === null ? "" : (currentValue as string) ?? ""}
                  onChange={(e) => handleFieldChange(path, e.target.value)}
                  placeholder={resolved.description || resolved.example?.toString()}
                  disabled={currentValue === null}
                  className={cn("min-h-[60px]", currentValue === null && "opacity-50")}
                  minLength={resolved.minLength}
                  maxLength={resolved.maxLength}
                />
              ) : (
                <Input
                  type={inputType}
                  value={currentValue === null ? "" : (currentValue as string) ?? ""}
                  onChange={(e) => handleFieldChange(path, e.target.value)}
                  placeholder={resolved.description || resolved.example?.toString()}
                  disabled={currentValue === null}
                  className={cn(currentValue === null && "opacity-50")}
                  minLength={resolved.minLength}
                  maxLength={resolved.maxLength}
                  pattern={resolved.pattern}
                  required={isRequired}
                />
              )}
            </div>
          );
        }

        case "number":
        case "integer": {
          const step = fieldType === "integer" ? 1 : "any";
          const min = resolved.minimum ?? resolved.exclusiveMinimum;
          const max = resolved.maximum ?? resolved.exclusiveMaximum;

          return (
            <div className="space-y-1">
              {isNullable && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={currentValue === null}
                    onCheckedChange={(checked) =>
                      handleFieldChange(path, checked ? null : (min ?? 0))
                    }
                  />
                  <span className="text-xs text-muted-foreground">null</span>
                </div>
              )}
              {hints.length > 0 && (
                <p className="text-[10px] text-muted-foreground">{hints.join(", ")}</p>
              )}
              <Input
                type="number"
                step={step}
                value={currentValue === null ? "" : (currentValue as number)?.toString() ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    handleFieldChange(path, isNullable ? null : (min ?? 0));
                  } else {
                    const num = fieldType === "integer" ? parseInt(val, 10) : parseFloat(val);
                    if (!isNaN(num)) {
                      handleFieldChange(path, num);
                    }
                  }
                }}
                placeholder={resolved.description || resolved.example?.toString()}
                disabled={currentValue === null}
                className={cn(currentValue === null && "opacity-50")}
                min={min}
                max={max}
                required={isRequired}
              />
            </div>
          );
        }

        case "boolean":
          return (
            <div className="space-y-1">
              {isNullable && (
                <div className="flex items-center gap-2 mb-1">
                  <Checkbox
                    checked={currentValue === null}
                    onCheckedChange={(checked) =>
                      handleFieldChange(path, checked ? null : false)
                    }
                  />
                  <span className="text-xs text-muted-foreground">null</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={currentValue === null ? false : (currentValue as boolean) ?? false}
                  onCheckedChange={(checked) => handleFieldChange(path, !!checked)}
                  disabled={currentValue === null}
                />
                <span className={cn("text-sm", currentValue === null && "opacity-50")}>
                  {resolved.description || (currentValue ? "true" : "false")}
                </span>
              </div>
            </div>
          );

        case "null":
          return <span className="text-xs text-muted-foreground italic">null</span>;

        case "object": {
          if (!resolved.properties || Object.keys(resolved.properties).length === 0) {
            return (
              <Textarea
                value={JSON.stringify(currentValue ?? {}, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    handleFieldChange(path, parsed);
                  } catch {
                    // Allow typing
                  }
                }}
                className="font-mono text-xs min-h-[80px]"
                placeholder={resolved.description || "{}"}
              />
            );
          }

          return (
            <div className="space-y-3 border rounded-md p-3 bg-muted/20">
              {Object.entries(resolved.properties).map(([key, subSchema]) => {
                const subRequired = isPropertyRequired(key, resolved);
                const resolvedSub = normalizeUnionType(resolveRef(subSchema, effectiveRootSchema));
                return (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs font-medium flex items-center gap-1">
                      {resolvedSub.title ?? formatFieldLabel(key)}
                      {subRequired && <span className="text-red-500">*</span>}
                      {resolvedSub.nullable && (
                        <span className="text-muted-foreground text-[10px]">(nullable)</span>
                      )}
                    </Label>
                    {resolvedSub.description && (
                      <p className="text-[10px] text-muted-foreground">{resolvedSub.description}</p>
                    )}
                    {renderFormFields(
                      subSchema,
                      (currentValue as JsonObject)?.[key],
                      [...path, key],
                      depth + 1,
                      resolved,
                      key
                    )}
                  </div>
                );
              })}
            </div>
          );
        }

        case "array": {
          const arrayValue = Array.isArray(currentValue) ? currentValue : [];
          const itemSchema = resolved.items;

          if (!itemSchema) {
            return (
              <Textarea
                value={JSON.stringify(currentValue ?? [], null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    handleFieldChange(path, parsed);
                  } catch {
                    // Allow typing
                  }
                }}
                className="font-mono text-xs min-h-[80px]"
                placeholder={resolved.description || "[]"}
              />
            );
          }

          const resolvedItem = normalizeUnionType(resolveRef(itemSchema, effectiveRootSchema));

          // Check for enum items (multi-select)
          const titledMulti = (
            (resolvedItem.anyOf ?? resolvedItem.oneOf) as (JsonSchemaType | JsonSchemaConst)[] | undefined
          )?.filter((opt): opt is JsonSchemaConst => "const" in opt);

          if (titledMulti && titledMulti.length > 0) {
            return (
              <div className="space-y-1">
                {hints.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">{hints.join(", ")}</p>
                )}
                <select
                  multiple
                  size={Math.min(Math.max(titledMulti.length, 3), 8)}
                  value={arrayValue as string[]}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                    handleFieldChange(path, selected);
                  }}
                  className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                >
                  {titledMulti.map((opt) => (
                    <option key={String(opt.const)} value={String(opt.const)}>
                      {opt.title ?? String(opt.const)}
                    </option>
                  ))}
                </select>
              </div>
            );
          }

          if (resolvedItem.enum && resolvedItem.enum.length > 0) {
            const names = resolvedItem.enumNames;
            return (
              <div className="space-y-1">
                {hints.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">{hints.join(", ")}</p>
                )}
                <select
                  multiple
                  size={Math.min(Math.max(resolvedItem.enum.length, 3), 8)}
                  value={arrayValue as string[]}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                    handleFieldChange(path, selected);
                  }}
                  className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                >
                  {resolvedItem.enum.map((opt, idx) => (
                    <option key={opt} value={opt}>
                      {names?.[idx] ?? opt}
                    </option>
                  ))}
                </select>
              </div>
            );
          }

          // Check constraints
          const canRemove = resolved.minItems === undefined || arrayValue.length > resolved.minItems;
          const canAdd = resolved.maxItems === undefined || arrayValue.length < resolved.maxItems;

          // For simple items, render as list
          if (isSimpleType(resolvedItem)) {
            return (
              <div className="space-y-2">
                {hints.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">{hints.join(", ")}</p>
                )}
                {arrayValue.map((item, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="flex-1">
                      {renderFormFields(itemSchema, item, [...path, index.toString()], depth + 1)}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 shrink-0"
                      onClick={() => {
                        const newArray = [...arrayValue];
                        newArray.splice(index, 1);
                        handleFieldChange(path, newArray);
                      }}
                      disabled={!canRemove}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const defaultItem = getArrayItemDefault(resolvedItem);
                    handleFieldChange(path, [...arrayValue, defaultItem]);
                  }}
                  disabled={!canAdd}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                  {resolved.maxItems !== undefined && (
                    <span className="ml-1 text-muted-foreground">
                      ({arrayValue.length}/{resolved.maxItems})
                    </span>
                  )}
                </Button>
              </div>
            );
          }

          // For complex items
          return (
            <div className="space-y-2">
              {hints.length > 0 && (
                <p className="text-[10px] text-muted-foreground">{hints.join(", ")}</p>
              )}
              {arrayValue.map((item, index) => (
                <div key={index} className="border rounded-md p-2 bg-muted/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Item {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        const newArray = [...arrayValue];
                        newArray.splice(index, 1);
                        handleFieldChange(path, newArray);
                      }}
                      disabled={!canRemove}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                  </div>
                  {renderFormFields(itemSchema, item, [...path, index.toString()], depth + 1)}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const defaultItem = generateDefaultValue(resolvedItem);
                  handleFieldChange(path, [...arrayValue, defaultItem ?? {}]);
                }}
                disabled={!canAdd}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Item
                {resolved.maxItems !== undefined && (
                  <span className="ml-1 text-muted-foreground">
                    ({arrayValue.length}/{resolved.maxItems})
                  </span>
                )}
              </Button>
            </div>
          );
        }

        default:
          return (
            <Textarea
              value={JSON.stringify(currentValue, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleFieldChange(path, parsed);
                } catch {
                  // Allow typing
                }
              }}
              className="font-mono text-xs min-h-[60px]"
            />
          );
      }
    };

    // Check if we should force JSON mode
    const shouldForceJsonMode =
      resolvedSchema.type === "object" &&
      (!resolvedSchema.properties || Object.keys(resolvedSchema.properties).length === 0);

    useEffect(() => {
      if (shouldForceJsonMode && !isJsonMode) {
        setIsJsonMode(true);
      }
    }, [shouldForceJsonMode, isJsonMode]);

    return (
      <div className="space-y-2">
        {/* Mode toggle - only show if not forced JSON mode */}
        {!shouldForceJsonMode && (
          <div className="flex justify-end gap-2">
            {isJsonMode && (
              <Button type="button" variant="ghost" size="sm" onClick={formatJson} className="h-6 text-xs">
                Format
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={handleSwitchMode} className="h-6 text-xs">
              {isJsonMode ? (
                <>
                  <FormInput className="h-3 w-3 mr-1" />
                  Form
                </>
              ) : (
                <>
                  <Code2 className="h-3 w-3 mr-1" />
                  JSON
                </>
              )}
            </Button>
          </div>
        )}

        {/* Form or JSON editor */}
        {isJsonMode ? (
          <div className="space-y-1">
            <Textarea
              value={rawJsonValue}
              onChange={(e) => {
                setRawJsonValue(e.target.value);
                debouncedUpdateParent(e.target.value);
              }}
              className={cn(
                "font-mono text-xs min-h-[120px]",
                jsonError && "border-red-500"
              )}
              spellCheck={false}
              placeholder={resolvedSchema.description}
            />
            {jsonError && <p className="text-xs text-red-500">{jsonError}</p>}
          </div>
        ) : (
          renderFormFields(resolvedSchema, value)
        )}
      </div>
    );
  }
);

DynamicJsonForm.displayName = "DynamicJsonForm";

export default DynamicJsonForm;
