import Link from "next/link";
import Image from "next/image";
import { 
  ArrowRight, Brain, Zap, Network, Search, 
  MessageSquare, Mail, Sparkles, CheckCircle2 
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary selection:bg-brand selection:text-white flex flex-col font-sans overflow-x-hidden transition-colors duration-300">
      
      {/* Background Blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-brand-glow blur-[120px] animate-blob"></div>
        <div className="absolute top-[20%] right-[5%] w-[35%] h-[35%] rounded-full bg-item-link opacity-10 blur-[120px] animate-blob" style={{ animationDelay: "2s" }}></div>
        <div className="absolute -bottom-[20%] left-[20%] w-[50%] h-[50%] rounded-full bg-brand/10 blur-[150px] animate-blob" style={{ animationDelay: "4s" }}></div>
      </div>

      <Navbar />

      <main className="flex-1 flex flex-col">
        <HeroSection />
        <HowItWorksSection />
        <FeaturesSection />
        <UseCasesSection />
        <CtaSection />
      </main>

      <Footer />
    </div>
  );
}

function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border-soft bg-surface/70 backdrop-blur-md transition-colors duration-300">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-brand" />
          <span className="text-xl font-semibold tracking-tight text-text-primary">Recall</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/app/login" className="text-sm font-medium text-text-primary hover:text-brand transition-colors">
            Sign In
          </Link>
          <Link
            href="/app"
            className="flex items-center gap-1 rounded-buttons bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover hover:shadow-md transition-all active:scale-95"
          >
            Go to App
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative pt-24 pb-20 sm:pt-32 sm:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full text-center flex flex-col items-center z-10">
      <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 rounded-full border border-border-soft bg-surface-2/50 backdrop-blur-sm text-sm text-text-mid font-medium shadow-sm">
        <span className="flex h-2 w-2 rounded-full bg-brand animate-pulse" />
        New: Automatic AI Enrichment
      </div>
      
      <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-text-primary max-w-4xl leading-[1.1] mb-8">
        Your Second Brain, <br className="hidden sm:block" />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand to-item-media">Powered by AI.</span>
      </h1>
      
      <p className="text-lg sm:text-xl text-text-mid max-w-2xl mb-10 font-medium leading-relaxed">
        Frictionless capture from anywhere. Deep organization using a massive knowledge graph. 
        Save thoughts, links, and files without thinking twice.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-4 mb-20 w-full sm:w-auto">
        <Link
          href="/app"
          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-buttons bg-brand px-8 py-3.5 text-base font-semibold text-white shadow-lg hover:shadow-brand/25 hover:-translate-y-0.5 hover:bg-brand-hover transition-all active:scale-95"
        >
          Start Exploring <ArrowRight className="h-5 w-5" />
        </Link>
        <Link
          href="https://github.com/uvesarshad/recallQ"
          target="_blank"
          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-buttons bg-surface shadow-sm border border-border-soft px-8 py-3.5 text-base font-medium text-text-primary hover:bg-surface-2 hover:border-border transition-all active:scale-95"
        >
          View on GitHub
        </Link>
      </div>

      {/* Hero Mockup */}
      <div className="w-full relative mx-auto max-w-[1200px] rounded-[18px] sm:rounded-[34px] p-2 sm:p-4 bg-gradient-to-b from-border-soft/60 to-transparent shadow-2xl">
        <div className="w-full rounded-xl sm:rounded-[24px] overflow-hidden border border-border outline outline-1 outline-border-soft/50 bg-bg shadow-inner relative">
          <Image 
            src="/hero-mockup.png" 
            alt="Recall App Interface" 
            width={1200} 
            height={700}
            className="w-full object-cover transition-transform duration-700 hover:scale-[1.01]"
            priority
          />
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      title: "1. Capture Anywhere",
      description: "Send a message on Telegram, forward an email, or paste a link. We put data ingestion where you already hang out.",
      icon: <MessageSquare className="h-6 w-6 text-item-link" />,
      color: "bg-item-link/10 text-item-link"
    },
    {
      title: "2. AI Enriches It",
      description: "Behind the scenes, Gemini AI reads your content, extracts a summary, generates tags, and creates semantic embeddings.",
      icon: <Sparkles className="h-6 w-6 text-item-media" />,
      color: "bg-item-media/10 text-item-media"
    },
    {
      title: "3. Connect & Recall",
      description: "Your item appears in the infinite knowledge graph. Discover new connections and chat fluidly with your entire archive.",
      icon: <Network className="h-6 w-6 text-brand" />,
      color: "bg-brand/10 text-brand"
    }
  ];

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full relative z-10 border-t border-border-soft/50">
      <div className="text-center mb-16">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary mb-4">
          How Recall Works
        </h2>
        <p className="text-lg text-text-mid max-w-2xl mx-auto">
          No rigid folders. No mandatory tags. Just send it and forget it.
        </p>
      </div>

      <AnimatedFlowDiagram />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {steps.map((step, idx) => (
          <div key={idx} className="relative p-8 rounded-[20px] bg-surface/30 border border-border-soft hover:bg-surface/60 transition-colors duration-300">
            <div className={`inline-flex items-center justify-center p-3 rounded-xl mb-6 ${step.color}`}>
              {step.icon}
            </div>
            <h3 className="text-xl font-semibold text-text-primary mb-3">
              {step.title}
            </h3>
            <p className="text-text-mid leading-relaxed">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AnimatedFlowDiagram() {
  return (
    <div className="w-full max-w-4xl mx-auto mb-16 relative py-10 hidden sm:block">
      {/* Container to hold the steps horizontally */}
      <div className="flex items-center justify-between px-10 relative z-10">
        
        {/* Step 1: Capture */}
        <div className="relative flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center relative z-20 shadow-sm">
            <MessageSquare className="h-6 w-6 text-item-link" />
          </div>
          <p className="mt-4 font-semibold text-text-primary">1. Capture</p>
        </div>

        {/* Step 2: Enrich */}
         <div className="relative flex flex-col items-center">
          <div className="absolute inset-0 bg-brand/40 rounded-2xl animate-pulse-ring z-10"></div>
          <div className="w-16 h-16 rounded-2xl bg-surface border border-brand/50 flex items-center justify-center relative z-20 shadow-lg shadow-brand/20">
            <Sparkles className="h-6 w-6 text-brand" />
          </div>
          <p className="mt-4 font-semibold text-text-primary">2. Enrich</p>
        </div>

        {/* Step 3: Graph */}
         <div className="relative flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center relative z-20 shadow-sm">
            <Network className="h-6 w-6 text-item-note" />
          </div>
          <p className="mt-4 font-semibold text-text-primary">3. Network</p>
        </div>
      </div>

      {/* Connecting animated dashed line */}
      <svg className="absolute top-1/2 left-0 w-full h-[2px] -translate-y-1/2 -mt-4 z-0" preserveAspectRatio="none">
        {/* Base sub-track */}
        <line x1="80" y1="0" x2="calc(100% - 80px)" y2="0" stroke="currentColor" className="text-border-soft" strokeWidth="2" />
        {/* Flowing dashes */}
        <line x1="80" y1="0" x2="calc(100% - 80px)" y2="0" stroke="currentColor" className="text-brand animate-flow-line" strokeWidth="2" strokeDasharray="8 8" />
      </svg>
    </div>
  );
}

function FeaturesSection() {
  const features = [
    {
      title: "Frictionless Capture",
      description: "Save items via web, email, or a Telegram bot. Your knowledge is strictly one keystroke away.",
      icon: <Zap className="h-6 w-6 text-item-file" />,
      color: "bg-item-file/10 border-item-file/20"
    },
    {
      title: "AI Enrichment",
      description: "Every item is automatically summarized, categorized, and tagged. Don't waste time on manual metadata.",
      icon: <Brain className="h-6 w-6 text-brand" />,
      color: "bg-brand/10 border-brand/20"
    },
    {
      title: "Infinite Knowledge Graph",
      description: "Visualize your entire workspace. Find unexpected connections between completely different thoughts.",
      icon: <Network className="h-6 w-6 text-item-note" />,
      color: "bg-item-note/10 border-item-note/20"
    },
    {
      title: "Semantic Vector Search",
      description: "Search by meaning, not just exact keywords. instantly recall anything you have ever seen.",
      icon: <Search className="h-6 w-6 text-item-link" />,
      color: "bg-item-link/10 border-item-link/20"
    }
  ];

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full relative z-10 border-t border-border-soft/50">
      <div className="text-center mb-16">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary mb-4">
          Everything You Need, Automatically
        </h2>
        <p className="text-lg text-text-mid max-w-2xl mx-auto">
          Built for speed and density. Recall stays out of your way until you need it.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        {features.map((f, idx) => (
          <div key={idx} className="group relative p-8 rounded-[20px] bg-surface/50 border border-border-soft hover:border-border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden backdrop-blur-sm">
            <div className={`inline-flex items-center justify-center p-3 rounded-xl mb-6 ${f.color} transition-colors duration-300`}>
              {f.icon}
            </div>
            <h3 className="text-xl font-semibold text-text-primary mb-3">
              {f.title}
            </h3>
            <p className="text-text-mid leading-relaxed">
              {f.description}
            </p>
            
            {/* Subtle hover gradient inside card */}
            <div className="absolute -inset-[100%] z-[0] opacity-0 group-hover:opacity-10 transition-opacity duration-700 bg-gradient-to-br from-transparent to-brand blur-3xl rounded-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

function UseCasesSection() {
  const cases = [
    "Researchers managing thousands of academic papers and notes",
    "Developers saving code snippets, bug fixes, and documentation links",
    "Writers collecting inspiration, quotes, and rough drafts",
    "Students organizing lecture materials and study resources",
    "Curious minds who want a private Wikipedia for their own thoughts"
  ];

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full relative z-10 border-t border-border-soft/50">
      <div className="bg-brand-glow/30 border border-brand/20 rounded-[24px] p-8 sm:p-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-8 text-center">
          Who is Recall for?
        </h2>
        <div className="flex flex-col gap-4">
          {cases.map((c, idx) => (
            <div key={idx} className="flex items-start gap-4">
              <CheckCircle2 className="h-6 w-6 text-brand shrink-0 mt-0.5" />
              <p className="text-lg text-text-primary">{c}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full text-center z-10 border-t border-border-soft/50">
      <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-text-primary mb-6">
        Ready to expand your mind?
      </h2>
      <p className="text-lg text-text-mid max-w-2xl mx-auto mb-10">
        Join the open-source movement of private, intelligent knowledge management.
        Deploy your own instance or try it out right now.
      </p>
      <div className="flex justify-center">
        <Link
          href="/app"
          className="flex items-center gap-2 rounded-buttons bg-brand px-10 py-4 text-lg font-semibold text-white shadow-lg hover:shadow-brand/25 hover:-translate-y-0.5 hover:bg-brand-hover transition-all active:scale-95"
        >
          Get Started for Free <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border-soft bg-surface py-12 px-4 text-center z-10 mt-12 transition-colors duration-300">
      <div className="max-w-7xl mx-auto flex flex-col items-center">
        <div className="flex items-center gap-2 mb-6 opacity-80">
          <Brain className="h-5 w-5 text-text-muted" />
          <span className="text-lg font-semibold text-text-muted tracking-tight">Recall</span>
        </div>
        <p className="text-sm text-text-muted mb-4">
          © {new Date().getFullYear()} Recall. Open Source Personal Knowledge Management.
        </p>
        <div className="flex gap-6 text-sm font-medium">
          <Link href="https://github.com/uvesarshad/recallQ" className="text-text-muted hover:text-text-primary transition-colors">GitHub</Link>
          <Link href="/app/login" className="text-text-muted hover:text-text-primary transition-colors">Sign In</Link>
        </div>
      </div>
    </footer>
  );
}
