import { test, expect, describe } from "bun:test"
import { MCP } from "../../src/mcp/index"
import type { JSONSchema7 } from "ai"

const anchorPatterns = MCP.anchorPatterns

describe("anchorPatterns", () => {
  test("adds anchors to unanchored pattern", () => {
    const schema: JSONSchema7 = { type: "string", pattern: "[a-z]+" }
    const result = anchorPatterns(schema)
    expect(result.pattern).toBe("^[a-z]+$")
  })

  test("leaves already-anchored pattern unchanged", () => {
    const schema: JSONSchema7 = { type: "string", pattern: "^[a-z]+$" }
    const result = anchorPatterns(schema)
    expect(result.pattern).toBe("^[a-z]+$")
  })

  test("adds only missing anchor", () => {
    expect(anchorPatterns({ pattern: "^foo" } as JSONSchema7).pattern).toBe("^foo$")
    expect(anchorPatterns({ pattern: "foo$" } as JSONSchema7).pattern).toBe("^foo$")
  })

  test("handles escaped \\$ (literal dollar) — should add anchor", () => {
    const schema: JSONSchema7 = { pattern: "price\\$" }
    const result = anchorPatterns(schema)
    expect(result.pattern).toBe("^price\\$$")
  })

  test("handles \\\\$ (escaped backslash + real anchor) — should not add anchor", () => {
    const schema: JSONSchema7 = { pattern: "foo\\\\$" }
    const result = anchorPatterns(schema)
    expect(result.pattern).toBe("^foo\\\\$")
  })

  test("returns non-object schema as-is", () => {
    expect(anchorPatterns(null as any)).toBeNull()
    expect(anchorPatterns(undefined as any)).toBeUndefined()
  })

  test("recurses into properties", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        name: { type: "string", pattern: "[a-z]+" },
      },
    }
    const result = anchorPatterns(schema)
    expect((result.properties!.name as JSONSchema7).pattern).toBe("^[a-z]+$")
  })

  test("recurses into items (single schema)", () => {
    const schema: JSONSchema7 = {
      type: "array",
      items: { type: "string", pattern: "\\d+" },
    }
    const result = anchorPatterns(schema)
    expect((result.items as JSONSchema7).pattern).toBe("^\\d+$")
  })

  test("recurses into items (tuple array)", () => {
    const schema: JSONSchema7 = {
      type: "array",
      items: [{ type: "string", pattern: "[a-z]+" }],
    }
    const result = anchorPatterns(schema)
    expect((result.items as JSONSchema7[])[0].pattern).toBe("^[a-z]+$")
  })

  test("recurses into additionalProperties", () => {
    const schema: JSONSchema7 = {
      type: "object",
      additionalProperties: { type: "string", pattern: "[0-9]+" },
    }
    const result = anchorPatterns(schema)
    expect((result.additionalProperties as JSONSchema7).pattern).toBe("^[0-9]+$")
  })

  test("recurses into anyOf/oneOf/allOf", () => {
    const schema: JSONSchema7 = {
      anyOf: [{ pattern: "a+" }],
      oneOf: [{ pattern: "b+" }],
      allOf: [{ pattern: "c+" }],
    }
    const result = anchorPatterns(schema)
    expect((result.anyOf![0] as JSONSchema7).pattern).toBe("^a+$")
    expect((result.oneOf![0] as JSONSchema7).pattern).toBe("^b+$")
    expect((result.allOf![0] as JSONSchema7).pattern).toBe("^c+$")
  })

  test("recurses into not", () => {
    const schema: JSONSchema7 = {
      not: { pattern: "bad" },
    }
    const result = anchorPatterns(schema)
    expect((result.not as JSONSchema7).pattern).toBe("^bad$")
  })

  test("recurses into if/then/else", () => {
    const schema: any = {
      if: { pattern: "a" },
      then: { pattern: "b" },
      else: { pattern: "c" },
    }
    const result = anchorPatterns(schema) as any
    expect(result.if.pattern).toBe("^a$")
    expect(result.then.pattern).toBe("^b$")
    expect(result.else.pattern).toBe("^c$")
  })

  test("recurses into definitions/$defs", () => {
    const schema: any = {
      definitions: { foo: { pattern: "x+" } },
      $defs: { bar: { pattern: "y+" } },
    }
    const result = anchorPatterns(schema) as any
    expect(result.definitions.foo.pattern).toBe("^x+$")
    expect(result.$defs.bar.pattern).toBe("^y+$")
  })

  test("recurses into patternProperties", () => {
    const schema: JSONSchema7 = {
      patternProperties: {
        "^S_": { type: "string", pattern: "[a-z]+" },
      },
    }
    const result = anchorPatterns(schema)
    expect((result.patternProperties!["^S_"] as JSONSchema7).pattern).toBe("^[a-z]+$")
  })

  test("recurses into contains", () => {
    const schema: JSONSchema7 = {
      contains: { pattern: "item" },
    }
    const result = anchorPatterns(schema)
    expect((result.contains as JSONSchema7).pattern).toBe("^item$")
  })

  test("handles deeply nested schemas", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        nested: {
          type: "object",
          properties: {
            deep: { type: "string", pattern: "[0-9a-f]+" },
          },
        },
      },
    }
    const result = anchorPatterns(schema)
    const deep = (result.properties!.nested as JSONSchema7).properties!.deep as JSONSchema7
    expect(deep.pattern).toBe("^[0-9a-f]+$")
  })

  test("wraps top-level alternation in non-capturing group", () => {
    const schema: JSONSchema7 = { pattern: "foo|bar" }
    const result = anchorPatterns(schema)
    expect(result.pattern).toBe("^(?:foo|bar)$")
  })

  test("wraps complex alternation in non-capturing group", () => {
    const schema: JSONSchema7 = { pattern: "error|warn|info" }
    const result = anchorPatterns(schema)
    expect(result.pattern).toBe("^(?:error|warn|info)$")
  })

  test("wraps alternation with both anchors to fix semantics", () => {
    const schema: JSONSchema7 = { pattern: "^foo|bar$" }
    const result = anchorPatterns(schema)
    // "^foo|bar$" semantically means "starts with foo OR ends with bar",
    // not "entire string is foo or bar". Wrapping fixes the semantics.
    expect(result.pattern).toBe("^(?:foo|bar)$")
  })

  test("wraps partially-anchored alternation with start anchor only", () => {
    const schema: JSONSchema7 = { pattern: "^foo|bar" }
    const result = anchorPatterns(schema)
    expect(result.pattern).toBe("^(?:foo|bar)$")
  })

  test("wraps partially-anchored alternation with end anchor only", () => {
    const schema: JSONSchema7 = { pattern: "foo|bar$" }
    const result = anchorPatterns(schema)
    expect(result.pattern).toBe("^(?:foo|bar)$")
  })

  test("skips additionalProperties when boolean", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: { name: { type: "string", pattern: "[a-z]+" } },
      additionalProperties: false,
    }
    const result = anchorPatterns(schema)
    expect(result.additionalProperties).toBe(false)
    expect((result.properties!.name as JSONSchema7).pattern).toBe("^[a-z]+$")
  })

  test("does not wrap pipe inside character class", () => {
    const schema: JSONSchema7 = { pattern: "[a|b]+" }
    const result = anchorPatterns(schema)
    expect(result.pattern).toBe("^[a|b]+$")
  })

  test("does not wrap alternation fully inside a group", () => {
    const schema: JSONSchema7 = { pattern: "(foo|bar)" }
    const result = anchorPatterns(schema)
    expect(result.pattern).toBe("^(foo|bar)$")
  })

  test("wraps when top-level alternation exists alongside groups", () => {
    const schema: JSONSchema7 = { pattern: "(foo|bar)|baz" }
    const result = anchorPatterns(schema)
    expect(result.pattern).toBe("^(?:(foo|bar)|baz)$")
  })

  test("does not wrap escaped pipe", () => {
    const schema: JSONSchema7 = { pattern: "foo\\|bar" }
    const result = anchorPatterns(schema)
    expect(result.pattern).toBe("^foo\\|bar$")
  })

  test("does not mutate original schema", () => {
    const original: JSONSchema7 = { type: "string", pattern: "[a-z]+" }
    anchorPatterns(original)
    expect(original.pattern).toBe("[a-z]+")
  })

  // Edge cases for backslash handling (addresses review comments)
  test("handles \\\\\\$ (two escaped backslashes + real anchor)", () => {
    const schema: JSONSchema7 = { pattern: "foo\\\\\\\\$" }
    const result = anchorPatterns(schema)
    // Four backslashes = two literal backslashes, $ is a real anchor
    expect(result.pattern).toBe("^foo\\\\\\\\$")
  })

  test("handles pattern ending with escaped backslash followed by escaped $", () => {
    const schema: JSONSchema7 = { pattern: "price\\\\\\$" }
    const result = anchorPatterns(schema)
    // \\\\$ = escaped backslash + escaped $ (literal dollar sign)
    // Should add anchor: ^price\\\\\\$$
    expect(result.pattern).toBe("^price\\\\\\$$")
  })

  test("wraps alternation with escaped characters in alternatives", () => {
    const schema: JSONSchema7 = { pattern: "foo\\$|bar" }
    const result = anchorPatterns(schema)
    expect(result.pattern).toBe("^(?:foo\\$|bar)$")
  })

  test("handles escaped caret at start", () => {
    const schema: JSONSchema7 = { pattern: "\\^foo" }
    const result = anchorPatterns(schema)
    // \\^ is escaped caret, not anchor - should add anchors
    expect(result.pattern).toBe("^\\^foo$")
  })

  // JSON Schema keyword: dependencies (values can be schemas or arrays)
  test("recurses into dependencies with schema values", () => {
    const schema: any = {
      dependencies: {
        creditCard: { properties: { billingAddress: { pattern: "[a-z]+" } } },
      },
    }
    const result = anchorPatterns(schema) as any
    expect(result.dependencies.creditCard.properties.billingAddress.pattern).toBe("^[a-z]+$")
  })

  test("preserves dependencies with array values (property names)", () => {
    const schema: any = {
      dependencies: {
        creditCard: ["billingAddress", "billingName"],
      },
    }
    const result = anchorPatterns(schema) as any
    expect(result.dependencies.creditCard).toEqual(["billingAddress", "billingName"])
  })

  test("handles mixed dependencies (schema and array values)", () => {
    const schema: any = {
      dependencies: {
        creditCard: ["billingAddress"],
        billingAddress: { properties: { country: { pattern: "[A-Z]{2}" } } },
      },
    }
    const result = anchorPatterns(schema) as any
    expect(result.dependencies.creditCard).toEqual(["billingAddress"])
    expect(result.dependencies.billingAddress.properties.country.pattern).toBe("^[A-Z]{2}$")
  })

  // JSON Schema keyword: dependentSchemas (values are always schemas)
  test("recurses into dependentSchemas", () => {
    const schema: any = {
      dependentSchemas: {
        creditCard: { properties: { billingAddress: { pattern: "[a-z]+" } } },
      },
    }
    const result = anchorPatterns(schema) as any
    expect(result.dependentSchemas.creditCard.properties.billingAddress.pattern).toBe("^[a-z]+$")
  })

  // JSON Schema keyword: propertyNames (validates property names)
  test("recurses into propertyNames", () => {
    const schema: any = {
      propertyNames: { pattern: "^[a-z]+$" },
    }
    const result = anchorPatterns(schema) as any
    expect(result.propertyNames.pattern).toBe("^[a-z]+$") // already anchored
  })

  test("anchors pattern in propertyNames", () => {
    const schema: any = {
      propertyNames: { pattern: "[a-z]+" },
    }
    const result = anchorPatterns(schema) as any
    expect(result.propertyNames.pattern).toBe("^[a-z]+$")
  })
})
