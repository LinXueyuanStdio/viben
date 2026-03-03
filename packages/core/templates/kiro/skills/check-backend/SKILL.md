---
name: check-backend
description: "Check if the code you just wrote follows the backend development guidelines."
---

Check if the code you just wrote follows the backend development guidelines.

Execute these steps:
1. Run `git status` to see modified files
2. Read `.viben/spec/backend/index.md` to understand which guidelines apply
3. Based on what you changed, read the relevant guideline files:
   - Database changes → `.viben/spec/backend/database-guidelines.md`
   - Error handling → `.viben/spec/backend/error-handling.md`
   - Logging changes → `.viben/spec/backend/logging-guidelines.md`
   - Type changes → `.viben/spec/backend/type-safety.md`
   - Any changes → `.viben/spec/backend/quality-guidelines.md`
4. Review your code against the guidelines
5. Report any violations and fix them if found
