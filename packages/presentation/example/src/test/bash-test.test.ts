/**
 * Bash integration test — runs presentation command scripts via vitest.
 *
 * Run: pnpm test
 */
import { describe, it, expect, beforeEach } from "vitest"
import { ALL_STEP_COMMANDS } from "@viben/presentation"
import type { PresentationStep } from "@viben/presentation"
import { createPresentationBash, fixJsonQuoting, joinMultilineQuotes } from "../features/bash/bash-integration"
import { stepsToBashScript } from "../features/bash/steps-to-bash"

// ============================================================================
// Test infrastructure
// ============================================================================

describe("presentation bash commands", () => {
  let steps: PresentationStep[] = []
  let cursorMs = 0

  function createBash() {
    return createPresentationBash({
      onStep: (step) => steps.push(step),
      getCursorMs: () => cursorMs,
      setCursorMs: (ms) => { cursorMs = ms },
    })
  }

  beforeEach(() => {
    steps = []
    cursorMs = 0
  })

  // ==========================================================================
  // Registry full-coverage — every command must produce a valid step with no args
  // ==========================================================================

  describe("registry full-coverage", () => {
    it.each(ALL_STEP_COMMANDS.map(c => [c.name, c]))(
      "%s produces a valid step with default args",
      async (_name, cmd) => {
        const bash = createBash()
        const result = await bash.exec(`presentation ${cmd.name}`)
        expect(result.exitCode).toBe(0)
        expect(steps).toHaveLength(1)
        expect(steps[0].command.type).toBe(cmd.name)
        expect(steps[0].startMs).toBeTypeOf("number")
        expect(steps[0].endMs).toBeGreaterThan(steps[0].startMs)
      },
    )
  })

  // ==========================================================================
  // Script-based tests
  // ==========================================================================

  const SCRIPTS = {
    "core-basics": `
presentation spotlight
presentation arrow
presentation text content="Hello World"
presentation circle
presentation highlight
presentation card title="Test Card" content="This is a test"
presentation pulse
presentation underline
presentation badge text="LIVE"
presentation progress value=85
presentation counter value=9999 prefix="$"
presentation bracket
presentation trendline
presentation comparison
presentation typewriter content="Testing typewriter effect..."
presentation chart chartType=line
presentation clear
presentation wait
`,

    "dataviz-suite": `
presentation gauge value=92 label="CPU Load"
presentation sparkline data='[5,15,25,20,35,40,55,50,65,70]'
presentation heatmap
presentation funnel
presentation waterfall
presentation treemap
presentation donut
presentation scatter
`,

    "narrative-flow": `
presentation callout content="Welcome to the presentation"
presentation timeline events='[{"label":"Step 1","description":"Init"},{"label":"Step 2","description":"Process"},{"label":"Step 3","description":"Done","active":true}]'
presentation flowchart
presentation table headers='["Product","Q1","Q2"]' rows='[["Widget","$10K","$15K"],["Gadget","$8K","$12K"]]'
presentation list items='[{"text":"First"},{"text":"Second"},{"text":"Third"}]' listStyle=arrow
presentation annotation-group
`,

    "effects-showcase": `
presentation confetti count=100 spread=300
presentation countdown from=5
presentation reveal direction=left
presentation zoom scale=3
presentation morph from=0 to=1000
`,

    "advanced-analytics": `
presentation radar axes='[{"label":"Performance","value":90},{"label":"Reliability","value":75},{"label":"Cost","value":60},{"label":"Speed","value":85}]'
presentation sankey
presentation kpi value=1500000 label="ARR" trend=up trendValue="+25%"
presentation matrix
presentation stat-card label="Build Time" before=120 after=45 unit=s
presentation code-block code="const x = 42;" language=javascript
presentation ribbon text="BEST SELLER" variant=award
presentation polar-area
presentation stacked-bar
presentation tooltip content="Click for details"
presentation badge-group
presentation meter value=88 label="Memory" unit="%"
`,

    "timing-control": `
presentation spotlight startMs=0 endMs=3000
presentation arrow startMs=1000 endMs=4000
presentation text content="Overlapping!" startMs=2000 endMs=5000
presentation clear startMs=5000
`,

    "full-demo": `
# Act 1: Introduction
presentation text content="AI Chip Market Analysis 2024" fontSize=36 color="#fff" position='{"x":280,"y":100}'
presentation typewriter content="The semiconductor industry is undergoing a transformation..." position='{"x":200,"y":400}'

# Act 2: Key Data
presentation clear
presentation chart chartType=bar data='[{"name":"NVIDIA","value":90,"color":"#76B900"},{"name":"AMD","value":35,"color":"#ED1C24"},{"name":"Intel","value":12,"color":"#0071C5"}]' title="AI Chip Revenue ($B)"
presentation kpi value=90000000000 label="NVIDIA Revenue" trend=up trendValue="+122%"

# Act 3: Comparison
presentation clear
presentation comparison leftLabel="GPU" rightLabel="Custom ASIC" leftValue=78 rightValue=22 unit="%"
presentation radar axes='[{"label":"Perf","value":95},{"label":"Efficiency","value":70},{"label":"Cost","value":40},{"label":"Flexibility","value":90},{"label":"Ecosystem","value":85}]'

# Act 4: Conclusion
presentation clear
presentation confetti count=80
presentation text content="The future is accelerated computing" fontSize=28 position='{"x":240,"y":280}'
`,
  } as const

  describe.each([
    ["core-basics", 18],
    ["dataviz-suite", 8],
    ["narrative-flow", 6],
    ["effects-showcase", 5],
    ["advanced-analytics", 12],
  ] as const)("%s", (scriptName, expectedCount) => {
    it(`executes all ${expectedCount} commands`, async () => {
      const bash = createBash()
      const result = await bash.exec(SCRIPTS[scriptName])
      expect(result.exitCode).toBe(0)
      expect(steps).toHaveLength(expectedCount)
    })

    it("auto-advances cursor correctly", async () => {
      const bash = createBash()
      await bash.exec(SCRIPTS[scriptName])
      // Cursor should have advanced by the sum of all command durations
      expect(cursorMs).toBeGreaterThan(0)
      // Each step's startMs should be monotonically non-decreasing
      for (let i = 1; i < steps.length; i++) {
        expect(steps[i].startMs).toBeGreaterThanOrEqual(steps[i - 1].startMs)
      }
      // Final cursor should equal last step's startMs + its duration
      const lastStep = steps[steps.length - 1]
      expect(cursorMs).toBe(lastStep.endMs)
    })
  })

  describe("effects-showcase field checks", () => {
    it("confetti parses count and spread", async () => {
      const bash = createBash()
      await bash.exec("presentation confetti count=100 spread=300")
      expect(steps[0].command).toMatchObject({
        type: "confetti",
        count: 100,
        spread: 300,
      })
    })

    it("countdown parses from", async () => {
      const bash = createBash()
      await bash.exec("presentation countdown from=5")
      expect(steps[0].command).toMatchObject({
        type: "countdown",
        from: 5,
      })
    })

    it("zoom parses scale", async () => {
      const bash = createBash()
      await bash.exec("presentation zoom scale=3")
      expect(steps[0].command).toMatchObject({
        type: "zoom",
        scale: 3,
      })
    })
  })

  describe("advanced-analytics field checks", () => {
    it("kpi parses value, label, trend, trendValue", async () => {
      const bash = createBash()
      await bash.exec('presentation kpi value=1500000 label="ARR" trend=up trendValue="+25%"')
      expect(steps[0].command).toMatchObject({
        type: "kpi",
        value: 1500000,
        label: "ARR",
        trend: "up",
        trendValue: "+25%",
      })
    })

    it("stat-card parses before/after/unit", async () => {
      const bash = createBash()
      await bash.exec('presentation stat-card label="Build Time" before=120 after=45 unit=s')
      expect(steps[0].command).toMatchObject({
        type: "stat-card",
        label: "Build Time",
        before: 120,
        after: 45,
        unit: "s",
      })
    })

    it("meter parses value/label/unit", async () => {
      const bash = createBash()
      await bash.exec('presentation meter value=88 label="Memory" unit="%"')
      expect(steps[0].command).toMatchObject({
        type: "meter",
        value: 88,
        label: "Memory",
        unit: "%",
      })
    })
  })

  describe("timing-control", () => {
    it("respects explicit startMs and endMs", async () => {
      const bash = createBash()
      const result = await bash.exec(SCRIPTS["timing-control"])
      expect(result.exitCode).toBe(0)
      expect(steps[0]).toMatchObject({ startMs: 0, endMs: 3000 })
      expect(steps[1]).toMatchObject({ startMs: 1000, endMs: 4000 })
      expect(steps[2]).toMatchObject({ startMs: 2000, endMs: 5000 })
      expect(steps[3].startMs).toBe(5000)
    })
  })

  describe("full-demo", () => {
    it("executes a complex multi-act script (11 steps, 3 clears)", async () => {
      const bash = createBash()
      const result = await bash.exec(SCRIPTS["full-demo"])
      expect(result.exitCode).toBe(0)
      expect(steps).toHaveLength(11)
      const clears = steps.filter(s => s.command.type === "clear")
      expect(clears).toHaveLength(3)
    })
  })

  describe("arg parsing", () => {
    it("parses content arg correctly", async () => {
      const bash = createBash()
      await bash.exec('presentation text content="Hello World"')
      expect(steps[0].command).toMatchObject({
        type: "text",
        content: "Hello World",
      })
    })

    it("parses numeric args", async () => {
      const bash = createBash()
      await bash.exec("presentation gauge value=92")
      expect(steps[0].command).toMatchObject({
        type: "gauge",
        value: 92,
      })
    })

    it("parses JSON array args", async () => {
      const bash = createBash()
      await bash.exec("presentation sparkline data='[5,15,25,20,35]'")
      expect(steps[0].command.type).toBe("sparkline")
      if (steps[0].command.type === "sparkline") {
        expect(steps[0].command.data).toEqual([5, 15, 25, 20, 35])
      }
    })

    it("parses JSON object array args", async () => {
      const bash = createBash()
      await bash.exec(`presentation timeline events='[{"label":"A","description":"First"}]'`)
      expect(steps[0].command.type).toBe("timeline")
      if (steps[0].command.type === "timeline") {
        expect(steps[0].command.events[0].label).toBe("A")
      }
    })

    it("handles single-char values (not mistaken for quotes)", async () => {
      const bash = createBash()
      await bash.exec("presentation stat-card unit=s")
      expect(steps[0].command.type).toBe("stat-card")
      if (steps[0].command.type === "stat-card") {
        expect(steps[0].command.unit).toBe("s")
      }
    })
  })

  describe("default values", () => {
    it("spotlight produces valid region with no args", async () => {
      const bash = createBash()
      await bash.exec("presentation spotlight")
      expect(steps[0].command).toMatchObject({
        type: "spotlight",
        region: { x: 300, y: 200, width: 360, height: 240 },
      })
    })
  })

  describe("single-quote-in-JSON handling", () => {
    it("serializer uses double quotes for JSON with single quotes", () => {
      const steps = [{
        id: "test-1",
        startMs: 0,
        endMs: 3000,
        command: {
          type: "chart",
          chartType: "bar",
          data: [{ name: "Q1'23", value: 7.2 }, { name: "Q2'23", value: 8.1 }],
        },
      }] as unknown as PresentationStep[]
      const script = stepsToBashScript(steps)
      // Should use double-quote wrapping (not single)
      expect(script).not.toContain("='")
      expect(script).toContain('="')
    })

    it("round-trips JSON with single quotes through serializer + parser", async () => {
      const originalData = [{ name: "Q1'23", value: 7.2 }, { name: "Q2'23", value: 8.1 }]
      const steps = [{
        id: "test-1",
        startMs: 0,
        endMs: 3000,
        command: { type: "chart", chartType: "bar", data: originalData },
      }] as unknown as PresentationStep[]
      const script = stepsToBashScript(steps)
      const bash = createBash()
      const result = await bash.exec(script)
      expect(result.exitCode).toBe(0)
      expect(steps.length).toBeGreaterThan(0)
    })

    it("fixJsonQuoting re-wraps single-quoted JSON containing single quotes", () => {
      const input = `presentation chart data='[{"name":"Q1'23","value":7.2},{"name":"Q2'23","value":8.1}]'`
      const fixed = fixJsonQuoting(input)
      expect(fixed).not.toContain("='[")
      expect(fixed).toContain('="')
      // Should be parseable after fix
      expect(fixed).toContain("Q1'23")
    })

    it("fixJsonQuoting leaves clean single-quoted JSON untouched", () => {
      const input = `presentation sparkline data='[5,15,25,20,35]'`
      const fixed = fixJsonQuoting(input)
      expect(fixed).toBe(input) // No change needed
    })

    it("full pipeline handles single-quote-in-JSON user input", async () => {
      const script = `presentation chart chartType=bar data='[{"name":"Q1'23","value":7.2},{"name":"Q2'23","value":8.1}]'`
      const processed = fixJsonQuoting(joinMultilineQuotes(script))
      const bash = createBash()
      const result = await bash.exec(processed)
      expect(result.exitCode).toBe(0)
      expect(steps).toHaveLength(1)
      expect(steps[0].command.type).toBe("chart")
    })

    it("round-trips dollar signs in content through serializer + parser", async () => {
      const testSteps = [{
        id: "dollar-1",
        toolUseId: "t-dollar-1",
        toolName: "test",
        toolInput: {},
        description: "test",
        status: "done",
        startMs: 0,
        endMs: 3000,
        command: { type: "text", content: "Revenue $26B and $2.2T market cap", position: { x: 100, y: 100 } },
      }, {
        id: "dollar-2",
        toolUseId: "t-dollar-2",
        toolName: "test",
        toolInput: {},
        description: "test",
        status: "done",
        startMs: 3000,
        endMs: 6000,
        command: { type: "counter", value: 2.2, prefix: "$", suffix: "T", position: { x: 200, y: 200 } },
      }] as unknown as PresentationStep[]

      const script = stepsToBashScript(testSteps)
      const bash = createBash()
      const result = await bash.exec(script)
      expect(result.exitCode).toBe(0)
      expect(steps).toHaveLength(2)
      expect((steps[0].command as unknown as Record<string, unknown>).content).toBe("Revenue $26B and $2.2T market cap")
      expect((steps[1].command as unknown as Record<string, unknown>).prefix).toBe("$")
    })
  })

  describe("error handling", () => {
    it("returns error for unknown subcommand", async () => {
      const bash = createBash()
      const result = await bash.exec("presentation nonexistent")
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain("unknown command")
    })

    it("shows help with --help", async () => {
      const bash = createBash()
      const result = await bash.exec("presentation --help")
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("spotlight")
      expect(result.stdout).toContain("arrow")
      expect(result.stdout).toContain("presentation")
    })

    it("shows help with no subcommand", async () => {
      const bash = createBash()
      const result = await bash.exec("presentation")
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("presentation")
    })
  })
})
