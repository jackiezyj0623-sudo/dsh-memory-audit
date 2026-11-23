/**
 * Minimal ambient type shims for DSH peer dependencies.
 *
 * DSH publishes its runtime packages as workspace packages that are not on
 * the public npm registry at stable versions yet. These declarations keep the
 * plugin type-checkable in a standalone checkout. At runtime the real types
 * come from the host harness.
 */
declare module '@deepseek-ai/cordis' {
  export interface Context {
    tools: {
      register(tool: unknown): void
    }
    [key: string]: unknown
  }
  export class Service {
    constructor(ctx: Context, name: string)
  }
}

declare module '@deepseek-ai/dsh-tools' {
  export function defineTool(definition: {
    name: string
    description: string
    parameters: Record<string, unknown>
    output: {
      schema: Record<string, unknown>
      render: (args: unknown, value: any) => Array<{ type: string; text: string }>
    }
    execute: (args: Record<string, unknown>, exec?: unknown) => unknown
  }): unknown
}
