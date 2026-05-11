import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import fs from "node:fs"
import path from "node:path"

export default defineConfig({
  plugins: [
    react(),
    {
      name: "collision-log-writer",
      configureServer(server) {
        server.middlewares.use("/__collision-log", (req, res) => {
          if (req.method === "POST") {
            let body = ""
            req.on("data", (chunk: Buffer) => { body += chunk.toString() })
            req.on("end", () => {
              const logFile = path.resolve(__dirname, "collision-report.log")
              fs.appendFileSync(logFile, body + "\n")
              res.writeHead(200)
              res.end("ok")
            })
          } else {
            res.writeHead(405)
            res.end()
          }
        })
      },
    },
  ],
  server: {
    port: 5188,
  },
})
