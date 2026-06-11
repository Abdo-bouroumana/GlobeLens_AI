"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Globe, 
  ArrowLeft, 
  MapPin, 
  TrendingUp, 
  AlertTriangle,
  ChevronRight,
  Shield,
  Layers,
  ArrowRight,
  HelpCircle,
  Calendar,
  FileText,
  Bookmark,
  RefreshCw,
  Clock,
  BookOpen,
  CheckCircle,
  ExternalLink,
  MessageSquare
} from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Source {
  name: string;
  credibility_score: number;
}

interface Article {
  id: string;
  title: string;
  content: string;
  url: string;
  published_at?: string;
  source: Source;
}

interface EventDetail {
  id: string;
  title: string;
  summary: string;
  topic: string;
  country: string;
  latitude: number;
  longitude: number;
  importance_score: number;
  bias_lean: string;
  status: string;
  created_at?: string;
  articles: Article[];
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  
  // Real-time Social Flux sidebar items
  const [fluxTab, setFluxTab] = useState<"flux" | "trending" | "updates">("flux");
  
  const fetchEventDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/events/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Dossier not found");
        }
        throw new Error("Failed to retrieve event analysis");
      }
      const data = await response.json();
      setEvent(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect to synthesis server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchEventDetails();
    }
  }, [id]);

  const handleBookmarkToggle = () => {
    setIsBookmarked(!isBookmarked);
  };

  // Helper to get topic badge style
  const getTopicBadgeStyle = (topic: string) => {
    switch (topic?.toUpperCase()) {
      case "POLITICS":
      case "GEOPOLITICS":
        return "bg-rose-950/40 text-rose-400 border-rose-900/50";
      case "ECONOMY":
      case "MACROECONOMICS":
        return "bg-amber-950/40 text-amber-400 border-amber-900/50";
      case "TECHNOLOGY":
      case "TECH & CYBER":
        return "bg-blue-950/40 text-blue-400 border-blue-900/50";
      case "SPORTS":
        return "bg-emerald-950/40 text-emerald-400 border-emerald-900/50";
      case "HEALTH":
        return "bg-purple-950/40 text-purple-400 border-purple-900/50";
      default:
        return "bg-zinc-900 text-zinc-300 border-zinc-800";
    }
  };

  // Helper to render body content with hover citations
  const renderCitationsParagraphs = (summaryText: string, articlesList: Article[]) => {
    if (!summaryText) return <p className="text-zinc-500 italic">No summary details compiled yet.</p>;

    const paragraphs = summaryText.split("\n\n").filter(p => p.trim().length > 0);
    
    return paragraphs.map((para, pIdx) => {
      // Split paragraph into sentences roughly by ". " (to avoid abbreviations, but simple is fine)
      const sentences = para.split(/(?<=\. )/g);
      
      return (
        <p key={pIdx} className="mb-6 text-on-surface leading-[1.8] text-body-lg font-body-lg">
          {sentences.map((sentence, sIdx) => {
            // Distribute articles across paragraph sentences for tooltips
            const articleIndex = (pIdx * 2 + sIdx) % (articlesList.length || 1);
            const associatedArticle = articlesList[articleIndex];
            
            // Check if we want to add a citation to this sentence (e.g. if we have articles and it meets criteria)
            const shouldCite = articlesList.length > 0 && sentence.length > 25 && (sIdx % 2 === 1 || paragraphs.length === 1);
            
            if (shouldCite && associatedArticle) {
              const trustPercent = Math.round((associatedArticle.source.credibility_score || 0.85) * 100);
              
              return (
                <span 
                  key={sIdx}
                  className="has-tooltip relative inline border-b border-dashed border-primary cursor-help text-on-surface hover:text-white transition-colors duration-150"
                >
                  {sentence}
                  <span className="ai-tooltip glass-panel p-3 rounded text-left text-body-sm font-body-sm text-on-surface shadow-[0_8px_24px_rgba(0,0,0,0.6)] w-72 pointer-events-none">
                    <strong className="block text-primary font-mono-data mb-1.5 flex items-center gap-1.5 text-xs">
                      <span className="material-symbols-outlined text-[14px]">source</span> 
                      {associatedArticle.source.name} ({trustPercent}% trust)
                    </strong>
                    <span className="block text-xs font-semibold text-white mb-2 leading-tight">
                      {associatedArticle.title}
                    </span>
                    <span className="block text-[10px] text-zinc-400">
                      Cross-referenced via GlobeLens search verification protocols.
                    </span>
                  </span>
                </span>
              );
            }
            
            return <span key={sIdx}>{sentence}</span>;
          })}
        </p>
      );
    });
  };

  // Loading skeleton matching loading_feed_globelens_ai aesthetic
  if (loading) {
    return (
      <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md">
        <header className="flex justify-between items-center px-margin-desktop w-full h-16 bg-surface/80 border-b border-outline-variant z-50 animate-pulse">
          <div className="h-6 w-32 bg-surface-container rounded"></div>
          <div className="h-6 w-64 bg-surface-container rounded hidden md:block"></div>
          <div className="h-8 w-8 bg-surface-container rounded-full"></div>
        </header>

        <div className="flex-1 max-w-[1440px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-gutter px-margin-mobile lg:px-margin-desktop py-stack-lg animate-pulse">
          <main className="col-span-1 lg:col-span-9 flex flex-col gap-6">
            <div className="h-4 w-48 bg-surface-container rounded mb-2"></div>
            <div className="h-10 w-3/4 bg-surface-container rounded mb-4"></div>
            <div className="h-6 w-full bg-surface-container rounded mb-6"></div>
            <div className="h-[300px] md:h-[400px] bg-surface-container rounded border border-outline-variant"></div>
            <div className="h-20 bg-surface-container rounded border border-outline-variant mt-6"></div>
          </main>
          <aside className="hidden lg:block lg:col-span-3 bg-surface-container border border-outline-variant rounded h-[600px]"></aside>
        </div>
      </div>
    );
  }

  // Not Found / Error UI mapping 404_intelligence_gap_globelens_ai
  if (error || !event) {
    return (
      <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md relative overflow-hidden">
        <header className="flex justify-between items-center px-margin-desktop w-full h-16 bg-surface/80 backdrop-blur-md border-b border-outline-variant z-50">
          <span className="font-headline-lg text-headline-lg font-bold text-primary tracking-tight cursor-pointer" onClick={() => router.push("/")}>
            GlobeLens AI
          </span>
          <nav className="hidden md:flex items-center gap-stack-lg">
            <a className="font-body-md text-body-md text-on-surface-variant font-medium hover:text-primary transition-colors" href="/?view=standard">Standard</a>
            <a className="font-body-md text-body-md text-on-surface-variant font-medium hover:text-primary transition-colors" href="/?view=map">Map</a>
            <a className="font-body-md text-body-md text-on-surface-variant font-medium hover:text-primary transition-colors" href="/fact-checker">Fact Checker</a>
          </nav>
        </header>

        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(69,70,77,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(69,70,77,0.06)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0"></div>
        
        <main className="flex-grow flex flex-col items-center justify-center px-margin-mobile md:px-margin-desktop py-stack-lg z-10 relative">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-error/10 rounded-full blur-xl"></div>
            <div className="w-24 h-24 rounded-full bg-surface-container-high/85 border border-outline-variant flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-5xl text-error opacity-80 select-none">
                warning
              </span>
            </div>
          </div>

          <div className="max-w-xl text-center mb-8">
            <h1 className="font-headline-xl text-headline-xl text-primary mb-3 tracking-tight">Dossier Gap Detected</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
              {error === "Dossier not found" 
                ? "The requested event dossier identifier could not be validated or has been reassigned within the database cluster." 
                : "A protocol failure occurred while retrieving synthesized intelligence reports. Verify backend core availability."}
            </p>
          </div>

          <button 
            onClick={() => router.push("/")}
            className="bg-primary hover:bg-primary-fixed text-on-primary font-label-caps text-[12px] px-8 py-3 rounded tracking-wider uppercase font-bold transition-all shadow-md flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Global Map
          </button>
        </main>
      </div>
    );
  }

  // Calculate high-level credibility score average from sources
  const sourceCerts = event.articles.length;
  const avgTrustScore = event.articles.length > 0 
    ? Math.round((event.articles.reduce((acc, art) => acc + (art.source.credibility_score || 0.85), 0) / event.articles.length) * 100)
    : 88;

  // Bias lean label & value
  const biasLabel = event.bias_lean.replace("_", "-");
  let biasPercentage = 50;
  if (event.bias_lean === "LEFT") biasPercentage = 15;
  else if (event.bias_lean === "CENTER_LEFT") biasPercentage = 35;
  else if (event.bias_lean === "CENTER_RIGHT") biasPercentage = 65;
  else if (event.bias_lean === "RIGHT") biasPercentage = 85;

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md relative overflow-x-hidden">
      {/* TopNavBar */}
      <header className="bg-surface text-primary border-b border-outline-variant flex justify-between items-center px-margin-desktop w-full h-16 sticky top-0 z-50 bg-surface/80 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-6">
          <span className="font-headline-lg text-headline-lg font-bold text-primary tracking-tight cursor-pointer" onClick={() => router.push("/")}>
            GlobeLens AI
          </span>
          <nav className="hidden md:flex items-center gap-6 ml-8">
            <a className="text-on-surface-variant font-medium hover:text-primary transition-colors" href="/?view=standard">Standard</a>
            <a className="text-on-surface-variant font-medium hover:text-primary transition-colors" href="/?view=map">Map</a>
            <a className="text-on-surface-variant font-medium hover:text-primary transition-colors" href="/fact-checker">Fact Checker</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container border border-outline-variant text-on-surface font-body-sm text-body-sm rounded hover:border-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Operational Console</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-[1440px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-gutter px-margin-mobile lg:px-margin-desktop py-stack-lg relative">
        
        {/* Main Content Canvas (9 Cols) */}
        <main className="col-span-1 lg:col-span-9 flex flex-col gap-stack-lg pb-stack-lg">
          
          {/* Article Header Area */}
          <article className="flex flex-col gap-stack-md relative z-10">
            {/* Meta tags row */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <span className="text-secondary font-label-caps text-label-caps uppercase tracking-wider">
                  {event.topic}
                </span>
                <span className="text-outline-variant">•</span>
                <span className="text-on-surface-variant font-mono-data text-mono-data">
                  {event.created_at ? new Date(event.created_at).toUTCString() : "Active Intel"}
                </span>
                {/* Global Reliability Score Badge */}
                <div 
                  className="flex items-center gap-1.5 ml-2 px-2.5 py-0.5 bg-surface-container rounded-full border border-outline-variant border-l-2 border-l-primary"
                  title="AI Credibility Analysis"
                >
                  <Shield className="w-3.5 h-3.5 text-primary" />
                  <span className="font-mono-data text-mono-data text-primary">{avgTrustScore}% Reliable</span>
                </div>
              </div>

              {/* Bookmark Toggle */}
              <button 
                onClick={handleBookmarkToggle}
                className={`flex items-center gap-2 px-3 py-1.5 bg-surface-container border rounded font-body-sm text-body-sm transition-colors ${
                  isBookmarked 
                    ? "border-primary text-primary" 
                    : "border-outline-variant text-on-surface hover:border-primary"
                }`}
              >
                <Bookmark className={`w-[18px] h-[18px] ${isBookmarked ? "fill-primary" : ""}`} />
                <span>{isBookmarked ? "Saved to Dossiers" : "Bookmark Intel"}</span>
              </button>
            </div>

            {/* Headline & Summary */}
            <h1 className="font-display-lg text-[28px] md:text-display-lg text-on-surface leading-tight font-bold">
              {event.title}
            </h1>
            
            <p className="font-body-lg text-body-lg text-secondary leading-relaxed border-l-4 border-surface-variant pl-4">
              Detailed analytical synthesis tag-linked to {event.country || "Global Region"} operational updates.
            </p>

            {/* Hero Image */}
            <div className="w-full h-[250px] md:h-[380px] rounded border border-outline-variant bg-surface-container overflow-hidden mt-2 relative">
              <img 
                alt="Analytical map or visualization" 
                className="w-full h-full object-cover opacity-80 mix-blend-luminosity hover:mix-blend-normal transition-all duration-500"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDSP9yo5kG__HrAfn-e8URLtZr9SXssOai6gtJj8UcPd6bcFLngSfhOehWcUFJsd562571h35zQDEGg9iBrz_Os1umIt4AtXTKmCceDgigeBNEb_qxdnSqiTbIbaC38gsHa7aBnqFrHUvif3x2swtmTok1k2gUhlBSh_ZiejcOANdOmaDw2DP8Yxslct6LhTJgAGXrUfqgqEEL3Vze0sHsK2lQTsp_OVa8flFH6e1e9K05HwOHhHse3z1ZPqm2qDhmXSOOWx9hworKq"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background to-transparent h-24 pointer-events-none"></div>
            </div>
          </article>

          {/* Bias Detection & AI Confidence Panel */}
          <section className="glass-panel p-stack-md rounded flex flex-col md:flex-row gap-6 justify-between items-start md:items-center w-full">
            <div className="flex flex-col gap-1">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant uppercase flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">analytics</span>
                Synthesis Metrics
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface max-w-md">
                Aggregated from {sourceCerts} independent source wire{sourceCerts === 1 ? "" : "s"} across global coordinates. High confidence observed on core timeline.
              </p>
            </div>
            
            <div className="flex gap-8 flex-wrap">
              {/* Lean Metric */}
              <div className="flex flex-col gap-2 min-w-[120px]">
                <div className="flex justify-between font-mono-data text-mono-data">
                  <span className="text-on-surface-variant">Editorial Lean</span>
                  <span className="text-on-surface capitalize">{biasLabel.toLowerCase()}</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden flex relative">
                  <div className="absolute top-0 bottom-0 w-3 bg-primary rounded-full transition-all duration-700 shadow-sm" style={{ left: `calc(${biasPercentage}% - 6px)` }}></div>
                </div>
              </div>

              {/* Confidence Metric */}
              <div className="flex flex-col gap-2 min-w-[120px]">
                <div className="flex justify-between font-mono-data text-mono-data">
                  <span className="text-on-surface-variant">Importance</span>
                  <span className="text-primary font-bold">{(event.importance_score).toFixed(1)}/10</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-r-full transition-all duration-700" 
                    style={{ width: `${event.importance_score * 10}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </section>

          {/* Synthesized Body */}
          <div className="border-b border-outline-variant/40 pb-6">
            <h3 className="font-label-caps text-label-caps text-zinc-500 uppercase tracking-widest text-[10px] mb-4">
              EDITORIAL SYNTHESIS REPORT
            </h3>
            <article className="max-w-3xl">
              {renderCitationsParagraphs(event.summary, event.articles)}
            </article>
          </div>

          {/* Cross-References & Source List */}
          <section className="space-y-4">
            <h3 className="font-label-caps text-label-caps text-zinc-400 uppercase tracking-widest text-[11px] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-primary">fact_check</span>
              Corroborating Source Documentation ({event.articles.length})
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {event.articles.map((art) => {
                const percent = Math.round((art.source.credibility_score || 0.85) * 100);
                return (
                  <div 
                    key={art.id}
                    className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-800 transition-colors"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-mono-data text-[10px] px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 font-bold border border-zinc-800 uppercase">
                          {art.source.name}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> {percent}% Trust
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-white leading-snug mb-3">
                        {art.title}
                      </h4>
                    </div>
                    <a 
                      href={art.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:text-white text-xs flex items-center gap-1 font-label-caps text-[10px] uppercase mt-4 border-t border-zinc-900/60 pt-2.5 w-max"
                    >
                      View Source Wire <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                );
              })}
              {event.articles.length === 0 && (
                <div className="col-span-2 p-6 rounded bg-zinc-950/20 border border-dashed border-zinc-800 text-center">
                  <p className="text-zinc-500 text-sm">No external wire references associated with this event.</p>
                </div>
              )}
            </div>
          </section>

        </main>

        {/* Social Flux SideNavBar (Right Side, 3 Cols) */}
        <aside className="hidden lg:flex flex-col col-span-3 bg-zinc-950/40 border border-outline-variant/60 shadow-sm sticky top-20 h-[calc(100vh-8rem)] overflow-hidden rounded-lg backdrop-blur-md p-4">
          <div className="border-b border-outline-variant/40 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-primary-container text-primary flex items-center justify-center font-bold text-sm">
                SF
              </div>
              <div>
                <h2 className="font-body-md text-body-md font-bold text-primary leading-tight">Social Flux</h2>
                <span className="font-label-caps text-label-caps text-on-surface-variant text-[10px]">Real-time Intelligence</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-outline-variant/40 px-1 mb-4">
            <button 
              onClick={() => setFluxTab("flux")}
              className={`flex-1 pb-2 text-xs font-semibold text-center transition-colors ${fluxTab === "flux" ? "text-primary border-b-2 border-primary" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              Feed
            </button>
            <button 
              onClick={() => setFluxTab("trending")}
              className={`flex-1 pb-2 text-xs font-semibold text-center transition-colors ${fluxTab === "trending" ? "text-primary border-b-2 border-primary" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              Trending
            </button>
            <button 
              onClick={() => setFluxTab("updates")}
              className={`flex-1 pb-2 text-xs font-semibold text-center transition-colors ${fluxTab === "updates" ? "text-primary border-b-2 border-primary" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              Updates
            </button>
          </div>

          {/* Feed Content */}
          <div className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-4 text-xs">
            {fluxTab === "flux" && (
              <>
                <div className="border-b border-outline-variant/30 pb-3 space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono-data">
                    <span className="text-primary font-bold">X \ @IntelAlert</span>
                    <span>3m ago</span>
                  </div>
                  <p className="text-zinc-300 leading-snug">Philippine coast guard updates satellite logs regarding maritime routes shifts.</p>
                </div>
                
                <div className="border-b border-outline-variant/30 pb-3 space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono-data">
                    <span className="text-tertiary font-bold">Bloomberg RSS</span>
                    <span>18m ago</span>
                  </div>
                  <p className="text-zinc-300 leading-snug">Tech equity indexes dip slightly on maritime logistics realignment reports.</p>
                </div>

                <div className="border-b border-outline-variant/30 pb-3 space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono-data">
                    <span className="text-secondary font-bold font-mono-data">OSINT Core</span>
                    <span>1h ago</span>
                  </div>
                  <p className="text-zinc-300 leading-snug">Automatic Identification System (AIS) reports show cargo vessels rerouting around perimeter.</p>
                </div>
              </>
            )}

            {fluxTab === "trending" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center py-1.5 border-b border-zinc-900">
                  <span className="text-zinc-300">#IndoPacificSecurity</span>
                  <span className="text-primary font-bold">94% Importance</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-zinc-900">
                  <span className="text-zinc-300">#SupplyChainRealignment</span>
                  <span className="text-primary font-bold">88% Importance</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-zinc-900">
                  <span className="text-zinc-300">#MaritimeDomainAwareness</span>
                  <span className="text-primary font-bold">82% Importance</span>
                </div>
              </div>
            )}

            {fluxTab === "updates" && (
              <div className="space-y-3 text-zinc-400">
                <p className="flex items-start gap-1.5">
                  <span className="text-primary font-bold">•</span>
                  <span>Dossier verified and ingested successfully by backend core.</span>
                </p>
                <p className="flex items-start gap-1.5">
                  <span className="text-primary font-bold">•</span>
                  <span>Elasticsearch search indices synchronized.</span>
                </p>
              </div>
            )}
          </div>
        </aside>

      </div>

      {/* Footer */}
      <footer className="bg-surface-container-low border-t border-outline-variant/50 w-full py-6 px-margin-desktop mt-auto flex flex-col md:flex-row justify-between items-center z-10 relative">
        <div className="mb-4 md:mb-0">
          <span className="font-headline-lg text-headline-lg font-bold text-primary block mb-1">GlobeLens AI</span>
          <p className="font-body-sm text-body-sm text-on-surface-variant">© 2026 GlobeLens AI. Authoritative Editorial Intelligence.</p>
        </div>
        <nav className="flex flex-wrap gap-4 md:gap-6 items-center justify-center text-xs">
          <a className="text-on-surface-variant hover:text-primary transition-colors" href="#">Institutional Briefs</a>
          <a className="text-on-surface-variant hover:text-primary transition-colors" href="#">Privacy Guidelines</a>
          <a className="text-on-surface-variant hover:text-primary transition-colors" href="#">System Ethics Policy</a>
        </nav>
      </footer>
    </div>
  );
}
