/**
 * GlobeLens AI — Next.js Root Page (Placeholder)
 * This placeholder confirms the frontend container is alive.
 * Replace with full application UI during development sprints.
 */
export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', sans-serif",
        color: "#fff",
      }}
    >
      <div style={{ textAlign: "center", padding: "2rem" }}>
        {/* Logo / Brand */}
        <div style={{ marginBottom: "1.5rem" }}>
          <span
            style={{
              fontSize: "4rem",
              display: "block",
              marginBottom: "0.5rem",
            }}
          >
            🌍
          </span>
          <h1
            style={{
              fontSize: "3rem",
              fontWeight: 800,
              background: "linear-gradient(90deg, #a78bfa, #60a5fa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              margin: 0,
            }}
          >
            GlobeLens AI
          </h1>
          <p
            style={{
              fontSize: "1.2rem",
              color: "#a0aec0",
              marginTop: "0.5rem",
            }}
          >
            News Intelligence Platform
          </p>
        </div>

        {/* Status badges */}
        <div
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: "2rem",
          }}
        >
          {[
            { label: "Frontend", status: "✅ Online", color: "#48bb78" },
            { label: "Backend API", status: "/health →", color: "#60a5fa" },
            { label: "pgvector DB", status: "Port 5432", color: "#f6ad55" },
            { label: "Redis", status: "Port 6379", color: "#fc8181" },
            { label: "Elasticsearch", status: "Port 9200", color: "#76e4f7" },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "12px",
                padding: "0.75rem 1.25rem",
                backdropFilter: "blur(10px)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "#a0aec0" }}>
                {item.label}
              </div>
              <div style={{ color: item.color, fontWeight: 600 }}>
                {item.status}
              </div>
            </div>
          ))}
        </div>

        {/* Links */}
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            style={{
              padding: "0.75rem 2rem",
              background: "linear-gradient(90deg, #7c3aed, #3b82f6)",
              borderRadius: "50px",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "0.95rem",
            }}
          >
            📖 API Docs (Swagger)
          </a>
          <a
            href="http://localhost:8000/health"
            target="_blank"
            rel="noreferrer"
            style={{
              padding: "0.75rem 2rem",
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "50px",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "0.95rem",
            }}
          >
            ❤️ Health Check
          </a>
        </div>

        <p style={{ color: "#4a5568", marginTop: "3rem", fontSize: "0.85rem" }}>
          Version 2.0 · Docker Dev Environment · Replace with full UI
        </p>
      </div>
    </main>
  );
}
