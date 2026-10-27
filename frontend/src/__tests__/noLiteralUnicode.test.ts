import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync } from "fs"
import { join } from "path"

/**
 * Fail if any .tsx file contains a literal \\uXXXX escape OUTSIDE a JS expression.
 * These appear as "\u2026" in the browser instead of "...".
 * Allowed only inside {'...'}  or in TS/JS comments (// or /* lines).
 */

const SRC_DIR = join(__dirname, "..")

function collectTsx(dir: string): string[] {
  const result: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== "node_modules") {
      result.push(...collectTsx(join(dir, entry.name)))
    } else if (entry.name.endsWith(".tsx")) {
      result.push(join(dir, entry.name))
    }
  }
  return result
}

describe("No literal \\uXXXX escape sequences in TSX files", () => {
  const tsxFiles = collectTsx(SRC_DIR)

  for (const file of tsxFiles) {
    it(`${file.replace(SRC_DIR, "").replace(/\\\\/g, "/")} has no literal \\uXXXX`, () => {
      const src = readFileSync(file, "utf-8")
      const violations: string[] = []
      src.split("\n").forEach((line, i) => {
        // Skip lines that are pure JS/TS comments
        const trimmed = line.trim()
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) return
        // Skip lines inside template literals or expressions (simplified check)
        // A literal \uXXXX in JSX text (not inside {}) is the problem
        const jsxTextMatch = /(?<![{'"`])\\u[0-9a-fA-F]{4}/.exec(line)
        if (jsxTextMatch) {
          violations.push(`  line ${i + 1}: ${line.trim()}`)
        }
      })
      expect(violations, `Literal \\uXXXX in JSX text:\n${violations.join("\n")}`).toHaveLength(0)
    })
  }
})
