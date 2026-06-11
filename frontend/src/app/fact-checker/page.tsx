"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Globe, 
  Link as LinkIcon, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  History,
  RefreshCw,
  Award,
  BookOpen,
  CornerDownRight,
  UserCheck
} from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ClaimItem {
  text: string;
  status: string; // "Corroborated" | "Disputed" | "Unverified"
}

interface HistoricalMatchItem {
  title: string;
  last_active: string;
  match_percentage: number;
}

interface FactCheckResult {
  id: string;
  input: string;
  result: string;
  created_at: string;
  explanation: {
    credibility_score: number;
    trust_risks: string[];
    independent_cross_references: number;
    claims: ClaimItem[];
    historical_matches: HistoricalMatchItem[];
  };
}

export default function FactCheckerPage() {
  const router = useRouter();
  const [urlInput, setUrlInput] = useState("https://example-news-source.com/article-123");
  const [loading, setLoading] = useState(false);
  
  // Active report being displayed
  const [currentReport, setCurrentReport] = useState<FactCheckResult | null>(null);
  
  // Analysis History list
  const [history, setHistory] = useState<FactCheckResult[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [authError, setAuthError] = useState(false);

  // Authenticate user & load history
  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      setAuthError(true);
      router.push("/login");
      return;
    }

    const loadUserData = async () => {
      try {
        // Fetch current user details
        const meResponse = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!meResponse.ok) {
          throw new Error("Authentication failed");
        }
        
        const profile = await meResponse.json();
        setUserProfile(profile);

        // Fetch user's fact check history
        const historyResponse = await fetch(`${API_BASE_URL}/api/v1/fact-check/users/${profile.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          setHistory(historyData.requests || []);
          if (historyData.requests && historyData.requests.length > 0) {
            setCurrentReport(historyData.requests[0]);
          }
        }
      } catch (err) {
        console.error("Auth error in fact-checker", err);
        setAuthError(true);
        router.push("/login");
      }
    };

    loadUserData();
  }, [router]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setLoading(true);
    const token = localStorage.getItem("admin_token");
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/fact-check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ input_text_url: urlInput })
      });

      if (response.ok) {
        const newReport = await response.json();
        setCurrentReport(newReport);
        
        // Refresh history
        if (userProfile) {
          const historyResponse = await fetch(`${API_BASE_URL}/api/v1/fact-check/users/${userProfile.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            setHistory(historyData.requests || []);
          }
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(`Analysis failed: ${errData.detail || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Analysis request failed", err);
      alert("Failed to connect to the analysis pipeline.");
    } finally {
      setLoading(false);
    }
  };

  if (authError || !userProfile) {
    return (
      <div className="bg-background text-on-background min-h-screen flex items-center justify-center font-body-md">
        <div className="text-center space-y-4">
          <RefreshCw className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-on-surface-variant text-sm">Authenticating clearance credentials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col font-body-md overflow-x-hidden selection:bg-primary-container selection:text-primary">
      {/* TopNavBar */}
      <nav className="flex justify-between items-center px-margin-desktop w-full h-16 bg-surface/80 backdrop-blur-md border-b border-outline-variant z-50">
        <div className="flex items-center gap-stack-lg">
          <span className="font-headline-lg text-headline-lg font-bold text-primary tracking-tight cursor-pointer" onClick={() => router.push("/")}>
            GlobeLens AI
          </span>
          <div className="hidden md:flex gap-stack-lg items-center ml-8 pt-1">
            <a className="font-body-md text-body-md text-on-surface-variant font-medium hover:text-primary transition-colors" href="/?view=standard">Standard</a>
            <a className="font-body-md text-body-md text-on-surface-variant font-medium hover:text-primary transition-colors" href="/?view=map">Map</a>
            <a className="font-body-md text-body-md text-on-surface-variant font-medium hover:text-primary transition-colors" href="/admin/dashboard">Admin</a>
            <a className="font-body-md text-body-md text-primary font-bold border-b-2 border-primary pb-1" href="/fact-checker">Fact Checker</a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center font-mono-data text-xs text-primary font-bold shadow-sm">
            {userProfile.name.slice(0, 2).toUpperCase()}
          </div>
        </div>
      </nav>

      {/* Main Content Layout */}
      <div className="flex-1 flex w-full max-w-container-max-width mx-auto relative px-margin-mobile md:px-margin-desktop py-stack-lg">
        
        {/* Left Column (Fact Checker Utilities) */}
        <main className="flex-grow w-full lg:w-3/4 pr-0 lg:pr-gutter pb-32 flex flex-col gap-stack-lg z-10">
          <header className="mb-2">
            <h1 className="font-display-lg text-headline-xl md:text-display-lg font-bold text-primary mb-2">Fact-Checker Utility</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-3xl">Analyze cross-reference metrics, trust risks, and matching historical topics for any source URL.</p>
          </header>

          {/* URL / Text Input Area */}
          <section className="bg-slate-900/40 border border-zinc-800/80 backdrop-blur-md rounded-xl p-5 shadow-sm">
            <form onSubmit={handleAnalyze} className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
              <div className="flex-1 bg-zinc-950/80 border border-zinc-800 rounded-lg flex items-center px-4 py-3 focus-within:border-primary transition-all duration-200">
                <LinkIcon className="w-5 h-5 text-primary mr-3 flex-shrink-0" />
                <input 
                  type="text" 
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Paste URL or claim statement to analyze..."
                  className="w-full bg-transparent border-none text-body-md font-body-md text-on-surface focus:ring-0 focus:outline-none placeholder-zinc-600 shadow-inner"
                  required
                />
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="bg-primary hover:bg-secondary text-primary-container font-label-caps text-label-caps px-6 py-4 rounded-lg font-bold uppercase transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-md disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Analyzing Claim...
                  </>
                ) : (
                  <>
                    <Award className="w-4 h-4" />
                    Check the Credibility
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Results Area */}
          {currentReport && (
            <div className="space-y-8 animate-in fade-in duration-500">
              
              {/* High-Level Metrics Bento Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. Credibility Score */}
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
                  <div className="flex justify-between items-start mb-4">
                    <span className="font-label-caps text-label-caps text-zinc-500 uppercase tracking-widest text-[10px]">Credibility Score</span>
                    <span className="material-symbols-outlined text-primary text-[20px]">verified_user</span>
                  </div>
                  <div className="flex items-end gap-1 mb-2">
                    <span className="text-4xl font-bold text-white font-mono-data">{currentReport.explanation.credibility_score}</span>
                    <span className="text-zinc-500 text-sm mb-1">/ 100</span>
                  </div>
                  <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden mb-2">
                    <div 
                      className={`h-full transition-all duration-1000 ${
                        currentReport.explanation.credibility_score >= 70 
                          ? "bg-emerald-500" 
                          : currentReport.explanation.credibility_score <= 40 
                            ? "bg-rose-500" 
                            : "bg-amber-500"
                      }`}
                      style={{ width: `${currentReport.explanation.credibility_score}%` }}
                    ></div>
                  </div>
                  <p className="font-mono-data text-[10px] text-zinc-400 uppercase tracking-wider font-bold">
                    {currentReport.explanation.credibility_score >= 70 
                      ? "High Credibility" 
                      : currentReport.explanation.credibility_score <= 40 
                        ? "Risk Warning" 
                        : "Moderate Credibility"}
                  </p>
                </div>

                {/* 2. Trust Risks */}
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
                  <div className="flex justify-between items-start mb-4">
                    <span className="font-label-caps text-label-caps text-zinc-500 uppercase tracking-widest text-[10px]">Identified Risks</span>
                    <AlertTriangle className={`w-5 h-5 ${currentReport.explanation.trust_risks.length > 0 ? "text-amber-400" : "text-emerald-500"}`} />
                  </div>
                  <div className="flex-grow">
                    {currentReport.explanation.trust_risks.length > 0 ? (
                      <ul className="space-y-2 text-xs text-zinc-400 leading-normal">
                        {currentReport.explanation.trust_risks.map((risk, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-rose-400 font-bold mt-0.5">•</span>
                            <span>{risk}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-emerald-400 font-medium">No significant trust risks identified in domain metadata.</p>
                    )}
                  </div>
                </div>

                {/* 3. Cross-References */}
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
                  <div className="flex justify-between items-start mb-4">
                    <span className="font-label-caps text-label-caps text-zinc-500 uppercase tracking-widest text-[10px]">Cross-References</span>
                    <Globe className="w-5 h-5 text-secondary" />
                  </div>
                  <div className="mb-2">
                    <span className="text-4xl font-bold text-white font-mono-data">{currentReport.explanation.independent_cross_references}</span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-normal mb-3">Independent publisher wireheads reporting matching facts.</p>
                  <div className="flex -space-x-1.5">
                    {["AP", "BBC", "RTR", "AJ"].map((pub) => (
                      <div key={pub} className="w-6 h-6 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center text-[9px] font-mono-data text-zinc-400 font-bold uppercase shadow-sm">
                        {pub}
                      </div>
                    ))}
                    <div className="w-6 h-6 rounded-full bg-primary-container border border-outline-variant flex items-center justify-center text-[8px] font-mono-data text-primary font-bold shadow-sm">
                      +{Math.max(0, currentReport.explanation.independent_cross_references - 4)}
                    </div>
                  </div>
                </div>

              </div>

              {/* AI Verification Report Summary */}
              {currentReport.explanation.summary && (
                <div className="bg-slate-900/40 border border-zinc-800/80 backdrop-blur-md rounded-xl p-6 shadow-sm border-l-4 border-l-primary relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <h3 className="text-sm font-bold text-primary mb-3 flex items-center gap-2 tracking-wider uppercase font-label-caps">
                    <span className="material-symbols-outlined text-primary text-[18px]">summarize</span>
                    AI Verification Report Summary
                  </h3>
                  <p className="text-zinc-200 text-sm leading-relaxed font-body-md">
                    {currentReport.explanation.summary}
                  </p>
                </div>
              )}

              {/* Deep Dive Row (Claims + Historical Matching) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Extracted Claims */}
                <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-xl p-5 shadow-sm">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">fact_check</span>
                    Extracted Claims Validation
                  </h3>
                  <div className="space-y-3">
                    {currentReport.explanation.claims.map((claim, idx) => (
                      <div key={idx} className="bg-zinc-950/50 border border-zinc-900 rounded-lg p-3.5 flex flex-col gap-2 relative">
                        <p className="text-xs text-zinc-300 italic">"{claim.text}"</p>
                        <div className="flex items-center justify-between mt-1 pt-2 border-t border-zinc-900/50">
                          <span className="font-mono-data text-[10px] text-zinc-500">Validation Status</span>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${
                            claim.status.toLowerCase() === "corroborated" 
                              ? "text-emerald-400" 
                              : claim.status.toLowerCase() === "disputed" 
                                ? "text-rose-400" 
                                : "text-amber-400"
                          }`}>
                            {claim.status.toLowerCase() === "corroborated" && <CheckCircle className="w-3.5 h-3.5" />}
                            {claim.status.toLowerCase() === "disputed" && <XCircle className="w-3.5 h-3.5" />}
                            {claim.status.toLowerCase() === "unverified" && <AlertTriangle className="w-3.5 h-3.5" />}
                            {claim.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Historical Event Matches */}
                <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">history</span>
                      Historical Topic Alignments
                    </h3>
                    <p className="text-xs text-zinc-500 mb-4">Matches database event dossiers related to the analyzed narrative thread.</p>
                    <div className="space-y-4">
                      {currentReport.explanation.historical_matches.length > 0 ? (
                        currentReport.explanation.historical_matches.map((match, idx) => (
                          <div key={idx} className="flex justify-between items-center border-b border-zinc-800/40 pb-3 last:border-b-0">
                            <div className="space-y-1">
                              <h4 className="text-xs text-zinc-300 font-bold leading-snug">{match.title}</h4>
                              <p className="text-[10px] text-zinc-500 font-mono-data flex items-center gap-1">
                                <Clock className="w-3 h-3 text-zinc-600" /> Active: {match.last_active}
                              </p>
                            </div>
                            <span className="font-mono-data text-xs text-primary font-bold ml-4">
                              {match.match_percentage}% Match
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-zinc-600 italic">No corresponding historical topics matched.</p>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* Analysis History Archive Table */}
              <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-primary" />
                    Analysis History Archive
                  </h3>
                  <span className="font-mono-data text-[10px] text-zinc-500 uppercase tracking-widest">Logged: {history.length} checks</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 font-label-caps text-label-caps text-zinc-500 uppercase text-[9px] tracking-widest">
                        <th className="pb-3 w-3/5">Submitted Target Claim / Link</th>
                        <th className="pb-3 px-4 text-center">Verification Date</th>
                        <th className="pb-3 text-right">Credibility</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900/30">
                      {history.map((hItem) => (
                        <tr 
                          key={hItem.id}
                          onClick={() => setCurrentReport(hItem)}
                          className={`hover:bg-zinc-900/50 cursor-pointer transition-colors duration-150 ${currentReport.id === hItem.id ? "bg-zinc-900/40" : ""}`}
                        >
                          <td className="py-3 pr-4">
                            <div className="font-bold text-zinc-300 max-w-lg truncate leading-normal flex items-center gap-1.5">
                              <CornerDownRight className="w-3 h-3 text-primary" />
                              {hItem.input}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono-data text-zinc-500 text-center">
                            {hItem.created_at ? new Date(hItem.created_at).toLocaleDateString() : "Unknown"}
                          </td>
                          <td className="py-3 text-right font-mono-data font-bold">
                            <span className={
                              hItem.result.toUpperCase() === "TRUE" 
                                ? "text-emerald-400" 
                                : hItem.result.toUpperCase() === "FALSE" 
                                  ? "text-rose-400" 
                                  : "text-amber-400"
                            }>
                              {hItem.explanation.credibility_score}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </main>

        {/* Dynamic Social Flux Aside Sidebar (Ported from fact_checker_utility_globelens_ai) */}
        <aside className="hidden lg:flex flex-col w-85 bg-zinc-950/40 border border-outline-variant/60 rounded-lg p-4 h-[calc(100vh-8rem)] sticky top-6 overflow-hidden z-10 flex-shrink-0 backdrop-blur-md">
          <div className="mb-6 flex flex-col border-b border-outline-variant/40 pb-4">
            <span className="font-label-caps text-label-caps text-secondary mb-1 uppercase tracking-widest text-[10px]">Real-Time Monitoring</span>
            <div className="flex items-center justify-between">
              <h2 className="font-body-md text-body-md font-bold text-primary flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">radar</span>
                Social Flux
              </h2>
              <button 
                onClick={() => router.push("/")}
                className="text-zinc-400 hover:text-primary transition-colors flex items-center text-[10px] font-bold tracking-wider uppercase gap-1"
              >
                Back to Map
              </button>
            </div>
          </div>

          <div className="flex-grow flex flex-col gap-3 overflow-y-auto pr-1 no-scrollbar">
            <div className="p-3 bg-zinc-900/40 rounded border border-outline-variant/30 relative">
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500 rounded-l"></div>
              <div className="flex justify-between items-start mb-1 text-[9px] text-zinc-500 font-mono-data">
                <span>Associated Press</span>
                <span>Just Now</span>
              </div>
              <p className="font-body-sm text-body-sm text-zinc-300 leading-snug">Fact-checking service successfully connected to downstream AI models. Integrity checks running.</p>
            </div>
            
            <div className="p-3 bg-zinc-900/40 rounded border border-outline-variant/30 relative">
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-500 rounded-l"></div>
              <div className="flex justify-between items-start mb-1 text-[9px] text-zinc-500 font-mono-data">
                <span>System Integrity</span>
                <span>10m ago</span>
              </div>
              <p className="font-body-sm text-body-sm text-zinc-300 leading-snug">Verification score mapped for standard articles. Threshold verified against database constraints.</p>
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}

// Simple clock icon replacement
function Clock({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
