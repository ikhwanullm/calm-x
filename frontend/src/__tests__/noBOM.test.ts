import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync } from "fs"
import { join } from "path"

function collectSrcFiles(dir: string): string[] {
  const result: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== "node_modules") {
      result.push(...collectSrcFiles(join(dir, entry.name)))
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      result.push(join(dir, entry.name))
    }
  }
  return result
}

const SRC_DIR = join(__dirname, "..")

describe("No UTF-8 BOM in source files", () => {
  const files = collectSrcFiles(SRC_DIR)

  for (const file of files) {
    it(`${file.replace(SRC_DIR, "").replace(/\\/g, "/")} has no BOM`, () => {
      const buf = readFileSync(file)
      const hasBOM = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf
      expect(hasBOM, `File has UTF-8 BOM: ${file}`).toBe(false)
    })
  }
})
