import { useState, useCallback, useMemo } from "react";

// ─── Pattern Components ─────────────────────────────────────────────

function LazyInitPattern() {
  const [items, setItems] = useState(() => {
    // Lazy initializer — runs only once, not on every render
    const seed = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      value: Math.floor(Math.random() * 1000),
      active: false,
    }));
    return seed.sort((a, b) => a.value - b.value);
  });

  const toggle = (id) =>
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, active: !item.active } : item
      )
    );

  const activeCount = items.filter((i) => i.active).length;

  return (
    <div>
      <p style={{ color: "var(--sub)", fontSize: 13, marginBottom: 12 }}>
        Expensive computation runs <em>once</em> via{" "}
        <code style={codeStyle}>useState(() =&gt; ...)</code> — not on
        every render. Click chips to toggle.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={badgeStyle}>{activeCount} active</span>
        <span style={{ ...badgeStyle, background: "var(--surface)" }}>
          {items.length} total
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => toggle(item.id)}
            style={{
              ...chipStyle,
              background: item.active ? "var(--accent)" : "var(--surface)",
              color: item.active ? "#fff" : "var(--text)",
              transform: item.active ? "scale(1.08)" : "scale(1)",
              boxShadow: item.active
                ? "0 2px 12px var(--accent-glow)"
                : "none",
            }}
          >
            {item.value}
          </button>
        ))}
      </div>
    </div>
  );
}

function FunctionalUpdaterPattern() {
  const [history, setHistory] = useState([{ action: "init", count: 0, ts: Date.now() }]);

  const current = history[history.length - 1].count;

  const act = (action, fn) => {
    // Functional updater guarantees correct previous state
    setHistory((prev) => {
      const last = prev[prev.length - 1].count;
      const next = fn(last);
      return [...prev.slice(-19), { action, count: next, ts: Date.now() }];
    });
  };

  const rapidFire = () => {
    // Without functional updater, these would all read the SAME stale value
    for (let i = 0; i < 5; i++) {
      act("rapid+1", (c) => c + 1);
    }
  };

  return (
    <div>
      <p style={{ color: "var(--sub)", fontSize: 13, marginBottom: 12 }}>
        <code style={codeStyle}>setState(prev =&gt; ...)</code> ensures
        correct state even with batched/rapid updates.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 36, fontWeight: 800, fontFamily: "var(--mono)", color: "var(--accent)" }}>
          {current}
        </span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button style={btnStyle} onClick={() => act("-1", (c) => c - 1)}>−1</button>
          <button style={btnStyle} onClick={() => act("+1", (c) => c + 1)}>+1</button>
          <button style={btnStyle} onClick={() => act("×2", (c) => c * 2)}>×2</button>
          <button style={{ ...btnStyle, background: "var(--accent)", color: "#fff" }} onClick={rapidFire}>
            rapid +5
          </button>
          <button
            style={{ ...btnStyle, opacity: 0.6 }}
            onClick={() => setHistory([{ action: "reset", count: 0, ts: Date.now() }])}
          >
            reset
          </button>
        </div>
      </div>
      <div style={{ maxHeight: 140, overflowY: "auto", ...scrollStyle }}>
        {[...history].reverse().map((h, i) => (
          <div key={i} style={logRow}>
            <span style={{ color: "var(--sub)", fontFamily: "var(--mono)", fontSize: 11 }}>
              {new Date(h.ts).toLocaleTimeString()}
            </span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{h.action}</span>
            <span style={{ marginLeft: "auto", fontWeight: 700, color: "var(--accent)" }}>{h.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ObjectStatePattern() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "developer",
    notifications: { email: true, push: false, sms: false },
    tags: [],
  });

  const [submitted, setSubmitted] = useState(null);

  const update = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const toggleNotif = (key) =>
    setForm((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: !prev.notifications[key],
      },
    }));

  const addTag = (tag) => {
    if (tag && !form.tags.includes(tag)) {
      setForm((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
    }
  };

  const removeTag = (tag) =>
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));

  const TAGS = ["react", "typescript", "node", "python", "rust", "go", "design", "devops"];

  return (
    <div>
      <p style={{ color: "var(--sub)", fontSize: 13, marginBottom: 12 }}>
        Nested object state with immutable spread updates —{" "}
        <code style={codeStyle}>{"{ ...prev, nested: { ...prev.nested } }"}</code>
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <input
          style={inputStyle}
          placeholder="Name"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
        />
        <input
          style={inputStyle}
          placeholder="Email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
        />
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {["developer", "designer", "manager", "other"].map((r) => (
          <button
            key={r}
            onClick={() => update("role", r)}
            style={{
              ...chipStyle,
              background: form.role === r ? "var(--accent)" : "var(--surface)",
              color: form.role === r ? "#fff" : "var(--text)",
            }}
          >
            {r}
          </button>
        ))}
      </div>
      <div style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--sub)" }}>
          Notifications (nested state)
        </span>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          {Object.entries(form.notifications).map(([key, val]) => (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <div
                onClick={() => toggleNotif(key)}
                style={{
                  width: 36, height: 20, borderRadius: 10,
                  background: val ? "var(--accent)" : "var(--border)",
                  position: "relative", transition: "background .2s", cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 16, height: 16, borderRadius: "50%",
                    background: "#fff", position: "absolute", top: 2,
                    left: val ? 18 : 2, transition: "left .2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,.2)",
                  }}
                />
              </div>
              <span style={{ fontSize: 12 }}>{key}</span>
            </label>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--sub)" }}>
          Tags (array in state)
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
          {TAGS.map((t) => {
            const active = form.tags.includes(t);
            return (
              <button
                key={t}
                onClick={() => (active ? removeTag(t) : addTag(t))}
                style={{
                  ...chipStyle,
                  background: active ? "var(--accent)" : "var(--surface)",
                  color: active ? "#fff" : "var(--text)",
                  fontSize: 11,
                }}
              >
                {active ? "✕ " : "+"} {t}
              </button>
            );
          })}
        </div>
      </div>
      <button
        onClick={() => setSubmitted(JSON.parse(JSON.stringify(form)))}
        style={{ ...btnStyle, background: "var(--accent)", color: "#fff", width: "100%" }}
      >
        Snapshot State
      </button>
      {submitted && (
        <pre style={preStyle}>{JSON.stringify(submitted, null, 2)}</pre>
      )}
    </div>
  );
}

function DerivedStatePattern() {
  const [items, setItems] = useState([
    { id: 1, name: "Espresso", price: 3.5, qty: 0, category: "coffee" },
    { id: 2, name: "Latte", price: 5.0, qty: 0, category: "coffee" },
    { id: 3, name: "Matcha", price: 5.5, qty: 0, category: "tea" },
    { id: 4, name: "Croissant", price: 4.0, qty: 0, category: "food" },
    { id: 5, name: "Bagel", price: 3.0, qty: 0, category: "food" },
    { id: 6, name: "Chai", price: 4.5, qty: 0, category: "tea" },
  ]);
  const [filter, setFilter] = useState("all");

  const changeQty = (id, delta) =>
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item
      )
    );

  // Derived — computed from state, never stored separately
  const total = useMemo(
    () => items.reduce((sum, i) => sum + i.price * i.qty, 0),
    [items]
  );
  const totalItems = items.reduce((sum, i) => sum + i.qty, 0);
  const categories = ["all", ...new Set(items.map((i) => i.category))];
  const filtered = filter === "all" ? items : items.filter((i) => i.category === filter);

  return (
    <div>
      <p style={{ color: "var(--sub)", fontSize: 13, marginBottom: 12 }}>
        Totals, filters, & counts are <em>derived</em> via{" "}
        <code style={codeStyle}>useMemo</code> — never stored as separate state.
      </p>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            style={{
              ...chipStyle,
              background: filter === c ? "var(--accent)" : "var(--surface)",
              color: filter === c ? "#fff" : "var(--text)",
              textTransform: "capitalize",
            }}
          >
            {c}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {filtered.map((item) => (
          <div key={item.id} style={itemRow}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</span>
              <span style={{ color: "var(--sub)", fontSize: 12, marginLeft: 6 }}>
                ${item.price.toFixed(2)}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button style={smallBtn} onClick={() => changeQty(item.id, -1)}>−</button>
              <span style={{ fontFamily: "var(--mono)", fontWeight: 700, minWidth: 20, textAlign: "center" }}>
                {item.qty}
              </span>
              <button style={smallBtn} onClick={() => changeQty(item.id, 1)}>+</button>
              {item.qty > 0 && (
                <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginLeft: 4 }}>
                  ${(item.price * item.qty).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 0", borderTop: "2px solid var(--border)" }}>
        <span style={{ fontSize: 12, color: "var(--sub)" }}>{totalItems} items</span>
        <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--mono)", color: "var(--accent)" }}>
          ${total.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function StateResetPattern() {
  const [key, setKey] = useState(0);
  return (
    <div>
      <p style={{ color: "var(--sub)", fontSize: 13, marginBottom: 12 }}>
        Changing a component's <code style={codeStyle}>key</code> prop forces
        React to unmount + remount it, fully resetting all internal state.
      </p>
      <ResettableTimer key={key} />
      <button
        onClick={() => setKey((k) => k + 1)}
        style={{ ...btnStyle, background: "var(--danger)", color: "#fff", marginTop: 10, width: "100%" }}
      >
        Force Reset via key={`{${key + 1}}`}
      </button>
    </div>
  );
}

function ResettableTimer() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [intervalId, setIntervalId] = useState(null);

  const start = () => {
    if (running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    setIntervalId(id);
    setRunning(true);
  };

  const stop = () => {
    clearInterval(intervalId);
    setRunning(false);
  };

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 48, fontWeight: 800, fontFamily: "var(--mono)", color: "var(--accent)", letterSpacing: 2 }}>
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10 }}>
        <button style={{ ...btnStyle, background: running ? "var(--border)" : "var(--accent)", color: running ? "var(--text)" : "#fff" }} onClick={start} disabled={running}>
          Start
        </button>
        <button style={btnStyle} onClick={stop} disabled={!running}>
          Stop
        </button>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const codeStyle = {
  fontFamily: "var(--mono)",
  fontSize: 12,
  background: "var(--surface)",
  padding: "2px 6px",
  borderRadius: 4,
  border: "1px solid var(--border)",
};

const chipStyle = {
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 12,
  cursor: "pointer",
  transition: "all .15s",
  fontFamily: "var(--mono)",
};

const btnStyle = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "6px 16px",
  fontSize: 13,
  cursor: "pointer",
  background: "var(--surface)",
  color: "var(--text)",
  fontWeight: 600,
  transition: "all .15s",
};

const smallBtn = {
  width: 26,
  height: 26,
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--text)",
};

const badgeStyle = {
  fontSize: 11,
  fontWeight: 700,
  padding: "3px 10px",
  borderRadius: 20,
  background: "var(--accent)",
  color: "#fff",
  fontFamily: "var(--mono)",
};

const inputStyle = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  background: "var(--surface)",
  color: "var(--text)",
  outline: "none",
  fontFamily: "inherit",
};

const logRow = {
  display: "flex",
  gap: 10,
  padding: "4px 8px",
  fontSize: 12,
  borderBottom: "1px solid var(--border)",
  alignItems: "center",
};

const itemRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 12px",
  borderRadius: 8,
  background: "var(--surface)",
  border: "1px solid var(--border)",
};

const preStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 12,
  fontSize: 11,
  fontFamily: "var(--mono)",
  overflowX: "auto",
  marginTop: 10,
  color: "var(--sub)",
  lineHeight: 1.5,
};

const scrollStyle = {
  scrollbarWidth: "thin",
  scrollbarColor: "var(--border) transparent",
};

// ─── Pattern Data & Main App ────────────────────────────────────────

const PATTERNS = [
  {
    id: "lazy",
    title: "Lazy Initialization",
    icon: "⚡",
    tag: "Performance",
    component: LazyInitPattern,
  },
  {
    id: "functional",
    title: "Functional Updater",
    icon: "🔄",
    tag: "Correctness",
    component: FunctionalUpdaterPattern,
  },
  {
    id: "object",
    title: "Object & Nested State",
    icon: "🧩",
    tag: "Structure",
    component: ObjectStatePattern,
  },
  {
    id: "derived",
    title: "Derived State",
    icon: "📐",
    tag: "Architecture",
    component: DerivedStatePattern,
  },
  {
    id: "reset",
    title: "Key-based Reset",
    icon: "🔑",
    tag: "Lifecycle",
    component: StateResetPattern,
  },
];

export default function AdvancedUseState() {
  const [activeId, setActiveId] = useState("lazy");

  const active = PATTERNS.find((p) => p.id === activeId);
  const ActiveComponent = active.component;

  return (
    <div
      style={{
        "--bg": "#0e0f13",
        "--surface": "#1a1b22",
        "--border": "#2a2b35",
        "--text": "#e4e4e8",
        "--sub": "#8b8c99",
        "--accent": "#6c5ce7",
        "--accent-glow": "rgba(108,92,231,.35)",
        "--danger": "#e74c3c",
        "--mono": "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
        fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
        background: "var(--bg)",
        color: "var(--text)",
        minHeight: "100vh",
        padding: "32px 20px",
        boxSizing: "border-box",
      }}
    >
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--accent)", fontWeight: 700 }}>
              React.useState
            </span>
            <span style={{ fontSize: 11, color: "var(--sub)", padding: "2px 8px", border: "1px solid var(--border)", borderRadius: 4 }}>
              advanced
            </span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
            5 Patterns You Should Know
          </h1>
          <p style={{ color: "var(--sub)", fontSize: 14, margin: "6px 0 0" }}>
            Interactive examples of production-grade useState techniques
          </p>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 4,
            overflowX: "auto",
            paddingBottom: 2,
            marginBottom: 24,
            ...scrollStyle,
          }}
        >
          {PATTERNS.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveId(p.id)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: activeId === p.id ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                background: activeId === p.id ? "rgba(108,92,231,.12)" : "transparent",
                color: activeId === p.id ? "var(--accent)" : "var(--sub)",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: "nowrap",
                transition: "all .15s",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>{p.icon}</span>
              <span>{p.title}</span>
            </button>
          ))}
        </div>

        {/* Active Pattern Card */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 24,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: "linear-gradient(90deg, var(--accent), transparent)",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 22 }}>{active.icon}</span>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{active.title}</h2>
              <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--accent)", fontWeight: 700 }}>
                {active.tag}
              </span>
            </div>
          </div>
          <ActiveComponent />
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 24, color: "var(--sub)", fontSize: 11, fontFamily: "var(--mono)" }}>
          built with React • no useReducer, no context, just useState
        </div>
      </div>
    </div>
  );
}
