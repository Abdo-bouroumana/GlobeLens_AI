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
      if (weights[bias]) {
        totalWeight += weights[bias] * count;
        totalCount += count;
      }
    });

    return totalCount > 0 ? totalWeight / totalCount : 3.0;
  };

  const biasScore = calculateBiasScore();
  const biasPercentage = ((biasScore - 1) / 4) * 100;

  // Render chart data formats
  const pieData = Object.entries(stats.media_split).map(([name, value]) => ({
    name,
    value
  }));
  const mediaColors = ["#7c3aed", "#3b82f6", "#10b981", "#dec29a"];

  const barData = Object.entries(stats.topic_distribution).map(([topic, count]) => ({
    name: topic,
    count
  }));

  if (!token) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="text-center text-zinc-400">Redirecting to clearance gateway...</div>
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
            onClick={() => router.push("/")}
            className="flex items-center gap-2 bg-blue-950/20 border border-blue-900/30 hover:bg-blue-950/40 text-blue-400 text-sm px-4 py-2.5 rounded-xl transition-all"
          >
            <Globe className="w-4 h-4" />
            Operational Console
          </button>
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
                  <span className="text-[9px] font-semibold text-zinc-500 uppercase">Status</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {srv.status === "UP" ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/50 animate-pulse"></span>
                    <span className="text-[10px] text-emerald-400 font-bold">ONLINE</span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-rose-500 shadow-md shadow-rose-500/50 animate-pulse"></span>
                    <span className="text-[10px] text-rose-400 font-bold">DOWN</span>
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
                <span className="text-[10px] text-zinc-500 font-mono-data">Ingestion velocity</span>
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
          <Map events={mapEvents} selectedEvent={selectedEvent} onSelectEvent={setSelectedEvent} />
        </section>

        {/* 4. ACTIVE ADMINISTRATIVE TRIGGER CONSOLE */}
        <section className="lg:col-span-1 bg-zinc-900/30 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-5 flex flex-col justify-between shadow-lg h-[500px]">
          <div>
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2 font-headline-lg-mobile">
              <Cpu className="w-5 h-5 text-blue-500" />
              Administrative Overrides
            </h2>
            <p className="text-xs text-zinc-400 mb-6 font-body-sm">
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
                  desc: "Compute offline Sentence-Transformer float embeddings.",
                  endpoint: "/api/v1/admin/embed/process"
                },
                {
                  label: "Run Cluster Partitioning",
                  desc: "Cosine similarity grouping into event clusters.",
                  endpoint: "/api/v1/admin/cluster/process"
                },
                {
                  label: "Run LLM Enrichment",
                  desc: "Synthesize clustered articles using Gemini and local mDeBERTa.",
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

          <div className="text-center text-[10px] text-zinc-500 border-t border-zinc-950 pt-4 mt-4 font-mono-data">
            Authorized administrator console override session.
          </div>
        </section>

        {/* 5. MEDIA SOURCE & SPECTRUM CLASSIFICATIONS */}
        <section className="lg:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Chart A: Media Split Donut Chart (via Recharts) */}
          <div className="bg-zinc-900/30 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between min-h-[320px]">
            <div>
              <h3 className="text-sm font-semibold text-white mb-4">Media Split Breakdown</h3>
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
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={mediaColors[index % mediaColors.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ background: "#1c2b3c", borderColor: "#45464d", color: "#d4e4fa", fontSize: "11px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-zinc-500 text-xs">No media data available</div>
                )}
                {/* Core Total overlay */}
                <div className="absolute text-center pointer-events-none">
                  <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-wider font-mono-data">Total</span>
                  <span className="text-xl font-bold text-white">
                    {pieData.reduce((acc, curr) => acc + curr.value, 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs mt-4 pt-4 border-t border-zinc-950 font-body-sm">
              {pieData.map((item, index) => (
                <div key={item.name} className="flex flex-col items-center">
                  <span 
                    className="inline-block w-2 h-2 rounded-full mb-1" 
                    style={{ backgroundColor: mediaColors[index % mediaColors.length] }}
                  ></span>
                  <span className="text-zinc-400 text-[9px] truncate max-w-[80px] font-mono-data">{item.name}</span>
                  <span className="font-bold text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chart B: Topic Distribution Histogram (via Recharts) */}
          <div className="bg-zinc-900/30 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between min-h-[320px]">
            <div>
              <h3 className="text-sm font-semibold text-white mb-4">Topic Category Distribution</h3>
              <div className="h-44 w-full">
                {isMounted && barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} layout="vertical" margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
                      <XAxis type="number" stroke="#909097" fontSize={9} hide />
                      <YAxis dataKey="name" type="category" stroke="#909097" fontSize={9} width={75} axisLine={false} tickLine={false} />
                      <RechartsTooltip 
                        contentStyle={{ background: "#1c2b3c", borderColor: "#45464d", color: "#d4e4fa", fontSize: "11px" }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {barData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill="url(#barGradient)" />
                        ))}
                      </Bar>
                      {/* Define gradient colors */}
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#7c3aed" />
                          <stop offset="100%" stopColor="#3b82f6" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-zinc-500 text-xs flex items-center justify-center h-full">No topics classified yet</div>
                )}
              </div>
            </div>
            <div className="text-center text-[9px] text-zinc-500 border-t border-zinc-950 pt-4 mt-4 uppercase font-semibold font-mono-data">
              Event Category Frequency breakdown
            </div>
          </div>

          {/* Chart C: Collective Ideological Bias Spectrum */}
          <div className="bg-zinc-900/30 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between min-h-[320px]">
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

                <div className="flex justify-between text-[9px] text-zinc-400 font-bold uppercase px-1 font-mono-data">
                  <span>Left Lean</span>
                  <span>Center</span>
                  <span>Right Lean</span>
                </div>
              </div>

              {/* Summary of lean scores */}
              <div className="bg-zinc-950/60 border border-zinc-800/50 rounded-xl p-3 text-xs flex items-center justify-between">
                <div>
                  <span className="text-zinc-500 font-semibold block text-[9px] uppercase font-mono-data">Aggregated Index</span>
                  <span className="font-extrabold text-white">
                    {biasScore.toFixed(2)} / 5.0
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-zinc-500 font-semibold block text-[9px] uppercase font-mono-data">General Bias</span>
                  <span className="font-bold text-blue-400">
                    {biasScore < 2.2 ? "LEFT BIAS" : biasScore < 2.8 ? "CENTER-LEFT" : biasScore < 3.2 ? "CENTERED" : biasScore < 3.8 ? "CENTER-RIGHT" : "RIGHT BIAS"}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="text-center text-[9px] text-zinc-500 border-t border-zinc-950 pt-4 mt-4 uppercase font-semibold font-mono-data">
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
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 font-mono-data">AI-Generated Intelligence Summary</h4>
                <div className="text-xs text-zinc-300 space-y-3 leading-relaxed whitespace-pre-line font-body-sm">
                  {selectedEvent.summary || "No intelligence summary generated yet for this event."}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-zinc-900 pt-6 font-body-sm">
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
                  <span className="text-xs text-blue-400 font-bold uppercase">
                    {selectedEvent.topic}
                  </span>
                </div>
                <div>
                  <h5 className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Importance Level</h5>
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

      {/* 7. FULL-SCREEN SKELETON SYNTHESIS OVERLAY */}
      {/* Ports the visuals from synthesizing_intelligence_globelens_ai and loading_feed_globelens_ai */}
      {triggerStatus.running && (
        <div className="fixed inset-0 bg-slate-950 z-[10000] flex flex-col antialiased">
          {/* Top Navbar Skeleton */}
          <nav className="flex justify-between items-center px-margin-desktop w-full h-16 bg-surface/80 border-b border-outline-variant">
            <div className="flex items-center gap-8">
              <span className="font-headline-lg text-headline-lg font-bold text-primary">GlobeLens AI</span>
              <div className="hidden md:flex items-center gap-6">
                <span className="text-primary font-bold border-b-2 border-primary pb-1 text-xs uppercase tracking-wider">Dashboard Ingestion</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant"></div>
          </nav>

          {/* Skeleton Content */}
          <div className="flex-1 flex flex-col justify-center max-w-4xl mx-auto w-full px-6 py-10 relative">
            <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>

            <div className="relative z-10 space-y-6">
              {/* Dynamic Status card (Pulsing and Glassmorphic) */}
              <div className="glass-panel rounded-2xl p-6 border border-primary/45 shadow-2xl relative overflow-hidden group animate-pulse">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-600 via-primary to-blue-500"></div>
                <div className="flex items-center gap-3 mb-4">
                  <Cpu className="w-6 h-6 text-primary animate-spin" />
                  <h2 className="text-lg font-bold text-white">Active Background worker: {triggerStatus.name}</h2>
                </div>
                <p className="text-xs text-zinc-300 font-mono-data mb-4 bg-zinc-950/70 p-3 border border-zinc-800 rounded-lg">
                  {triggerStatus.message}
                </p>

                {/* Progress bar container */}
                <div className="w-full bg-zinc-950 rounded-full h-4 border border-zinc-800 overflow-hidden relative">
                  <div
                    className="bg-gradient-to-r from-violet-600 to-blue-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${triggerStatus.progress}%` }}
                  ></div>
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white font-mono-data select-none">
                    {triggerStatus.progress}%
                  </span>
                </div>
              </div>

              {/* Shimmer skeleton lines */}
              <div className="space-y-3 pt-6 border-t border-zinc-900">
                <div className="w-full h-4 rounded bg-surface-container-high relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-800/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                </div>
                <div className="w-11/12 h-4 rounded bg-surface-container-high relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-800/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                </div>
                <div className="w-4/5 h-4 rounded bg-surface-container-high relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-800/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                </div>
                <div className="w-5/6 h-4 rounded bg-surface-container-high relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-800/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
