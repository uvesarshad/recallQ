# Recall

Recall is a frictionless capture and intelligent organization tool designed to make high-density personal knowledge searchable and navigable. Capture notes, links, and documents from any surface (web, extensions, Telegram, or email), enrich them via Gemini AI, visualize similarities on an interactive canvas, and converse with your history using vector RAG.

---

## Documentation System

To keep development frictionless for both human developers and AI agents, Recall maintains a structured, up-to-date documentation system. 

### For AI Coding Agents (Cursor, Claude Code, Gemini CLI, etc.)
- **AI Bootstrap Guide**: Read [AGENTS.md](file:///e:/Projects/recallQ/AGENTS.md) first. It provides immediate boundaries, paths, stack definitions, and agentic update rules.
- **Documentation Index**: Read [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md) to explore the system's architecture, layers, components, states, and feature modules.

### For Human Developers
- Core documentation resides inside the `/docs` directory:
  - **Overview & glossary**: [docs/overview.md](file:///e:/Projects/recallQ/docs/overview.md)
  - **Folder maps**: [docs/architecture/folder-structure.md](file:///e:/Projects/recallQ/docs/architecture/folder-structure.md)
  - **Environment variables Zod schema**: [docs/infra/environment.md](file:///e:/Projects/recallQ/docs/infra/environment.md)
  - **Background workers & migrations**: [docs/infra/deployment.md](file:///e:/Projects/recallQ/docs/infra/deployment.md)
  - **NextAuth guards & plan limits checks**: [docs/auth/authorization.md](file:///e:/Projects/recallQ/docs/auth/authorization.md)
  - **Ingestion & capture engine**: [docs/modules/capture.md](file:///e:/Projects/recallQ/docs/modules/capture.md)
  - **Hybrid search, streaming RAG chat, & canvas**: [docs/modules/search-chat-graph.md](file:///e:/Projects/recallQ/docs/modules/search-chat-graph.md)

---

## Maintenance Rules
All documentation files contain explicit `AGENT UPDATE:` and `AGENT NOTE:` instructions. When mutating features, route endpoints, schemas, or styles, follow these tags to keep the documentation system synchronized with the codebase.
