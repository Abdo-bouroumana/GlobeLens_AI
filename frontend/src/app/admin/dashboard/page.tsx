"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { 
  Shield, 
  Activity, 
  Database, 
  Server, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Play, 
  FileText, 
  Cpu, 
  Network, 
  Layers, 
  Globe, 
  UserCheck, 
  LogOut 
} from "lucide-react";

// Dynamically import the Map component to prevent window undefined SSR issues
const Map = dynamic(() => import("../../components/Map"), { ssr: false });

// API Client configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface HealthState {
  status: "healthy" | "degraded" | "loading" | "error";
  backend: "UP" | "DOWN";
  postgres: "UP" | "DOWN";
  redis: "UP" | "DOWN";
  elasticsearch: "UP" | "DOWN";
  frontend: "UP" | "DOWN";
}

interface StatsState {
  funnel: {
    scraped: number;
    vectorized: number;
    clustered: number;
    enriched: number;
  };
  media_split: Record<string, number>;
  topic_distribution: Record<string, number>;
  bias_distribution: Record<string, number>;
}

interface SelectedEvent {
  id: string;
  title: string;
  summary: string;
  topic: string;
  country: string;
  latitude: number;
  longitude: number;
  importance_score: number;
  source_count: number;
}

export default function AdminDashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [email, setEmail] = useState("admin@globelens.ai"); // Default to admin for testing convenience
  const [password, setPassword] = useState("adminpassword123");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Dashboard Stats & Health States
  const [health, setHealth] = useState<HealthState>({
    status: "loading",
    backend: "DOWN",
    postgres: "DOWN",
    redis: "DOWN",
    elasticsearch: "DOWN",
    frontend: "UP"
  });

  const [stats, setStats] = useState<StatsState>({
    funnel: { scraped: 0, vectorized: 0, clustered: 0, enriched: 0 },
    media_split: { "BBC News": 0, "CNN": 0, "Al Jazeera": 0 },
    topic_distribution: {},
    bias_distribution: {}
  });

  const [mapEvents, setMapEvents] = useState<SelectedEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  // Administrative Trigger States
  const [triggerStatus, setTriggerStatus] = useState<{
    running: boolean;
    name: string;
    progress: number;
    message: string;
  }>({
    running: false,
    name: "",
    progress: 0,
    message: ""
  });

  // Verify token in localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("admin_token");
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Authentication failed");
      }

      const data = await response.json();
      
      // We need to verify if the user is an admin
      const profileResponse = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
        headers: { "Authorization": `Bearer ${data.access_token}` }
      });

      if (!profileResponse.ok) {
        throw new Error("Failed to fetch user profile");
      }

      const profile = await profileResponse.json();
      if (profile.role !== "ADMIN") {
        throw new Error("Access Denied: Only administrators can view this dashboard");
      }

      localStorage.setItem("admin_token", data.access_token);
      setToken(data.access_token);
    } catch (err: any) {
      setAuthError(err.message || "An error occurred");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setToken(null);
    setSelectedEvent(null);
  };

  // Live Checkup Polling
  const checkHealth = useCallback(async () => {
    try {
      const start = Date.now();
      const response = await fetch(`${API_BASE_URL}/health`);
      const latency = Date.now() - start;

      if (!response.ok) throw new Error("Backend degraded");

      const data = await response.json();
      setHealth({
        status: data.status === "healthy" ? "healthy" : "degraded",
        backend: "UP",
        postgres: data.database === "ok" ? "UP" : "DOWN",
        redis: data.redis === "ok" ? "UP" : "DOWN",
        elasticsearch: data.elasticsearch === "ok" ? "UP" : "DOWN",
        frontend: "UP"
      });
    } catch (err) {
      setHealth((prev) => ({
        ...prev,
        status: "error",
        backend: "DOWN",
        postgres: "DOWN",
        redis: "DOWN",
        elasticsearch: "DOWN"
      }));
    }
  }, []);

  // Fetch Dashboard Stats & Map Events
  const fetchStatsAndMap = useCallback(async () => {
    if (!token) return;
    setIsStatsLoading(true);

    try {
      // 1. Fetch Stats
      const statsResp = await fetch(`${API_BASE_URL}/api/v1/admin/stats`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (statsResp.ok) {
        const statsData = await statsResp.json();
        setStats(statsData);
      } else if (statsResp.status === 401) {
        // Token expired
        handleLogout();
        return;
      }

      // 2. Fetch Map Events
      const mapResp = await fetch(`${API_BASE_URL}/api/v1/events/map`);
      if (mapResp.ok) {
        const mapData = await mapResp.json();
        setMapEvents(mapData.events || []);
      }
    } catch (err) {
      console.error("Failed to fetch statistics", err);
    } finally {
      setIsStatsLoading(false);
    }
  }, [token]);

  // Sync health checks and analytics polling loops
  useEffect(() => {
    checkHealth();
    const healthInterval = setInterval(checkHealth, 10000); // 10s health check
    return () => clearInterval(healthInterval);
  }, [checkHealth]);

  useEffect(() => {
    if (token) {
      fetchStatsAndMap();
      const statsInterval = setInterval(fetchStatsAndMap, 15000); // 15s stats poll
      return () => clearInterval(statsInterval);
    }
  }, [token, fetchStatsAndMap]);

  // Administrative Trigger Overrides
  const triggerWorker = async (name: string, endpoint: string) => {
    if (!token || triggerStatus.running) return;

    setTriggerStatus({
      running: true,
      name,
      progress: 5,
      message: "Initializing background worker..."
    });

    // Simulate progress bar increase
    const progressInterval = setInterval(() => {
      setTriggerStatus((prev) => {
        if (prev.progress >= 95) return prev;
        return {
          ...prev,
          progress: prev.progress + Math.floor(Math.random() * 8) + 2,
          message: prev.progress > 70 ? "Finalizing database modifications..." : "Executing pipeline steps..."
        };
      });
    }, 400);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error(`Worker execution failed with status: ${response.status}`);
      }

      // Completed successfully
      clearInterval(progressInterval);
      setTriggerStatus((prev) => ({
        ...prev,
        progress: 100,
        message: "Worker task initiated successfully (202 Accepted)!"
      }));

      // Small delay before closing progress modal
      setTimeout(() => {
        setTriggerStatus({ running: false, name: "", progress: 0, message: "" });
        fetchStatsAndMap(); // Refresh counts
      }, 1500);

    } catch (err: any) {
      clearInterval(progressInterval);
      setTriggerStatus({
        running: true,
        name,
        progress: 100,
        message: `Error: ${err.message || "Failed to trigger worker"}`
      });
      setTimeout(() => {
        setTriggerStatus({ running: false, name: "", progress: 0, message: "" });
      }, 3500);
    }
  };

  // Sparkline SVG renderer
  const renderSparkline = (dataPoints: number[], color: string) => {
    const width = 140;
    const height = 30;
    const maxVal = Math.max(...dataPoints, 1);
    const minVal = Math.min(...dataPoints, 0);
    const range = maxVal - minVal;
    
    const points = dataPoints.map((val, index) => {
      const x = (index / (dataPoints.length - 1)) * width;
      const y = height - ((val - minVal) / range) * height;
      return `${x},${y}`;
    }).join(" ");

    return (
      <svg width={width} height={height} className="overflow-visible mt-2">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          points={points}
          className="drop-shadow-[0_0_4px_rgba(59,130,246,0.5)]"
        />
      </svg>
    );
  };

  // Calculate Average Ideological Spectrum value (LEFT: 1 to RIGHT: 5)
  const calculateBiasScore = () => {
    const dist = stats.bias_distribution;
    const weights: Record<string, number> = {
      LEFT: 1,
      CENTER_LEFT: 2,
      CENTER: 3,
      CENTER_RIGHT: 4,
      RIGHT: 5
    };

    let totalWeight = 0;
    let totalCount = 0;
    Object.entries(dist).forEach(([bias, count]) => {
      if (weights[bias]) {
        totalWeight += weights[bias] * count;
        totalCount += count;
      }
    });

    return totalCount > 0 ? totalWeight / totalCount : 3.0; // Default to center (3.0)
  };

  const biasScore = calculateBiasScore();
  // Map biasScore to percentage: 1.0 (0%) to 5.0 (100%)
  const biasPercentage = ((biasScore - 1) / 4) * 100;

  // Unauthenticated view (Admin Auth Gateway)
  if (!token) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-sans p-4 relative overflow-hidden">
        {/* Abstract floating shapes */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="w-full max-w-md bg-zinc-900/60 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 relative z-10 shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-blue-500 text-white mb-4 shadow-lg shadow-blue-500/20">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">GlobeLens AI</h1>
            <p className="text-zinc-400 text-sm mt-1">Admin Monitoring Portal Gateway</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Administrator Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="admin@globelens.ai"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Secure Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {authError && (
              <div className="flex items-center gap-2 text-red-400 bg-red-950/30 border border-red-900/50 rounded-xl p-3 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all shadow-lg hover:shadow-blue-500/20 active:scale-98"
            >
              {isLoggingIn ? "Authenticating credentials..." : "Authenticate Access"}
            </button>
          </form>
          
          <div className="mt-8 text-center text-xs text-zinc-600">
            System Authorization Protocol v2.0 · Authenticated logs are recorded.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-zinc-100 font-sans p-6 overflow-x-hidden relative">
      {/* Background gradients */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-violet-500/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* HEADER SECTION */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-zinc-900 pb-6 mb-8 relative z-20">
        <div>
          <div className="flex items-center gap-2 text-blue-500 font-semibold tracking-wider text-xs uppercase mb-1">
            <Activity className="w-4 h-4 animate-pulse" />
            <span>Admin Live Monitoring</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">System Administrative Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchStatsAndMap}
            className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-sm px-4 py-2.5 rounded-xl transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isStatsLoading ? "animate-spin" : ""}`} />
            Refresh State
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-red-950/20 border border-red-900/30 hover:bg-red-950/40 text-red-400 text-sm px-4 py-2.5 rounded-xl transition-all"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 relative z-10">
        
        {/* 1. HEALTH AND INFRASTRUCTURE CHECKS */}
        <section className="lg:col-span-4 grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { name: "Backend Core", status: health.backend, icon: Server },
            { name: "PostgreSQL", status: health.postgres, icon: Database },
            { name: "Redis Cache", status: health.redis, icon: Cpu },
            { name: "Elasticsearch", status: health.elasticsearch, icon: Network },
            { name: "Web Frontend", status: health.frontend, icon: Globe }
          ].map((srv) => (
            <div
              key={srv.name}
              className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-4 flex items-center justify-between shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-400">
                  <srv.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs text-zinc-400 font-medium">{srv.name}</h3>
                  <span className="text-xs font-semibold text-zinc-500 uppercase">Status</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {srv.status === "UP" ? (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/50 animate-pulse"></span>
                    <span className="text-xs text-emerald-400 font-bold">ONLINE</span>
                  </>
                ) : (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-md shadow-rose-500/50 animate-pulse"></span>
                    <span className="text-xs text-rose-400 font-bold">DEGRADED</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </section>

        {/* 2. LIVE DATA FUNNEL METRICS */}
        <section className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          {[
            {
              title: "Scraped Articles",
              count: stats.funnel.scraped,
              status: "SCRAPED",
              color: "text-amber-500",
              sparkColor: "#f59e0b",
              data: [5, 8, 4, 15, 12, stats.funnel.scraped + 2, stats.funnel.scraped + 1, stats.funnel.scraped]
            },
            {
              title: "Vectorized Articles",
              count: stats.funnel.vectorized,
              status: "EMBEDDED",
              color: "text-blue-500",
              sparkColor: "#3b82f6",
              data: [12, 10, 18, 22, 19, stats.funnel.vectorized - 1, stats.funnel.vectorized + 2, stats.funnel.vectorized]
            },
            {
              title: "Clustered Articles",
              count: stats.funnel.clustered,
              status: "CLUSTERED",
              color: "text-violet-500",
              sparkColor: "#8b5cf6",
              data: [2, 7, 5, 11, 14, stats.funnel.clustered - 2, stats.funnel.clustered + 1, stats.funnel.clustered]
            },
            {
              title: "Enriched Events",
              count: stats.funnel.enriched,
              status: "PROCESSED",
              color: "text-emerald-500",
              sparkColor: "#10b981",
              data: [1, 3, 2, 4, 6, stats.funnel.enriched - 1, stats.funnel.enriched, stats.funnel.enriched]
            }
          ].map((gauge) => (
            <div
              key={gauge.title}
              className="bg-zinc-900/30 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">{gauge.title}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-950 border border-zinc-800/80 ${gauge.color}`}>
                  {gauge.status}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-white tracking-tight">{gauge.count}</span>
                <span className="text-xs text-zinc-500">items</span>
              </div>
              {/* Micro-sparkline charts */}
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-zinc-950/80">
                <span className="text-[10px] text-zinc-500">Ingestion velocity</span>
                {renderSparkline(gauge.data, gauge.sparkColor)}
              </div>
            </div>
          ))}
        </section>

        {/* 3. LEAFLET MAP SECTION */}
        <section className="lg:col-span-3 h-[500px] relative">
          <div className="absolute top-4 left-4 z-20 pointer-events-none">
            <div className="bg-zinc-950/90 backdrop-blur-md border border-zinc-800/80 rounded-xl px-4 py-2 text-xs flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping"></span>
              <span className="text-white font-semibold">Event Cartography (Processed Events Only)</span>
            </div>
          </div>
          <Map events={mapEvents} onSelectEvent={setSelectedEvent} />
        </section>

        {/* 4. ACTIVE ADMINISTRATIVE TRIGGER CONSOLE */}
        <section className="lg:col-span-1 bg-zinc-900/30 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-lg h-[500px]">
          <div>
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-500" />
              Administrative Overrides
            </h2>
            <p className="text-xs text-zinc-400 mb-6">
              Manually trigger background pipeline services in our container stack. Executions return 202 Accepted instantly.
            </p>

            <div className="space-y-4">
              {[
                {
                  label: "Run Ingestion Scraper",
                  desc: "Pull new articles via BBC/CNN/Al-Jazeera RSS feeds.",
                  endpoint: "/api/v1/articles/sync"
                },
                {
                  label: "Run Vector Inversion",
                  desc: "Compute OpenAI/Grok high-dimensional float embeddings.",
                  endpoint: "/api/v1/admin/embed/process"
                },
                {
                  label: "Run Cluster Partitioning",
                  desc: "Cosine similarity grouping into event clusters.",
                  endpoint: "/api/v1/admin/cluster/process"
                },
                {
                  label: "Run LLM Enrichment",
                  desc: "Synthesize clustered articles using investigative journalist agent.",
                  endpoint: "/api/v1/admin/llm/process"
                }
              ].map((btn) => (
                <button
                  key={btn.label}
                  disabled={triggerStatus.running}
                  onClick={() => triggerWorker(btn.label, btn.endpoint)}
                  className="w-full text-left bg-zinc-950/60 border border-zinc-800/60 hover:bg-zinc-900/80 disabled:opacity-50 p-4 rounded-xl transition-all group flex items-start justify-between"
                >
                  <div className="pr-4">
                    <h4 className="text-xs font-semibold text-white group-hover:text-blue-400 transition-colors">
                      {btn.label}
                    </h4>
                    <p className="text-[10px] text-zinc-400 mt-1">{btn.desc}</p>
                  </div>
                  <Play className="w-4 h-4 text-zinc-600 group-hover:text-blue-500 flex-shrink-0 transition-colors mt-0.5" />
                </button>
              ))}
            </div>
          </div>

          <div className="text-center text-[10px] text-zinc-500 border-t border-zinc-950 pt-4 mt-4">
            Authorized administrator console override session.
          </div>
        </section>

        {/* 5. MEDIA SOURCE & SPECTRUM CLASSIFICATIONS */}
        <section className="lg:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Chart A: Media Split Pie/Donut Chart */}
          <div className="bg-zinc-900/30 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white mb-4">Media Split Breakdown</h3>
              {/* Custom SVG Donut Chart */}
              <div className="flex items-center justify-center h-44 relative">
                {(() => {
                  const bbc = stats.media_split["BBC News"] || 0;
                  const cnn = stats.media_split["CNN"] || 0;
                  const alj = stats.media_split["Al Jazeera"] || 0;
                  const total = bbc + cnn + alj || 1;

                  const bbcPerc = (bbc / total) * 100;
                  const cnnPerc = (cnn / total) * 100;
                  const aljPerc = (alj / total) * 100;

                  // Stroke offset helper
                  const radius = 50;
                  const circ = 2 * Math.PI * radius;

                  const bbcOffset = circ;
                  const cnnOffset = circ - (bbcPerc / 100) * circ;
                  const aljOffset = cnnOffset - (cnnPerc / 100) * circ;

                  return (
                    <div className="relative flex items-center justify-center">
                      <svg width="150" height="150" className="transform -rotate-90">
                        {/* BBC Segment */}
                        <circle
                          cx="75"
                          cy="75"
                          r={radius}
                          fill="transparent"
                          stroke="#7c3aed"
                          strokeWidth="15"
                          strokeDasharray={circ}
                          strokeDashoffset={bbcOffset - (bbcPerc / 100) * circ}
                          className="transition-all duration-500"
                        />
                        {/* CNN Segment */}
                        <circle
                          cx="75"
                          cy="75"
                          r={radius}
                          fill="transparent"
                          stroke="#3b82f6"
                          strokeWidth="15"
                          strokeDasharray={circ}
                          strokeDashoffset={cnnOffset - (cnnPerc / 100) * circ}
                          className="transition-all duration-500"
                        />
                        {/* Al Jazeera Segment */}
                        <circle
                          cx="75"
                          cy="75"
                          r={radius}
                          fill="transparent"
                          stroke="#10b981"
                          strokeWidth="15"
                          strokeDasharray={circ}
                          strokeDashoffset={aljOffset - (aljPerc / 100) * circ}
                          className="transition-all duration-500"
                        />
                      </svg>
                      <div className="absolute text-center">
                        <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-wider">Total</span>
                        <span className="text-xl font-black text-white">{bbc + cnn + alj}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs mt-4 pt-4 border-t border-zinc-950">
              <div className="flex flex-col items-center">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-violet-600 mb-1"></span>
                <span className="text-zinc-400 text-[10px]">BBC News</span>
                <span className="font-bold text-white">{stats.media_split["BBC News"] || 0}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 mb-1"></span>
                <span className="text-zinc-400 text-[10px]">CNN</span>
                <span className="font-bold text-white">{stats.media_split["CNN"] || 0}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mb-1"></span>
                <span className="text-zinc-400 text-[10px]">Al Jazeera</span>
                <span className="font-bold text-white">{stats.media_split["Al Jazeera"] || 0}</span>
              </div>
            </div>
          </div>

          {/* Chart B: Topic Distribution Histogram */}
          <div className="bg-zinc-900/30 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white mb-4">Topic Category Distribution</h3>
              <div className="space-y-3 mt-2 h-44 overflow-y-auto pr-1">
                {["POLITICS", "ECONOMY", "TECHNOLOGY", "SPORTS", "HEALTH", "WORLD"].map((topic) => {
                  const count = stats.topic_distribution[topic] || 0;
                  const maxCount = Math.max(...Object.values(stats.topic_distribution), 1);
                  const percentage = (count / maxCount) * 100;
                  return (
                    <div key={topic} className="flex items-center gap-3 text-xs">
                      <span className="w-20 text-zinc-400 text-[10px] uppercase font-semibold text-right">{topic}</span>
                      <div className="flex-1 bg-zinc-950 rounded-full h-3.5 border border-zinc-800/40 relative overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-violet-600 to-blue-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="w-6 font-bold text-white text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="text-center text-[10px] text-zinc-500 border-t border-zinc-950 pt-4 mt-4 uppercase font-semibold">
              Event Category Frequency breakdown
            </div>
          </div>

          {/* Chart C: Collective Ideological Bias Spectrum */}
          <div className="bg-zinc-900/30 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white mb-4">Collective Ideological Lean</h3>
              
              <div className="space-y-6 py-6">
                {/* Horizontal Spectrum Gradient */}
                <div className="relative">
                  <div className="h-4 w-full rounded-full bg-gradient-to-r from-violet-600 via-zinc-400 to-emerald-500 border border-zinc-800/80"></div>
                  
                  {/* Slider cursor showing calculated average score */}
                  <div
                    className="absolute -top-1.5 flex flex-col items-center transition-all duration-500"
                    style={{ left: `calc(${biasPercentage}% - 8px)` }}
                  >
                    <div className="h-7 w-4 bg-white border border-slate-900 rounded-md shadow-md flex items-center justify-center cursor-default">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between text-[10px] text-zinc-400 font-bold uppercase px-1">
                  <span>Left Lean</span>
                  <span>Center</span>
                  <span>Right Lean</span>
                </div>
              </div>

              {/* Summary of lean scores */}
              <div className="bg-zinc-950/60 border border-zinc-800/50 rounded-xl p-3 text-xs flex items-center justify-between">
                <div>
                  <span className="text-zinc-500 font-semibold block text-[10px] uppercase">Aggregated Index</span>
                  <span className="font-extrabold text-white">
                    {biasScore.toFixed(2)} / 5.0
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-zinc-500 font-semibold block text-[10px] uppercase">General Bias</span>
                  <span className="font-bold text-blue-400">
                    {biasScore < 2.2 ? "LEFT BIAS" : biasScore < 2.8 ? "CENTER-LEFT" : biasScore < 3.2 ? "CENTERED" : biasScore < 3.8 ? "CENTER-RIGHT" : "RIGHT BIAS"}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="text-center text-[10px] text-zinc-500 border-t border-zinc-950 pt-4 mt-4 uppercase font-semibold">
              Ideological spectrum weighted calculation
            </div>
          </div>
        </section>

      </div>

      {/* 6. EVENT DETAILS SLIDE OVER GLASS PANEL */}
      {selectedEvent && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[450px] bg-zinc-950/90 backdrop-blur-xl border-l border-zinc-800/90 shadow-2xl z-50 transition-all duration-300 p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-950/40 border border-blue-900/50 text-blue-400 text-[10px] font-bold uppercase mb-2">
                  <Globe className="w-3 h-3" />
                  {selectedEvent.country}
                </span>
                <h3 className="text-xl font-black text-white leading-snug">{selectedEvent.title}</h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800/60 p-2 rounded-xl transition-all"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">AI-Generated Intelligence Summary</h4>
                <div className="text-xs text-zinc-300 space-y-3 leading-relaxed whitespace-pre-line">
                  {selectedEvent.summary || "No intelligence summary generated yet for this event."}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-zinc-900 pt-6">
                <div>
                  <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Geographic Coordinates</h5>
                  <span className="text-xs text-white font-semibold">
                    {selectedEvent.latitude.toFixed(4)}, {selectedEvent.longitude.toFixed(4)}
                  </span>
                </div>
                <div>
                  <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Media Source Count</h5>
                  <span className="text-xs text-white font-semibold">
                    {selectedEvent.source_count} reporting publishers
                  </span>
                </div>
                <div>
                  <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Classification Topic</h5>
                  <span className="text-xs text-blue-400 font-bold uppercase">
                    {selectedEvent.topic}
                  </span>
                </div>
                <div>
                  <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Importance Level</h5>
                  <span className="text-xs text-emerald-400 font-bold">
                    {selectedEvent.importance_score.toFixed(1)} / 10.0
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-900 pt-6">
            <button
              onClick={() => setSelectedEvent(null)}
              className="w-full py-3 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-white rounded-xl text-xs font-bold transition-all text-center text-zinc-400"
            >
              Close Detailed Panel
            </button>
          </div>
        </div>
      )}

      {/* 7. PROGRESS BAR POPUP / OVERLAY */}
      {triggerStatus.running && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
              Running Override: {triggerStatus.name}
            </h3>
            
            <p className="text-xs text-zinc-400 mb-4">{triggerStatus.message}</p>
            
            {/* Progress bar container */}
            <div className="w-full bg-zinc-950 rounded-full h-3 border border-zinc-800 overflow-hidden">
              <div
                className="bg-gradient-to-r from-violet-600 to-blue-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${triggerStatus.progress}%` }}
              ></div>
            </div>
            
            <div className="flex justify-between text-[9px] text-zinc-500 font-bold mt-2">
              <span>PROGRESS</span>
              <span>{triggerStatus.progress}%</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
