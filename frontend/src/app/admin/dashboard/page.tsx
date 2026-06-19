"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { 
  Shield, 
  Activity, 
  Database, 
  Server, 
  TrendingUp, 
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
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend
} from "recharts";

// Dynamically import the Map component to prevent window undefined SSR issues
const Map = dynamic(() => import("../../components/Map"), { ssr: false });

// API Client configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
import GlobelensLogo from "../../components/GlobelensLogo";


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
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

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

  // Handle client-side mount check
  useEffect(() => {
    setIsMounted(true);
    const savedToken = localStorage.getItem("admin_token");
    if (!savedToken) {
      router.push("/login");
    } else {
      setToken(savedToken);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    // Clear cookies
    document.cookie = "admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    setToken(null);
    router.push("/login");
  };

  // Live Checkup Polling
  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
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
        headers: { Authorization: `Bearer ${token}` }
      });
      if (statsResp.ok) {
        const statsData = await statsResp.json();
        setStats(statsData);
      } else if (statsResp.status === 401 || statsResp.status === 403) {
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
    const healthInterval = setInterval(checkHealth, 10000);
    return () => clearInterval(healthInterval);
  }, [checkHealth]);

  useEffect(() => {
    if (token) {
      fetchStatsAndMap();
      const statsInterval = setInterval(fetchStatsAndMap, 15000);
      return () => clearInterval(statsInterval);
    }
  }, [token, fetchStatsAndMap]);

  // Administrative Trigger overrides
  const triggerWorker = async (name: string, endpoint: string) => {
    if (!token || triggerStatus.running) return;

    setTriggerStatus({
      running: true,
      name,
      progress: 5,
      message: "Initializing background container worker..."
    });

    // Simulate progress bar increase
    const progressInterval = setInterval(() => {
      setTriggerStatus((prev) => {
        if (prev.progress >= 95) return prev;
        return {
          ...prev,
          progress: prev.progress + Math.floor(Math.random() * 8) + 2,
          message: prev.progress > 70 ? "Synthesizing intelligence feed databases..." : "Executing pipeline steps..."
        };
      });
    }, 450);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
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

      setTimeout(() => {
        setTriggerStatus({ running: false, name: "", progress: 0, message: "" });
        fetchStatsAndMap();
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
      const countNum = count as number;
      if (weights[bias]) {
        totalWeight += weights[bias] * countNum;
        totalCount += countNum;
      }
    });

    return totalCount > 0 ? totalWeight / totalCount : 3.0;
  };

  const biasScore = calculateBiasScore();
  const biasPercentage = ((biasScore - 1) / 4) * 100;

  // Render chart data formats
  const pieData: { name: string; value: number }[] = Object.entries(stats.media_split).map(([name, value]) => ({
    name,
    value: value as number
  }));
  const mediaColors = ["#7c3aed", "#3b82f6", "#10b981", "#dec29a"];

  const barData = Object.entries(stats.topic_distribution).map(([topic, count]) => ({
    name: topic,
    count
  }));

  if (!token) {
    return (
      <main className="min-h-screen bg-[#030712] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyber-indigo/5 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="z-10 text-center">
          <Cpu className="w-12 h-12 text-cyber-indigo animate-spin mx-auto mb-4" />
          <div className="text-zinc-400 font-mono-data text-xs tracking-widest uppercase">Redirecting to clearance gateway...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#030712] text-zinc-100 font-sans p-6 overflow-x-hidden relative">
      {/* Background gradients */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyber-cyan/5 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-cyber-indigo/5 rounded-full blur-[150px] pointer-events-none"></div>
      
      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(99,102,241,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0"></div>

      {/* HEADER SECTION */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-indigo-950/40 pb-6 mb-8 relative z-20">
        <div>
          <div className="flex items-center gap-2 text-cyber-cyan font-bold tracking-wider text-xs uppercase mb-1 font-mono-data">
            <Activity className="w-4 h-4 animate-pulse" />
            <span>Admin Live Monitoring</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-zinc-200 to-indigo-300 bg-clip-text text-transparent">
            System Administrative Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 bg-cyber-cyan/10 border border-cyber-cyan/30 hover:bg-cyber-cyan/20 text-cyber-cyan text-xs font-bold tracking-wider uppercase font-mono-data px-4 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.1)] hover:scale-[1.02] active:scale-[0.98]"
          >
            <Globe className="w-4 h-4" />
            Operational Console
          </button>
          <button
            onClick={fetchStatsAndMap}
            className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800/80 hover:bg-zinc-800/85 text-xs font-bold tracking-wider uppercase font-mono-data px-4 py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <RefreshCw className={`w-4 h-4 ${isStatsLoading ? "animate-spin" : ""}`} />
            Refresh State
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-cyber-rose/10 border border-cyber-rose/30 hover:bg-cyber-rose/20 text-cyber-rose text-xs font-bold tracking-wider uppercase font-mono-data px-4 py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
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
              className="glass-panel rounded-2xl p-4 flex items-center justify-between shadow-lg hover:border-indigo-500/30 hover:shadow-[0_0_15px_rgba(99,102,241,0.05)] transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-950/60 border border-zinc-800/80 rounded-xl text-zinc-400">
                  <srv.icon className="w-5 h-5 text-zinc-400" />
                </div>
                <div>
                  <h3 className="text-xs text-zinc-300 font-semibold">{srv.name}</h3>
                  <span className="text-[9px] font-semibold text-zinc-500 uppercase font-mono-data">Status</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {srv.status === "UP" ? (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-cyber-emerald shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-pulse"></span>
                    <span className="text-[10px] text-cyber-emerald font-bold font-mono-data">ONLINE</span>
                  </>
                ) : (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-cyber-rose shadow-[0_0_10px_rgba(244,63,94,0.8)] animate-pulse"></span>
                    <span className="text-[10px] text-cyber-rose font-bold font-mono-data">DOWN</span>
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
              color: "text-cyber-amber bg-cyber-amber/10 border-cyber-amber/20",
              sparkColor: "#f59e0b",
              glowStyle: "hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:border-cyber-amber/30",
              data: [5, 8, 4, 15, 12, stats.funnel.scraped + 2, stats.funnel.scraped + 1, stats.funnel.scraped]
            },
            {
              title: "Vectorized Articles",
              count: stats.funnel.vectorized,
              status: "EMBEDDED",
              color: "text-cyber-cyan bg-cyber-cyan/10 border-cyber-cyan/20",
              sparkColor: "#06b6d4",
              glowStyle: "hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] hover:border-cyber-cyan/30",
              data: [12, 10, 18, 22, 19, stats.funnel.vectorized - 1, stats.funnel.vectorized + 2, stats.funnel.vectorized]
            },
            {
              title: "Clustered Articles",
              count: stats.funnel.clustered,
              status: "CLUSTERED",
              color: "text-cyber-indigo bg-cyber-indigo/10 border-cyber-indigo/20",
              sparkColor: "#6366f1",
              glowStyle: "hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] hover:border-cyber-indigo/30",
              data: [2, 7, 5, 11, 14, stats.funnel.clustered - 2, stats.funnel.clustered + 1, stats.funnel.clustered]
            },
            {
              title: "Enriched Events",
              count: stats.funnel.enriched,
              status: "PROCESSED",
              color: "text-cyber-emerald bg-cyber-emerald/10 border-cyber-emerald/20",
              sparkColor: "#10b981",
              glowStyle: "hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:border-cyber-emerald/30",
              data: [1, 3, 2, 4, 6, stats.funnel.enriched - 1, stats.funnel.enriched, stats.funnel.enriched]
            }
          ].map((gauge) => (
            <div
              key={gauge.title}
              className={`glass-panel rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all duration-300 hover:scale-[1.02] ${gauge.glowStyle}`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">{gauge.title}</span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${gauge.color} font-mono-data`}>
                  {gauge.status}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-zinc-150 to-indigo-100 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(255,255,255,0.05)]">
                  {gauge.count}
                </span>
                <span className="text-xs text-zinc-500 font-mono-data">items</span>
              </div>
              {/* Micro-sparkline charts */}
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-indigo-950/40">
                <span className="text-[10px] text-zinc-500 font-mono-data">Ingestion velocity</span>
                {renderSparkline(gauge.data, gauge.sparkColor)}
              </div>
            </div>
          ))}
        </section>

        {/* 3. LEAFLET MAP SECTION */}
        <section className="lg:col-span-3 h-[500px] relative rounded-2xl overflow-hidden border border-indigo-950/50 shadow-2xl">
          <div className="absolute top-4 left-4 z-20 pointer-events-none">
            <div className="bg-[#0b0f19]/90 backdrop-blur-md border border-indigo-950/50 rounded-xl px-4 py-2 text-xs flex items-center gap-2 shadow-lg">
              <span className="h-2 w-2 rounded-full bg-cyber-cyan animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]"></span>
              <span className="text-white font-semibold font-mono-data uppercase tracking-wider">Event Cartography</span>
            </div>
          </div>
          <Map events={mapEvents} selectedEvent={selectedEvent} onSelectEvent={setSelectedEvent} />
        </section>

        {/* 4. ACTIVE ADMINISTRATIVE TRIGGER CONSOLE */}
        <section className="lg:col-span-1 glass-panel rounded-2xl p-5 flex flex-col justify-between shadow-lg h-[500px] border border-indigo-950/50 hover:border-cyber-indigo/35 transition-all duration-300">
          <div>
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyber-indigo animate-pulse" />
              Administrative Overrides
            </h2>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              Manually trigger background pipeline services in our container stack. Executions return 202 Accepted instantly.
            </p>

            <div className="space-y-3">
              {[
                {
                  label: "Run Ingestion Scraper",
                  desc: "Pull new articles via BBC/CNN/Al-Jazeera RSS feeds.",
                  endpoint: "/api/v1/articles/sync",
                  glowColor: "group-hover:border-cyber-amber/40 hover:shadow-[0_0_15px_rgba(245,158,11,0.1)]",
                  activeColor: "group-hover:text-cyber-amber"
                },
                {
                  label: "Run Vector Inversion",
                  desc: "Compute offline Sentence-Transformer float embeddings.",
                  endpoint: "/api/v1/admin/embed/process",
                  glowColor: "group-hover:border-cyber-cyan/40 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)]",
                  activeColor: "group-hover:text-cyber-cyan"
                },
                {
                  label: "Run Cluster Partitioning",
                  desc: "Cosine similarity grouping into event clusters.",
                  endpoint: "/api/v1/admin/cluster/process",
                  glowColor: "group-hover:border-cyber-indigo/40 hover:shadow-[0_0_15px_rgba(99,102,241,0.1)]",
                  activeColor: "group-hover:text-cyber-indigo"
                },
                {
                  label: "Run LLM Enrichment",
                  desc: "Synthesize clustered articles using Gemini.",
                  endpoint: "/api/v1/admin/llm/process",
                  glowColor: "group-hover:border-cyber-emerald/40 hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]",
                  activeColor: "group-hover:text-cyber-emerald"
                }
              ].map((btn) => (
                <button
                  key={btn.label}
                  disabled={triggerStatus.running}
                  onClick={() => triggerWorker(btn.label, btn.endpoint)}
                  className={`w-full text-left bg-zinc-950/60 border border-zinc-850/80 hover:bg-zinc-900/60 disabled:opacity-50 p-3.5 rounded-xl transition-all duration-300 group flex items-start justify-between ${btn.glowColor}`}
                >
                  <div className="pr-4">
                    <h4 className={`text-xs font-bold text-white transition-colors ${btn.activeColor}`}>
                      {btn.label}
                    </h4>
                    <p className="text-[10px] text-zinc-500 mt-1 leading-normal">{btn.desc}</p>
                  </div>
                  <Play className="w-4 h-4 text-zinc-600 group-hover:text-cyber-cyan flex-shrink-0 transition-colors mt-0.5" />
                </button>
              ))}
            </div>
          </div>

          <div className="text-center text-[10px] text-zinc-500 border-t border-indigo-950/40 pt-4 mt-4 font-mono-data tracking-wider uppercase">
            Authorized admin override console.
          </div>
        </section>

        {/* 5. MEDIA SOURCE & SPECTRUM CLASSIFICATIONS */}
        <section className="lg:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Chart A: Media Split Donut Chart (via Recharts) */}
          <div className="glass-panel rounded-2xl p-5 shadow-lg flex flex-col justify-between min-h-[320px] border border-indigo-950/50">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 mb-4 font-mono-data">Media Split Breakdown</h3>
              <div className="flex items-center justify-center h-44 relative">
                {isMounted && pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={mediaColors[index % mediaColors.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ background: "#0b0f19", borderColor: "rgba(99,102,241,0.2)", color: "#d4e4fa", fontSize: "11px", borderRadius: "8px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-zinc-500 text-xs font-mono-data">No media data available</div>
                )}
                {/* Core Total overlay */}
                <div className="absolute text-center pointer-events-none">
                  <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-wider font-mono-data">Total</span>
                  <span className="text-2xl font-black text-white bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                    {pieData.reduce((acc, curr) => acc + curr.value, 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs mt-4 pt-4 border-t border-indigo-950/40 font-body-sm">
              {pieData.map((item, index) => (
                <div key={item.name} className="flex flex-col items-center">
                  <span 
                    className="inline-block w-2.5 h-2.5 rounded-full mb-1 shadow-[0_0_8px_rgba(255,255,255,0.15)]" 
                    style={{ backgroundColor: mediaColors[index % mediaColors.length] }}
                  ></span>
                  <span className="text-zinc-400 text-[9px] truncate max-w-[80px] font-mono-data font-semibold">{item.name}</span>
                  <span className="font-bold text-white mt-0.5">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chart B: Topic Distribution Histogram (via Recharts) */}
          <div className="glass-panel rounded-2xl p-5 shadow-lg flex flex-col justify-between min-h-[320px] border border-indigo-950/50">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 mb-4 font-mono-data">Topic Category Distribution</h3>
              <div className="h-44 w-full">
                {isMounted && barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} layout="vertical" margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
                      <XAxis type="number" stroke="#909097" fontSize={9} hide />
                      <YAxis dataKey="name" type="category" stroke="#909097" fontSize={9} width={75} axisLine={false} tickLine={false} />
                      <RechartsTooltip 
                        contentStyle={{ background: "#0b0f19", borderColor: "rgba(99,102,241,0.2)", color: "#d4e4fa", fontSize: "11px", borderRadius: "8px" }}
                      />
                      <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                        {barData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill="url(#barGradient)" />
                        ))}
                      </Bar>
                      {/* Define gradient colors */}
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="100%" stopColor="#06b6d4" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-zinc-500 text-xs flex items-center justify-center h-full font-mono-data">No topics classified yet</div>
                )}
              </div>
            </div>
            <div className="text-center text-[9px] text-zinc-500 border-t border-indigo-950/40 pt-4 mt-4 uppercase font-bold tracking-wider font-mono-data">
              Event Category Frequency breakdown
            </div>
          </div>

          {/* Chart C: Collective Ideological Bias Spectrum */}
          <div className="glass-panel rounded-2xl p-5 shadow-lg flex flex-col justify-between min-h-[320px] border border-indigo-950/50">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 mb-4 font-mono-data">Collective Ideological Lean</h3>
              
              <div className="space-y-6 py-6">
                {/* Horizontal Spectrum Gradient */}
                <div className="relative">
                  <div className="h-4 w-full rounded-full bg-gradient-to-r from-cyber-rose via-zinc-400 to-cyber-emerald border border-zinc-800/80"></div>
                  
                  {/* Slider cursor showing calculated average score */}
                  <div
                    className="absolute -top-1.5 flex flex-col items-center transition-all duration-500"
                    style={{ left: `calc(${biasPercentage}% - 8px)` }}
                  >
                    <div className="h-7 w-4 bg-white border border-slate-900 rounded-md shadow-[0_0_12px_rgba(255,255,255,0.4)] flex items-center justify-center cursor-default">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyber-indigo"></div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between text-[9px] text-zinc-400 font-bold uppercase px-1 font-mono-data">
                  <span>Left Lean</span>
                  <span>Center</span>
                  <span>Right Lean</span>
                </div>
              </div>

              {/* Summary of lean scores */}
              <div className="bg-zinc-950/60 border border-zinc-850/80 rounded-xl p-3 text-xs flex items-center justify-between">
                <div>
                  <span className="text-zinc-500 font-bold block text-[9px] uppercase font-mono-data">Aggregated Index</span>
                  <span className="font-extrabold text-white">
                    {biasScore.toFixed(2)} / 5.0
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-zinc-500 font-bold block text-[9px] uppercase font-mono-data">General Bias</span>
                  <span className="font-bold text-cyber-cyan shadow-sm">
                    {biasScore < 2.2 ? "LEFT BIAS" : biasScore < 2.8 ? "CENTER-LEFT" : biasScore < 3.2 ? "CENTERED" : biasScore < 3.8 ? "CENTER-RIGHT" : "RIGHT BIAS"}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="text-center text-[9px] text-zinc-500 border-t border-indigo-950/40 pt-4 mt-4 uppercase font-bold tracking-wider font-mono-data">
              Ideological spectrum weighted calculation
            </div>
          </div>
        </section>

      </div>

      {/* 6. EVENT DETAILS SLIDE OVER GLASS PANEL */}
      {selectedEvent && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[450px] glass-dossier shadow-2xl z-50 transition-all duration-300 p-6 flex flex-col justify-between border-l border-indigo-950/80">
          <div>
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan text-[10px] font-bold uppercase mb-2">
                  <Globe className="w-3.5 h-3.5" />
                  {selectedEvent.country}
                </span>
                <h3 className="text-xl font-extrabold text-white leading-snug">{selectedEvent.title}</h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800/80 p-2 rounded-xl transition-all"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 font-mono-data">AI-Generated Intelligence Summary</h4>
                <div className="text-xs text-zinc-300 space-y-3 leading-relaxed whitespace-pre-line font-body-sm bg-zinc-950/40 border border-zinc-850/80 p-4 rounded-xl">
                  {selectedEvent.summary || "No intelligence summary generated yet for this event."}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-indigo-950/40 pt-6 font-body-sm">
                <div>
                  <h5 className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Geographic Coordinates</h5>
                  <span className="text-xs text-white font-mono-data font-semibold">
                    {selectedEvent.latitude.toFixed(4)}, {selectedEvent.longitude.toFixed(4)}
                  </span>
                </div>
                <div>
                  <h5 className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Media Source Count</h5>
                  <span className="text-xs text-white font-semibold">
                    {selectedEvent.source_count} reporting publishers
                  </span>
                </div>
                <div>
                  <h5 className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Classification Topic</h5>
                  <span className="text-xs text-cyber-cyan font-bold uppercase font-mono-data">
                    {selectedEvent.topic}
                  </span>
                </div>
                <div>
                  <h5 className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Importance Level</h5>
                  <span className="text-xs text-cyber-emerald font-bold">
                    {selectedEvent.importance_score.toFixed(1)} / 10.0
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-indigo-950/40 pt-6">
            <button
              onClick={() => setSelectedEvent(null)}
              className="w-full py-3 bg-zinc-900/60 border border-zinc-850/80 hover:bg-zinc-800 text-xs font-bold transition-all text-center text-zinc-400 rounded-xl"
            >
              Close Detailed Panel
            </button>
          </div>
        </div>
      )}

      {/* 7. FULL-SCREEN SKELETON SYNTHESIS OVERLAY */}
      {triggerStatus.running && (
        <div className="fixed inset-0 bg-[#030712] z-[10000] flex flex-col antialiased relative overflow-hidden">
          {/* Animated Sweeping Scanning Line */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyber-cyan/10 to-transparent h-1/3 w-full animate-scan pointer-events-none z-10"></div>
          
          {/* Subtle Grid Layout */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(99,102,241,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none z-0"></div>

          {/* Top Navbar Skeleton */}
          <nav className="flex justify-between items-center px-margin-desktop w-full h-16 bg-[#080c16]/80 border-b border-indigo-950/40 z-20">
            <div className="flex items-center gap-8">
              <span className="font-extrabold text-lg text-cyber-cyan drop-shadow-[0_0_10px_rgba(6,182,212,0.4)]">GlobeLens AI</span>
              <div className="hidden md:flex items-center gap-6">
                <span className="text-cyber-indigo font-bold border-b-2 border-cyber-indigo pb-1 text-xs uppercase tracking-wider font-mono-data">
                  Pipeline Ingestion Active
                </span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-zinc-900 border border-indigo-950/40 animate-pulse"></div>
          </nav>

          {/* Skeleton Content */}
          <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full px-6 py-10 relative z-20">
            <div className="space-y-6">
              {/* Dynamic Status card (Pulsing and Glassmorphic) */}
              <div className="glass-panel rounded-2xl p-6 border border-cyber-cyan/45 shadow-[0_0_30px_rgba(6,182,212,0.15)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyber-indigo via-cyber-cyan to-cyber-emerald"></div>
                <div className="flex items-center gap-4 mb-4">
                  <Cpu className="w-8 h-8 text-cyber-cyan animate-spin" />
                  <div>
                    <h2 className="text-lg font-bold text-white font-mono-data">System Worker Override Active</h2>
                    <span className="text-xs text-cyber-indigo font-bold tracking-wider font-mono-data uppercase">{triggerStatus.name}</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-300 font-mono-data mb-4 bg-zinc-950/85 p-3.5 border border-indigo-950/50 rounded-lg">
                  {triggerStatus.message}
                </p>

                {/* Progress bar container */}
                <div className="w-full bg-zinc-950 rounded-full h-4 border border-indigo-950/50 overflow-hidden relative shadow-[inset_0_1px_4px_rgba(0,0,0,0.6)]">
                  <div
                    className="bg-gradient-to-r from-cyber-indigo to-cyber-cyan h-full rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(6,182,212,0.8)]"
                    style={{ width: `${triggerStatus.progress}%` }}
                  ></div>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold text-white font-mono-data select-none">
                    {triggerStatus.progress}% SYNTHESIZED
                  </span>
                </div>
              </div>

              {/* Shimmer skeleton lines */}
              <div className="space-y-3 pt-6 border-t border-indigo-950/40">
                <div className="w-full h-4 rounded bg-zinc-900/60 border border-zinc-850/60 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-850/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                </div>
                <div className="w-11/12 h-4 rounded bg-zinc-900/60 border border-zinc-850/60 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-850/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                </div>
                <div className="w-4/5 h-4 rounded bg-zinc-900/60 border border-zinc-850/60 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-850/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
