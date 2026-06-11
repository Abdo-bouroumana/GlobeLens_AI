"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail, Key, ArrowRight, Shield, Globe, Send, ArrowLeft } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type ViewState = "login" | "register" | "forgot";

export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState<ViewState>("login");
  
  // Login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regStatus, setRegStatus] = useState<string | null>(null);

  // Recovery fields
  const [recEmail, setRecEmail] = useState("");
  const [recSent, setRecSent] = useState(false);

  // Handle Login submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Invalid corporate credentials");
      }

      const data = await response.json();
      const token = data.access_token;
      
      // Store token in localStorage and cookies for middleware access
      localStorage.setItem("admin_token", token);
      document.cookie = `admin_token=${token}; path=/; max-age=1800; SameSite=Strict; Secure`;

      // Fetch user profile to verify role
      const profileResponse = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        // Redirect to admin dashboard if Admin, otherwise home map
        if (profile.role === "ADMIN") {
          router.push("/admin/dashboard");
        } else {
          router.push("/");
        }
      } else {
        router.push("/");
      }
    } catch (err: any) {
      setLoginError(err.message || "An authentication error occurred.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle registration dispatch
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegStatus("Submitting credentials...");
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${firstName} ${lastName}`,
          email: regEmail,
          password: regPassword,
        }),
      });

      if (response.ok) {
        setRegStatus(" Clearance requested. Redirecting to login...");
        setTimeout(() => {
          setView("login");
          setRegStatus(null);
        }, 2000);
      } else {
        const err = await response.json().catch(() => ({}));
        setRegStatus(`Error: ${err.detail || "Clearance failed"}`);
      }
    } catch (err) {
      setRegStatus("Failed to submit enrollment request.");
    }
  };

  return (
    <main className="bg-surface text-on-surface min-h-screen flex selection:bg-primary-container selection:text-primary relative overflow-hidden font-body-md">
      {/* Left Column (Concept Art) - Hidden on Mobile */}
      <div className="hidden lg:flex flex-1 relative flex-col justify-between p-12 overflow-hidden border-r border-outline-variant">
        {/* Background Asset */}
        <div 
          className="absolute inset-0 bg-cover bg-center z-0" 
          style={{ 
            backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDmZKJlShKNDhogzgHf8kGMTnELrPGIBgtDZDBQIoq4WkZf4e8_Zl1bJB7P0NjWPHN3KFk6T6B6WGVcWCG7qRceARj0TLrBLDf2m1MSCoL5dLhuKhr4blPrcQxDgAGVhpT5XcSOdfTV-z8aWWkeOExUIWwLq2sfeps2Ppykxed2EPcagEIqRTQ6F7u41ZEu80wzslf4EvLWa7vfn3bfjUpKAWmmEAzvkb9nC_ijOspMVkSZX5ygpVN8on-effC0CgBw6vHCYsZ8GPAf')",
            opacity: 0.3
          }}
        ></div>
        <div className="absolute inset-0 bg-surface/80 backdrop-blur-md z-0"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-surface/40 z-0"></div>

        {/* Top Branding */}
        <div className="relative z-10 flex items-center gap-3 text-primary">
          <Globe className="w-8 h-8 text-primary animate-pulse" />
          <span className="font-headline-lg text-headline-lg font-bold tracking-tight">GlobeLens AI</span>
        </div>

        {/* Bottom Editorial Anchor */}
        <div className="relative z-10 max-w-xl space-y-stack-md">
          <div className="w-12 h-1 bg-primary rounded-full mb-stack-lg"></div>
          <h2 className="font-display-lg text-display-lg text-on-surface leading-tight">The Informed Edge.</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-md">
            Synthesizing global events into actionable intelligence. Merging traditional newsroom credibility with high-velocity precision data science.
          </p>
        </div>
      </div>

      {/* Right Interaction Column */}
      <div className="flex-1 flex items-center justify-center p-8 sm:p-12 lg:p-24 bg-surface relative overflow-y-auto">
        {/* Mobile Logo */}
        <div className="absolute top-8 left-8 flex lg:hidden items-center gap-2 text-primary">
          <Globe className="w-6 h-6 text-primary" />
          <span className="font-headline-lg-mobile text-headline-lg-mobile font-bold tracking-tight">GlobeLens</span>
        </div>

        {/* Interaction Form Container */}
        <div className="w-full max-w-[400px] relative">
          
          {/* 1. LOGIN VIEW */}
          {view === "login" && (
            <div className="space-y-stack-lg transition-all duration-300 animate-in fade-in">
              <div className="space-y-stack-sm">
                <h1 className="font-headline-xl text-headline-xl text-on-surface">Authenticate</h1>
                <p className="font-body-md text-body-md text-on-surface-variant">Access your intelligence dossier.</p>
              </div>

              <div className="space-y-stack-md">
                {/* OAuth Button */}
                <button 
                  onClick={() => alert("Google Single Sign-On simulation.")}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-outline-variant rounded bg-surface-container-low hover:bg-surface-container transition-colors text-on-surface font-body-md text-body-md font-medium group"
                >
                  <svg className="w-5 h-5 text-on-surface group-hover:text-primary transition-colors" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                  </svg>
                  Continue with Google
                </button>

                {/* Divider */}
                <div className="relative flex items-center py-stack-sm">
                  <div className="flex-grow border-t border-outline-variant"></div>
                  <span className="flex-shrink-0 mx-4 text-outline font-label-caps text-[10px] uppercase tracking-widest">Or Secure Login</span>
                  <div className="flex-grow border-t border-outline-variant"></div>
                </div>

                {/* Credentials Form */}
                <form onSubmit={handleLogin} className="space-y-stack-md">
                  <div className="space-y-stack-sm">
                    <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider" htmlFor="email">Corporate Email</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline">
                        <Mail className="w-5 h-5" />
                      </span>
                      <input 
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="analyst@agency.com"
                        className="w-full bg-surface-container border border-outline-variant rounded pl-10 pr-4 py-3 text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow placeholder:text-outline/50 shadow-inner"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-stack-sm">
                    <div className="flex justify-between items-center">
                      <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider" htmlFor="password">Passphrase</label>
                      <button 
                        type="button" 
                        onClick={() => setViewState("forgot")}
                        className="font-body-sm text-body-sm text-primary hover:text-secondary transition-colors underline-offset-4 hover:underline"
                      >
                        Recover Access
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline">
                        <Key className="w-5 h-5" />
                      </span>
                      <input 
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-surface-container border border-outline-variant rounded pl-10 pr-4 py-3 text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow placeholder:text-outline/50 shadow-inner"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center pt-2">
                    <input 
                      type="checkbox"
                      id="remember"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="w-4 h-4 rounded border-outline-variant bg-surface-container text-primary focus:ring-primary focus:ring-offset-surface cursor-pointer"
                    />
                    <label className="ml-3 font-body-sm text-body-sm text-on-surface-variant cursor-pointer select-none" htmlFor="remember">Maintain secure session parameters</label>
                  </div>

                  {loginError && (
                    <div className="p-3 bg-error/15 border-l-2 border-error text-error text-xs rounded">
                      {loginError}
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={loginLoading}
                    className="w-full mt-4 py-3 px-4 bg-primary text-on-primary font-body-md text-body-md font-medium rounded hover:bg-secondary disabled:opacity-50 transition-colors shadow-sm flex items-center justify-center gap-2 group relative overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      {loginLoading ? "Authenticating clearance..." : "Initialize Uplink"}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>
                </form>
              </div>

              <p className="text-center font-body-sm text-body-sm text-on-surface-variant pt-stack-md border-t border-outline-variant/50">
                No active clearance? 
                <button 
                  type="button" 
                  onClick={() => setViewState("register")}
                  className="text-primary hover:text-secondary transition-colors font-medium ml-1"
                >
                  Request Enrollment
                </button>
              </p>
            </div>
          )}

          {/* 2. REGISTER VIEW */}
          {view === "register" && (
            <div className="space-y-stack-lg transition-all duration-300 animate-in fade-in">
              <div className="space-y-stack-sm">
                <button 
                  type="button" 
                  onClick={() => setViewState("login")}
                  className="flex items-center gap-1 text-outline hover:text-primary transition-colors font-body-sm text-body-sm mb-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </button>
                <h1 className="font-headline-xl text-headline-xl text-on-surface">Enrollment</h1>
                <p className="font-body-md text-body-md text-on-surface-variant">Submit credentials for clearance review.</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-stack-md">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-stack-sm">
                    <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">First Name</label>
                    <input 
                      type="text" 
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant rounded px-4 py-3 text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow"
                      required
                    />
                  </div>
                  <div className="space-y-stack-sm">
                    <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Last Name</label>
                    <input 
                      type="text" 
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full bg-surface-container border border-outline-variant rounded px-4 py-3 text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-stack-sm">
                  <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Corporate Email</label>
                  <input 
                    type="email" 
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant rounded px-4 py-3 text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow"
                    required
                  />
                </div>

                <div className="space-y-stack-sm">
                  <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Security Passphrase</label>
                  <input 
                    type="password" 
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant rounded px-4 py-3 text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow"
                    required
                  />
                  <p className="font-mono-data text-[10px] text-outline mt-1">Requires 12+ chars, alphanumeric & symbol.</p>
                </div>

                {regStatus && (
                  <div className="p-3 bg-surface-container-high border-l-2 border-primary text-xs rounded text-primary">
                    {regStatus}
                  </div>
                )}

                <button 
                  type="submit"
                  className="w-full mt-6 py-3 px-4 border border-primary text-primary hover:bg-primary hover:text-on-primary font-body-md text-body-md font-medium rounded transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  Submit Dossier
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* 3. RECOVERY VIEW */}
          {view === "forgot" && (
            <div className="space-y-stack-lg transition-all duration-300 animate-in fade-in">
              <div className="space-y-stack-sm">
                <button 
                  type="button" 
                  onClick={() => setViewState("login")}
                  className="flex items-center gap-1 text-outline hover:text-primary transition-colors font-body-sm text-body-sm mb-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </button>
                <h1 className="font-headline-xl text-headline-xl text-on-surface">Recover Access</h1>
                <p className="font-body-md text-body-md text-on-surface-variant">Enter your registered communication channel to receive secure recovery protocols.</p>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); setRecSent(true); }} className="space-y-stack-md">
                <div className="space-y-stack-sm">
                  <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Corporate Email</label>
                  <input 
                    type="email" 
                    value={recEmail}
                    onChange={(e) => setRecEmail(e.target.value)}
                    placeholder="analyst@agency.com"
                    className="w-full bg-surface-container border border-outline-variant rounded px-4 py-3 text-on-surface font-body-md text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-shadow"
                    required
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full mt-4 py-3 px-4 bg-surface-container-high border border-outline text-on-surface hover:border-primary hover:text-primary font-body-md text-body-md font-medium rounded transition-all shadow-sm"
                >
                  Dispatch Protocol
                </button>

                {recSent && (
                  <div className="mt-4 p-4 rounded bg-surface-container-lowest border border-outline-variant flex items-start gap-3 animate-in fade-in">
                    <div className="mt-0.5">
                      <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-body-md text-body-md font-medium text-on-surface">Protocol Dispatched</p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">If the credentials match active records, encrypted instructions have been sent.</p>
                    </div>
                  </div>
                )}
              </form>
            </div>
          )}

        </div>
      </div>
    </main>
  );

  // Helper helper to switch views with smooth fade-in
  function setViewState(target: ViewState) {
    setView(target);
    setRecSent(false);
    setLoginError(null);
  }
}
