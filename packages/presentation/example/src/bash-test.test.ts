/**
 * Bash integration test — runs presentation command scripts via vitest.
 *
 * Run: pnpm test
 */
import { describe, it, expect, beforeEach } from "vitest"
import type { PresentationStep } from "../../src/types"
import { createPresentationBash } from "./bash-integration"

// ============================================================================
// Test infrastructure
// ============================================================================

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

// ============================================================================
// Test scripts
// ============================================================================

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

// ============================================================================
// Tests
// ============================================================================

describe("presentation bash commands", () => {
  describe("core-basics", () => {
    it("executes all 17 core commands", async () => {
      const bash = createBash()
      const result = await bash.exec(SCRIPTS["core-basics"])
      expect(result.exitCode).toBe(0)
      expect(steps.length).toBe(17)
      expect(steps[0].command.type).toBe("spotlight")
      expect(steps[16].command.type).toBe("clear")
    })

    it("auto-advances cursor after each command", async () => {
      const bash = createBash()
      await bash.exec(SCRIPTS["core-basics"])
      expect(cursorMs).toBeGreaterThan(0)
      // Each step's startMs should be >= previous step's startMs
      for (let i = 1; i < steps.length; i++) {
        expect(steps[i].startMs).toBeGreaterThanOrEqual(steps[i - 1].startMs)
      }
    })

    it("parses content arg correctly", async () => {
      const bash = createBash()
      await bash.exec('presentation text content="Hello World"')
      expect(steps[0].command.type).toBe("text")
      if (steps[0].command.type === "text") {
        expect(steps[0].command.content).toBe("Hello World")
      }
    })
  })

  describe("dataviz-suite", () => {
    it("executes all 8 dataviz commands", async () => {
      const bash = createBash()
      const result = await bash.exec(SCRIPTS["dataviz-suite"])
      expect(result.exitCode).toBe(0)
      expect(steps.length).toBe(8)
    })

    it("parses numeric args", async () => {
      const bash = createBash()
      await bash.exec("presentation gauge value=92")
      expect(steps[0].command.type).toBe("gauge")
      if (steps[0].command.type === "gauge") {
        expect(steps[0].command.value).toBe(92)
      }
    })

    it("parses JSON array args", async () => {
      const bash = createBash()
      await bash.exec("presentation sparkline data='[5,15,25,20,35]'")
      expect(steps[0].command.type).toBe("sparkline")
      if (steps[0].command.type === "sparkline") {
        expect(steps[0].command.data).toEqual([5, 15, 25, 20, 35])
      }
    })
  })

  describe("narrative-flow", () => {
    it("executes all 6 narrative commands", async () => {
      const bash = createBash()
      const result = await bash.exec(SCRIPTS["narrative-flow"])
      expect(result.exitCode).toBe(0)
      expect(steps.length).toBe(6)
    })

    it("parses JSON object array args", async () => {
      const bash = createBash()
      await bash.exec(`presentation timeline events='[{"label":"A","description":"First"}]'`)
      expect(steps[0].command.type).toBe("timeline")
      if (steps[0].command.type === "timeline") {
        expect(steps[0].command.events[0].label).toBe("A")
      }
    })
  })

  describe("effects-showcase", () => {
    it("executes all 5 effects commands", async () => {
      const bash = createBash()
      const result = await bash.exec(SCRIPTS["effects-showcase"])
      expect(result.exitCode).toBe(0)
      expect(steps.length).toBe(5)
    })
  })

  describe("advanced-analytics", () => {
    it("executes all 12 advanced commands", async () => {
      const bash = createBash()
      const result = await bash.exec(SCRIPTS["advanced-analytics"])
      expect(result.exitCode).toBe(0)
      expect(steps.length).toBe(12)
    })
  })

  describe("timing-control", () => {
    it("respects explicit startMs and endMs", async () => {
      const bash = createBash()
      const result = await bash.exec(SCRIPTS["timing-control"])
      expect(result.exitCode).toBe(0)
      expect(steps[0].startMs).toBe(0)
      expect(steps[0].endMs).toBe(3000)
      expect(steps[1].startMs).toBe(1000)
      expect(steps[1].endMs).toBe(4000)
      expect(steps[2].startMs).toBe(2000)
      expect(steps[2].endMs).toBe(5000)
    })
  })

  describe("full-demo", () => {
    it("executes a complex multi-act script", async () => {
      const bash = createBash()
      const result = await bash.exec(SCRIPTS["full-demo"])
      expect(result.exitCode).toBe(0)
      expect(steps.length).toBeGreaterThan(5)
      // Should contain multiple clear commands (act transitions)
      const clears = steps.filter(s => s.command.type === "clear")
      expect(clears.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe("error handling", () => {
    it("returns error for unknown subcommand", async () => {
      const bash = createBash()
      const result = await bash.exec("presentation nonexistent")
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain("unknown subcommand")
    })

    it("shows help with --help", async () => {
      const bash = createBash()
      const result = await bash.exec("presentation --help")
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain("spotlight")
      expect(result.stdout).toContain("arrow")
      expect(result.stdout).toContain("overlay commands")
    })
  })

  describe("default values", () => {
    it("produces valid commands with no args", async () => {
      const bash = createBash()
      await bash.exec("presentation spotlight")
      expect(steps[0].command.type).toBe("spotlight")
      if (steps[0].command.type === "spotlight") {
        expect(steps[0].command.region).toEqual({ x: 300, y: 200, width: 360, height: 240 })
      }
    })
  })
})
