import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Bot,
  Brain,
  Check,
  FileText,
  Globe,
  Link2,
  Mail,
  MessageSquare,
  Network,
  Search,
  Send,
  Sparkles,
  Zap,
} from "lucide-react";
import ThemeToggleClient from "@/components/ThemeToggleClient";

export default function LandingPage() {
  return (
    <div className="landing-shell flex min-h-screen flex-col overflow-x-hidden bg-[var(--landing-bg)] font-sans text-[var(--landing-text-primary)] antialiased transition-colors selection:bg-[#6366f1]/30 selection:text-[#818cf8]">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-full w-full -translate-x-1/2 bg-[image:var(--landing-hero-radial)]" />
        <div className="absolute left-[5%] top-[15%] h-[35%] w-[35%] animate-blob rounded-full bg-[var(--landing-blob-primary)] blur-[130px]" />
        <div
          className="absolute bottom-[5%] right-[5%] h-[40%] w-[40%] animate-blob rounded-full bg-[var(--landing-blob-secondary)] blur-[130px]"
          style={{ animationDelay: "5s" }}
        />
      </div>

      <Navbar />

      <main className="flex flex-1 flex-col">
        <HeroSection />
        <TrustBar />
        <CaptureSection />
        <FeaturesSection />
        <PricingSection />
        <CtaSection />
      </main>

      <Footer />
    </div>
  );
}

/* ─── Navbar ─────────────────────────────────────────────────────────────── */

function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[color:var(--landing-border-soft)] bg-[var(--landing-nav-bg)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Brain className="relative z-10 h-5 w-5 text-[#818cf8]" />
          </div>
          <span className="text-lg font-bold tracking-tight">Recall</span>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          {[
            { href: "#features", label: "Features" },
            { href: "#how-it-works", label: "How it works" },
            { href: "#pricing", label: "Pricing" },
            { href: "https://github.com/uvesarshad/recallQ", label: "GitHub" },
          ].map(({ href, label }) => (
            <Link
              key={label}
              href={href}
              className="text-sm font-medium text-[var(--landing-text-mid)] transition-colors hover:text-[var(--landing-text-primary)]"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggleClient initialTheme="light" className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--landing-border)] bg-[var(--landing-control)] text-[var(--landing-text-mid)] transition-colors hover:bg-[var(--landing-control-hover)] hover:text-[var(--landing-text-primary)]" />
          <Link href="/login" className="text-sm font-medium text-[var(--landing-text-mid)] transition-colors hover:text-[var(--landing-text-primary)]">
            Sign in
          </Link>
          <Link
            href="/app"
            className="flex items-center gap-1.5 rounded-full bg-[#6366f1] px-5 py-2 text-sm font-semibold text-white shadow-[0_0_24px_-4px_rgba(99,102,241,0.5)] transition-all hover:bg-[#818cf8] hover:shadow-[0_0_32px_-4px_rgba(99,102,241,0.6)] active:scale-95"
          >
            Get started
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ─── Hero ───────────────────────────────────────────────────────────────── */

function HeroSection() {
  return (
    <section className="relative mx-auto flex w-full max-w-7xl flex-col items-center px-6 pb-16 pt-24 text-center sm:pb-24 sm:pt-40">
      <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-[color:var(--landing-border)] bg-[var(--landing-control)] px-4 py-1.5 text-[13px] font-medium text-[var(--landing-text-mid)] animate-in fade-in slide-in-from-bottom-4 duration-700">
        <Sparkles className="h-3.5 w-3.5 text-[#818cf8]" />
        <span>Powered by Gemini 2.5 · pgvector semantic search</span>
      </div>

      <h1 className="mb-6 max-w-4xl text-5xl font-black leading-[1.02] tracking-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100 sm:text-7xl lg:text-[88px]">
        Save anything.{" "}
        <span className="bg-[image:var(--landing-heading-gradient)] bg-clip-text text-transparent">
          Find everything.
        </span>
      </h1>

      <p className="mb-3 max-w-2xl text-lg font-medium leading-relaxed text-[var(--landing-text-mid)] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 sm:text-xl">
        Capture links, files, and notes from Telegram, Email, or your browser in seconds.
        Gemini AI silently enriches every item. Search by meaning, chat with your archive, visualise everything.
      </p>

      <p className="mb-10 text-sm text-[var(--landing-text-muted)] animate-in fade-in duration-700 delay-200">
        Free forever · Open source (MIT) · Self-hostable
      </p>

      <div className="mb-20 flex w-full flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300 sm:w-auto sm:flex-row">
        <Link
          href="/app"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#6366f1] px-10 py-3.5 text-[15px] font-bold text-white shadow-[0_0_40px_-6px_rgba(99,102,241,0.55)] transition-all hover:-translate-y-0.5 hover:bg-[#818cf8] hover:shadow-[0_0_52px_-6px_rgba(99,102,241,0.65)] active:scale-95 sm:w-auto"
        >
          Start for free
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="https://github.com/uvesarshad/recallQ"
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-full border border-[color:var(--landing-border)] bg-[var(--landing-control)] px-10 py-3.5 text-[15px] font-bold text-[var(--landing-text-primary)] transition-all hover:bg-[var(--landing-control-hover)] active:scale-95 sm:w-auto"
        >
          View source
        </Link>
      </div>

      {/* App preview mockup */}
      <div className="relative w-full max-w-[1100px] animate-in fade-in zoom-in-95 duration-1000 delay-500">
        <div className="absolute -inset-px -z-10 rounded-[22px] bg-gradient-to-b from-[#6366f1]/30 to-transparent blur-xl" />
        <div className="rounded-[20px] border border-[color:var(--landing-border)] bg-[var(--landing-surface)] shadow-[var(--landing-preview-shadow)] overflow-hidden backdrop-blur">
          {/* Window chrome */}
          <div className="flex items-center gap-2 border-b border-[color:var(--landing-border-soft)] bg-[var(--landing-surface-soft)] px-4 py-3">
            <div className="h-2.5 w-2.5 rounded-full bg-[var(--landing-control-hover)]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[var(--landing-control-hover)]" />
            <div className="h-2.5 w-2.5 rounded-full bg-[var(--landing-control-hover)]" />
            <div className="mx-auto flex h-5 w-52 items-center rounded bg-[var(--landing-control)] px-3">
              <span className="text-[9px] text-[var(--landing-text-faint)]">app.recall.io</span>
            </div>
          </div>

          {/* App layout */}
          <div className="flex" style={{ minHeight: "420px" }}>
            {/* Sidebar */}
            <aside className="hidden w-[58px] shrink-0 flex-col items-center gap-1 border-r border-[color:var(--landing-border-soft)] bg-[var(--landing-surface-subtle)] py-4 sm:flex">
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#6366f1]/20">
                <Brain className="h-4 w-4 text-[#818cf8]" />
              </div>
              {[
                { active: true, color: "bg-[#6366f1]/20 text-[#818cf8]" },
                { active: false, color: "bg-transparent text-[var(--landing-text-faint)]" },
                { active: false, color: "bg-transparent text-[var(--landing-text-faint)]" },
                { active: false, color: "bg-transparent text-[var(--landing-text-faint)]" },
              ].map(({ active, color }, i) => (
                <div key={i} className={`flex h-9 w-9 items-center justify-center rounded-[8px] ${active ? color : "text-[var(--landing-text-faint)]"}`}>
                  <div className={`h-4 w-4 rounded-sm ${active ? "bg-[#818cf8]/60" : "bg-[var(--landing-control-hover)]"}`} />
                </div>
              ))}
            </aside>

            {/* Main content */}
            <div className="flex-1 overflow-hidden p-4 sm:p-6">
              {/* Header */}
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-8 flex-1 items-center gap-2 rounded-lg border border-[color:var(--landing-border-soft)] bg-[var(--landing-control)] px-3">
                  <Search className="h-3 w-3 text-[var(--landing-text-faint)] shrink-0" />
                  <div className="h-1.5 w-28 rounded-full bg-[var(--landing-control)]" />
                </div>
                <div className="flex h-8 items-center gap-1.5 rounded-lg bg-[#6366f1] px-3 text-[11px] font-semibold text-white">
                  <span className="text-[15px] font-light">+</span> Capture
                </div>
              </div>

              {/* Feed items */}
              <div className="space-y-3">
                {mockFeedItems.map((item, i) => (
                  <MockFeedCard key={i} {...item} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const mockFeedItems = [
  {
    type: "url",
    typeColor: "text-[#38bdf8] bg-[#38bdf8]/10",
    title: "React Compiler: A Deep Dive into Automatic Memoisation",
    summary: "A thorough breakdown of how the React compiler eliminates manual useMemo and useCallback calls while preserving semantic guarantees.",
    tags: ["react", "performance", "compiler"],
    time: "2 min ago",
    enriched: true,
  },
  {
    type: "note",
    typeColor: "text-[#84cc16] bg-[#84cc16]/10",
    title: "Ideas for Q1 2026 product roadmap",
    summary: "Focus on onboarding friction, knowledge graph improvements, and mobile-first capture flow via PWA share target.",
    tags: ["planning", "product", "q1"],
    time: "1 hr ago",
    enriched: true,
  },
  {
    type: "file",
    typeColor: "text-[#fb923c] bg-[#fb923c]/10",
    title: "distributed-systems-notes.pdf",
    summary: "Personal notes on Raft consensus, vector clocks, and CRDTs from a systems design reading sprint.",
    tags: ["systems", "distributed", "research"],
    time: "yesterday",
    enriched: true,
  },
];

function MockFeedCard({ type, typeColor, title, summary, tags, time, enriched }: {
  type: string; typeColor: string; title: string; summary: string; tags: string[]; time: string; enriched: boolean;
}) {
  return (
    <div className="landing-card rounded-[10px] border border-[color:var(--landing-border-soft)] bg-[var(--landing-surface-soft)] p-3.5 backdrop-blur sm:p-4">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 shrink-0 rounded-[6px] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${typeColor}`}>
          {type}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-semibold leading-snug text-[var(--landing-text-primary)] line-clamp-1">{title}</p>
            <span className="shrink-0 text-[10px] text-[var(--landing-text-faint)]">{time}</span>
          </div>
          <p className="mt-1 line-clamp-1 text-[11px] leading-relaxed text-[var(--landing-text-muted)]">{summary}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-[var(--landing-control)] px-2 py-0.5 text-[9px] text-[var(--landing-text-faint)]">
                #{tag}
              </span>
            ))}
            {enriched && (
              <span className="ml-auto flex items-center gap-1 rounded-full bg-[#6366f1]/10 px-2 py-0.5 text-[9px] text-[#818cf8]">
                <Sparkles className="h-2 w-2" /> AI
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Trust bar ──────────────────────────────────────────────────────────── */

function TrustBar() {
  const items = [
    { label: "Gemini 2.5 Flash", icon: <Bot className="h-4 w-4" /> },
    { label: "pgvector search", icon: <Search className="h-4 w-4" /> },
    { label: "Open Source · MIT", icon: <span className="text-[13px] font-bold">{"{}"}</span> },
    { label: "Self-hostable", icon: <Globe className="h-4 w-4" /> },
    { label: "End-to-end private", icon: <span className="text-xs font-bold">🔒</span> },
  ];

  return (
    <div className="border-y border-[color:var(--landing-border-soft)] bg-[var(--landing-surface-subtle)]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 py-5">
        {items.map(({ label, icon }) => (
          <div key={label} className="flex items-center gap-2 text-[var(--landing-text-muted)]">
            <span className="text-[var(--landing-icon-muted)]">{icon}</span>
            <span className="text-[13px] font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Capture surfaces ───────────────────────────────────────────────────── */

function CaptureSection() {
  const surfaces = [
    {
      icon: <Globe className="h-6 w-6" />,
      color: "text-[#38bdf8]",
      bg: "bg-[#38bdf8]/10",
      border: "border-[#38bdf8]/15",
      title: "Web PWA",
      description: "Paste a link or text in the capture bar. Works in any browser, installable on Android via Web Share Target.",
    },
    {
      icon: <Send className="h-6 w-6" />,
      color: "text-[#6366f1]",
      bg: "bg-[#6366f1]/10",
      border: "border-[#6366f1]/15",
      title: "Telegram Bot",
      description: "Forward any message, link, or file to your personal Recall bot. Saved instantly, enriched in seconds.",
    },
    {
      icon: <Mail className="h-6 w-6" />,
      color: "text-[#84cc16]",
      bg: "bg-[#84cc16]/10",
      border: "border-[#84cc16]/15",
      title: "Email Forward",
      description: "Every account gets a unique inbox. Forward newsletters, receipts, or any email directly to your archive.",
    },
    {
      icon: <Zap className="h-6 w-6" />,
      color: "text-[#fb923c]",
      bg: "bg-[#fb923c]/10",
      border: "border-[#fb923c]/15",
      title: "Files & Notes",
      description: "Upload PDFs, images, DOCX, spreadsheets, or write a quick note. AI extracts and indexes the content.",
    },
  ];

  return (
    <section id="how-it-works" className="mx-auto w-full max-w-7xl px-6 py-24">
      <div className="mb-16 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[color:var(--landing-border)] bg-[var(--landing-control)] px-3 py-1.5 text-[12px] font-medium text-[var(--landing-text-muted)]">
          Capture from anywhere
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-[var(--landing-text-primary)] sm:text-5xl">
          One archive. <span className="text-[var(--landing-text-muted)]">Four ways in.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[var(--landing-text-muted)]">
          Your life doesn&apos;t happen in one app. Neither should your capture surface.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {surfaces.map((s) => (
          <div
            key={s.title}
            className={`landing-card group relative rounded-[20px] border ${s.border} bg-[var(--landing-surface-subtle)] p-7 backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-[var(--landing-control)]`}
          >
            <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${s.bg} ${s.color} transition-transform duration-300 group-hover:scale-110`}>
              {s.icon}
            </div>
            <h3 className="mb-2 text-base font-bold text-[var(--landing-text-primary)]">{s.title}</h3>
            <p className="text-sm leading-relaxed text-[var(--landing-text-muted)]">{s.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Features ───────────────────────────────────────────────────────────── */

function FeaturesSection() {
  return (
    <section id="features" className="mx-auto w-full max-w-7xl border-t border-[color:var(--landing-border-soft)] px-6 py-24">
      <div className="mb-16">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[color:var(--landing-border)] bg-[var(--landing-control)] px-3 py-1.5 text-[12px] font-medium text-[var(--landing-text-muted)]">
          Features
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-[var(--landing-text-primary)] sm:text-5xl">
          Everything you need.{" "}
          <span className="text-[var(--landing-text-muted)]">Nothing you don&apos;t.</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
        {/* AI Organization — large */}
        <div className="landing-card group relative overflow-hidden rounded-[24px] border border-[color:var(--landing-border)] bg-[var(--landing-surface-soft)] p-8 backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-[var(--landing-control-hover)] md:col-span-7 sm:p-10">
          <div className="relative z-10 max-w-sm">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#6366f1]/20 text-[#818cf8]">
              <Brain className="h-5 w-5" />
            </div>
            <h3 className="mb-3 text-2xl font-bold text-[var(--landing-text-primary)]">AI-first organisation</h3>
            <p className="leading-relaxed text-[var(--landing-text-muted)]">
              No manual tagging. Gemini summarises every item, extracts tags, and builds semantic embeddings — silently, in the background.
            </p>
          </div>

          {/* Mini enrichment demo */}
          <div className="mt-8 space-y-2.5">
            <div className="rounded-[10px] border border-[color:var(--landing-border)] bg-[var(--landing-control)] p-3.5">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                <div className="h-2 w-36 rounded-full bg-[var(--landing-control-hover)]" />
                <div className="ml-auto text-[9px] text-[var(--landing-text-faint)]">enriching…</div>
              </div>
              <div className="mt-2 flex gap-1.5">
                <div className="h-4 w-10 rounded-full bg-[var(--landing-control)]" />
                <div className="h-4 w-14 rounded-full bg-[var(--landing-control)]" />
              </div>
            </div>
            <div className="rounded-[10px] border border-[#6366f1]/25 bg-[#6366f1]/5 p-3.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-[#818cf8]" />
                <span className="text-[11px] font-semibold text-[var(--landing-text-primary)]">React Compiler: A Deep Dive</span>
                <span className="ml-auto text-[9px] text-[#818cf8]">enriched</span>
              </div>
              <div className="mt-2 flex gap-1.5">
                {["react", "performance", "compiler"].map((t) => (
                  <span key={t} className="rounded-full bg-[#6366f1]/15 px-2 py-0.5 text-[9px] text-[#818cf8]">#{t}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-[-10%] right-[-10%] h-56 w-56 rounded-full bg-[#6366f1]/10 blur-[80px] transition-opacity group-hover:opacity-150" />
        </div>

        {/* Semantic Search */}
        <div className="landing-card group relative overflow-hidden rounded-[24px] border border-[color:var(--landing-border)] bg-[var(--landing-surface-soft)] p-8 backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-[var(--landing-control-hover)] md:col-span-5">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#38bdf8]/20 text-[#38bdf8]">
            <Search className="h-5 w-5" />
          </div>
          <h3 className="mb-3 text-2xl font-bold text-[var(--landing-text-primary)]">Semantic search</h3>
          <p className="leading-relaxed text-[var(--landing-text-muted)]">
            Find anything by meaning, not just keywords. &ldquo;That article about AI scaling&rdquo; just works.
          </p>

          {/* Mini search UI */}
          <div className="mt-7 space-y-2">
            <div className="flex items-center gap-2 rounded-lg border border-[color:var(--landing-border)] bg-[var(--landing-control)] px-3 py-2.5">
              <Search className="h-3 w-3 text-[var(--landing-text-faint)] shrink-0" />
              <span className="text-[12px] text-[var(--landing-text-muted)]">articles about AI scaling laws</span>
            </div>
            <div className="space-y-1.5 rounded-lg border border-[color:var(--landing-border-soft)] bg-[var(--landing-surface-soft)] p-2.5">
              {[
                { title: "Chinchilla scaling laws explained", score: "97%" },
                { title: "GPT-4 training compute analysis", score: "94%" },
              ].map(({ title, score }) => (
                <div key={title} className="flex items-center justify-between rounded-md bg-[var(--landing-control)] px-3 py-2">
                  <span className="text-[11px] font-medium text-[var(--landing-text-primary)]">{title}</span>
                  <span className="text-[10px] text-[#38bdf8]">{score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className="landing-card group relative overflow-hidden rounded-[24px] border border-[color:var(--landing-border)] bg-[var(--landing-surface-soft)] p-8 backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-[var(--landing-control-hover)] md:col-span-5">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e879f9]/20 text-[#e879f9]">
            <MessageSquare className="h-5 w-5" />
          </div>
          <h3 className="mb-3 text-2xl font-bold text-[var(--landing-text-primary)]">Chat with your archive</h3>
          <p className="leading-relaxed text-[var(--landing-text-muted)]">
            Ask questions across everything you&apos;ve saved. Cited answers stream directly from your content.
          </p>

          {/* Mini chat */}
          <div className="mt-7 space-y-2.5">
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[#6366f1] px-3.5 py-2.5 text-[11px] text-white">
                What did I read about Raft consensus?
              </div>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-[color:var(--landing-border)] bg-[var(--landing-control)] px-3.5 py-2.5 text-[11px] text-[var(--landing-text-mid)]">
                From your distributed systems notes: Raft elects leaders via randomised timeouts…
                <div className="mt-2 flex items-center gap-1 text-[9px] text-[#6366f1]">
                  <FileText className="h-2.5 w-2.5" />
                  distributed-systems-notes.pdf
                </div>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-[-10%] right-[-10%] h-48 w-48 rounded-full bg-[#e879f9]/10 blur-[80px]" />
        </div>

        {/* Knowledge Graph */}
        <div className="landing-card group relative overflow-hidden rounded-[24px] border border-[color:var(--landing-border)] bg-[var(--landing-surface-soft)] p-8 backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-[var(--landing-control-hover)] md:col-span-7 sm:p-10">
          <div className="flex flex-col gap-8 md:flex-row">
            <div className="flex-1">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#84cc16]/20 text-[#84cc16]">
                <Network className="h-5 w-5" />
              </div>
              <h3 className="mb-3 text-2xl font-bold text-[var(--landing-text-primary)]">Knowledge graph</h3>
              <p className="leading-relaxed text-[var(--landing-text-muted)]">
                AI-inferred connections surface automatically. Explore your archive as a force-directed graph and discover links you never noticed.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["AI-suggested edges", "150+ nodes", "Filter by strength"].map((f) => (
                  <span key={f} className="flex items-center gap-1.5 rounded-full border border-[color:var(--landing-border-soft)] bg-[var(--landing-control)] px-3 py-1 text-[11px] text-[var(--landing-text-mid)]">
                    <Check className="h-3 w-3 text-[#84cc16]" />
                    {f}
                  </span>
                ))}
              </div>
            </div>

            {/* Mini graph illustration */}
            <div className="flex flex-1 items-center justify-center">
              <svg viewBox="0 0 180 160" className="w-full max-w-[180px] opacity-70 group-hover:opacity-100 transition-opacity" aria-hidden>
                <defs>
                  <radialGradient id="ng" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#84cc16" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#84cc16" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <circle cx="90" cy="80" r="60" fill="url(#ng)" />
                {/* edges */}
                {[
                  [90, 80, 40, 35], [90, 80, 145, 30], [90, 80, 155, 100],
                  [90, 80, 45, 130], [90, 80, 120, 145], [40, 35, 145, 30],
                ].map(([x1, y1, x2, y2], i) => (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#84cc16" strokeOpacity="0.2" strokeWidth="1" />
                ))}
                {/* center node */}
                <circle cx="90" cy="80" r="10" fill="#84cc16" fillOpacity="0.9" />
                <circle cx="90" cy="80" r="14" fill="none" stroke="#84cc16" strokeOpacity="0.3" strokeWidth="1" className="animate-pulse-ring" />
                {/* outer nodes */}
                {[
                  { cx: 40, cy: 35, r: 6, color: "#38bdf8" },
                  { cx: 145, cy: 30, r: 5, color: "#e879f9" },
                  { cx: 155, cy: 100, r: 7, color: "#6366f1" },
                  { cx: 45, cy: 130, r: 5, color: "#fb923c" },
                  { cx: 120, cy: 145, r: 6, color: "#818cf8" },
                ].map(({ cx, cy, r, color }) => (
                  <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={color} fillOpacity="0.8" />
                ))}
              </svg>
            </div>
          </div>
        </div>

        {/* Reminders */}
        <div className="landing-card group relative overflow-hidden rounded-[24px] border border-[color:var(--landing-border)] bg-[var(--landing-surface-soft)] p-8 backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-[var(--landing-control-hover)] md:col-span-4">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#facc15]/20 text-[#facc15]">
            <Bell className="h-5 w-5" />
          </div>
          <h3 className="mb-3 text-xl font-bold text-[var(--landing-text-primary)]">Smart reminders</h3>
          <p className="text-sm leading-relaxed text-[var(--landing-text-muted)]">
            Say &ldquo;remind me this on Friday&rdquo; and it happens. Delivered via Email, Telegram, or web push.
          </p>
          <div className="mt-6 rounded-[10px] border border-[#facc15]/20 bg-[#facc15]/5 px-4 py-3">
            <div className="flex items-center gap-2 text-[11px] text-[#facc15]">
              <Bell className="h-3 w-3" />
              <span className="font-medium">React Compiler article</span>
            </div>
            <div className="mt-1 text-[10px] text-[var(--landing-text-muted)]">Tomorrow · 9:00 AM · via Telegram + Email</div>
          </div>
        </div>

        {/* Freemium */}
        <div className="landing-card group relative overflow-hidden rounded-[24px] border border-[color:var(--landing-border)] bg-[var(--landing-surface-soft)] p-8 backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-[var(--landing-control-hover)] md:col-span-8">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fb923c]/20 text-[#fb923c]">
            <Link2 className="h-5 w-5" />
          </div>
          <h3 className="mb-3 text-2xl font-bold text-[var(--landing-text-primary)]">Open source · Self-hostable · Freemium SaaS</h3>
          <p className="leading-relaxed text-[var(--landing-text-muted)]">
            The full source is public (MIT). Deploy on your own VPS with PM2 + Caddy in under 15 minutes. Or use the hosted version — free tier covers casual use, annual plans unlock the power features.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── Pricing ────────────────────────────────────────────────────────────── */

function PricingSection() {
  const plans = [
    {
      name: "Free",
      price: "₹0",
      period: "forever",
      description: "For light personal use and trying out the product.",
      cta: "Start for free",
      href: "/app",
      highlighted: false,
      features: [
        "50 saves / month",
        "100 MB file storage",
        "20 AI chat queries / day",
        "2 active reminders",
        "Semantic search",
        "Knowledge graph",
        "Telegram + PWA capture",
        "Community support",
      ],
    },
    {
      name: "Starter",
      price: "₹29",
      period: "/ year",
      description: "For regular users who capture daily.",
      cta: "Get Starter",
      href: "/app",
      highlighted: true,
      badge: "Most popular",
      features: [
        "100 saves / month",
        "1 GB file storage",
        "50 AI chat queries / day",
        "30 active reminders",
        "Everything in Free",
        "Email forwarding capture",
        "Priority enrichment queue",
        "Email support",
      ],
    },
    {
      name: "Pro",
      price: "₹99",
      period: "/ year",
      description: "For power users and knowledge workers.",
      cta: "Get Pro",
      href: "/app",
      highlighted: false,
      features: [
        "Unlimited saves",
        "10 GB file storage",
        "Unlimited AI chat",
        "Unlimited reminders",
        "Everything in Starter",
        "Largest file uploads (50 MB)",
        "Bulk import & export",
        "Priority support",
      ],
    },
  ];

  return (
    <section id="pricing" className="mx-auto w-full max-w-7xl border-t border-[color:var(--landing-border-soft)] px-6 py-24">
      <div className="mb-16 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[color:var(--landing-border)] bg-[var(--landing-control)] px-3 py-1.5 text-[12px] font-medium text-[var(--landing-text-muted)]">
          Pricing
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-[var(--landing-text-primary)] sm:text-5xl">
          Simple, annual pricing.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-[var(--landing-text-muted)]">
          Free tier for the basics. Annual plans for the full power. Self-hosters pay nothing — ever.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`landing-card relative flex flex-col rounded-[24px] border p-8 transition-all ${
              plan.highlighted
                ? "border-[#6366f1]/50 bg-[#6366f1]/[0.06] shadow-[0_0_60px_-20px_rgba(99,102,241,0.3)]"
                : "border-[color:var(--landing-border)] bg-[var(--landing-surface-soft)] backdrop-blur hover:-translate-y-0.5 hover:bg-[var(--landing-control-hover)]"
            }`}
          >
            {"badge" in plan && plan.badge ? (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#6366f1] px-4 py-1 text-[11px] font-bold text-white shadow-[0_0_20px_-4px_rgba(99,102,241,0.6)]">
                {plan.badge}
              </div>
            ) : null}

            <div className="mb-8">
              <div className="mb-1 text-sm font-semibold text-[var(--landing-text-mid)]">{plan.name}</div>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-black text-[var(--landing-text-primary)]">{plan.price}</span>
                <span className="mb-1 text-sm text-[var(--landing-text-muted)]">{plan.period}</span>
              </div>
              <p className="mt-3 text-sm text-[var(--landing-text-muted)]">{plan.description}</p>
            </div>

            <ul className="mb-8 flex-1 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-[var(--landing-text-mid)]">
                  <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.highlighted ? "text-[#818cf8]" : "text-[var(--landing-text-muted)]"}`} />
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href={plan.href}
              className={`flex items-center justify-center gap-2 rounded-full py-3 text-sm font-bold transition-all active:scale-95 ${
                plan.highlighted
                  ? "bg-[#6366f1] text-white shadow-[0_0_28px_-4px_rgba(99,102,241,0.5)] hover:bg-[#818cf8]"
                  : "border border-[color:var(--landing-border)] bg-[var(--landing-control)] text-[var(--landing-text-primary)] hover:bg-[var(--landing-control-hover)]"
              }`}
            >
              {plan.cta}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-[var(--landing-text-muted)]">
        Self-hosting? Clone the repo and run for free.{" "}
        <Link href="https://github.com/uvesarshad/recallQ" className="text-[#818cf8] hover:underline">
          Deploy guide →
        </Link>
      </p>
    </section>
  );
}

/* ─── CTA ────────────────────────────────────────────────────────────────── */

function CtaSection() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 py-24">
      <div className="landing-card relative overflow-hidden rounded-[32px] border border-[#6366f1]/20 bg-[image:var(--landing-cta-gradient)] p-14 text-center backdrop-blur sm:p-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.15),transparent_70%)]" />
        <div className="relative z-10">
          <h2 className="mb-4 text-4xl font-black tracking-tight text-[var(--landing-text-primary)] sm:text-6xl">
            Start building your<br />second brain today.
          </h2>
          <p className="mx-auto mb-10 max-w-lg text-lg text-[var(--landing-text-mid)]">
            Free forever for casual use. Annual plans from ₹29/year.
            Open source and self-hostable if you want full control.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/app"
              className="flex items-center gap-2 rounded-full bg-[#6366f1] px-10 py-3.5 text-[15px] font-bold text-white shadow-[0_0_40px_-6px_rgba(99,102,241,0.55)] transition-all hover:-translate-y-0.5 hover:bg-[#818cf8] hover:shadow-[0_0_52px_-6px_rgba(99,102,241,0.65)] active:scale-95"
            >
              Get started — it&apos;s free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="https://github.com/uvesarshad/recallQ"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full border border-[color:var(--landing-border)] bg-[var(--landing-control)] px-10 py-3.5 text-[15px] font-bold text-[var(--landing-text-primary)] transition-all hover:bg-[var(--landing-control-hover)] active:scale-95"
            >
              Self-host for free
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ─────────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-[color:var(--landing-border-soft)] bg-[var(--landing-bg)] px-6 py-16">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="mb-4 flex items-center gap-2.5">
            <Brain className="h-5 w-5 text-[#818cf8]" />
            <span className="text-lg font-bold tracking-tight text-[var(--landing-text-primary)]">Recall</span>
          </div>
          <p className="mb-6 max-w-xs text-sm leading-relaxed text-[var(--landing-text-muted)]">
            The intelligent second brain for knowledge workers. Capture, enrich, and recall anything — from any surface.
          </p>
          <Link
            href="https://github.com/uvesarshad/recallQ"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--landing-border)] bg-[var(--landing-control)] px-4 py-2 text-sm text-[var(--landing-text-mid)] transition-colors hover:bg-[var(--landing-control-hover)] hover:text-[var(--landing-text-primary)]"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Star on GitHub
          </Link>
        </div>

        <div>
          <h4 className="mb-5 text-[11px] font-bold uppercase tracking-widest text-[var(--landing-text-muted)]">Product</h4>
          <ul className="space-y-3">
            {[
              { href: "#features", label: "Features" },
              { href: "#how-it-works", label: "How it works" },
              { href: "#pricing", label: "Pricing" },
              { href: "/app", label: "Open app" },
            ].map(({ href, label }) => (
              <li key={label}>
                <Link href={href} className="text-sm text-[var(--landing-text-muted)] transition-colors hover:text-[var(--landing-text-primary)]">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-5 text-[11px] font-bold uppercase tracking-widest text-[var(--landing-text-muted)]">Legal</h4>
          <ul className="space-y-3">
            {[
              { href: "https://github.com/uvesarshad/recallQ", label: "Open source (MIT)" },
              { href: "/privacy", label: "Privacy" },
              { href: "/terms", label: "Terms" },
            ].map(({ href, label }) => (
              <li key={label}>
                <Link href={href} className="text-sm text-[var(--landing-text-muted)] transition-colors hover:text-[var(--landing-text-primary)]">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-16 flex max-w-7xl flex-col items-center justify-between gap-4 border-t border-[color:var(--landing-border-soft)] pt-8 sm:flex-row">
        <p className="text-[13px] text-[var(--landing-text-muted)]">© {new Date().getFullYear()} Recall. Open source, MIT licensed.</p>
        <p className="text-[13px] text-[var(--landing-text-muted)]">v1.0.0-beta</p>
      </div>
    </footer>
  );
}

