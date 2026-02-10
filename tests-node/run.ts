/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
import path from "node:path"

type TestCase = { name: string; fn: () => Promise<void> }

async function runFile(relPathFromDist: string): Promise<{ passed: number; failed: number }> {
  const abs = path.resolve(__dirname, relPathFromDist)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require(abs) as { tests: TestCase[] }
  const tests: TestCase[] = mod.tests || []

  let passed = 0
  let failed = 0

  for (const t of tests) {
    try {
      await t.fn()
      passed++
      // Keep output minimal but actionable.
      // eslint-disable-next-line no-console
      console.log(`ok - ${t.name}`)
    } catch (e: any) {
      failed++
      // eslint-disable-next-line no-console
      console.error(`not ok - ${t.name}`)
      // eslint-disable-next-line no-console
      console.error(e?.stack || e)
    }
  }

  return { passed, failed }
}

async function main() {
  const files = ["./background.message-flows.test.js"]

  let passed = 0
  let failed = 0

  for (const f of files) {
    const r = await runFile(f)
    passed += r.passed
    failed += r.failed
  }

  // eslint-disable-next-line no-console
  console.log(`\nSummary: passed=${passed} failed=${failed}`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e?.stack || e)
  process.exit(1)
})
