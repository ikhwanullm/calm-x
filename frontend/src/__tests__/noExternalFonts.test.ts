import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

// The font is bundled (@fontsource); the app must not contact a font CDN, so it works offline.
describe("No external font hosts", () => {
  const html = readFileSync(join(__dirname, "..", "..", "index.html"), "utf-8")

  it("index.html does not load fonts from Google", () => {
    expect(html).not.toContain("fonts.googleapis.com")
    expect(html).not.toContain("fonts.gstatic.com")
  })

  it("main.tsx imports the bundled Plus Jakarta Sans", () => {
    const main = readFileSync(join(__dirname, "..", "main.tsx"), "utf-8")
    expect(main).toContain("@fontsource-variable/plus-jakarta-sans")
  })
})
