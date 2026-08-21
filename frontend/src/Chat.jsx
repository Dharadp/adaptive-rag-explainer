import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

const AGE_STOPS = [
  { key: "kid",    label: "Kid",    icon: "🧸", hint: "Simple words, fun analogies" },
  { key: "teen",   label: "Teen",   icon: "🎒", hint: "Clear, relatable, a bit of real terminology" },
  { key: "adult",  label: "Adult",  icon: "🎓", hint: "Practical and clear, no jargon" },
  { key: "expert", label: "Expert", icon: "🔬", hint: "Technical, precise, deep" },
];

const Chat = () => {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  // inside your component:
  const [domains, setDomains] = useState([]);
  const [domain, setDomain] = useState("");
  const [ageIndex, setAgeIndex] = useState(2); // default: Adult
  const hasFetchedDomains = useRef(false);
  const currentAge = AGE_STOPS[ageIndex];

  useEffect(() => {
    if (hasFetchedDomains.current) return;
    hasFetchedDomains.current = true;
    fetch(`${process.env.REACT_APP_API_URL}/domains`)
      .then((res) => res.json())
      .then((data) => {
        setDomains(data.domains);
        if (data.domains.length) setDomain(data.domains[0]);
      });
  }, []);

  const handleAsk = async () => {
    if (!question.trim()) return;
    setAnswer("");
    setLoading(true);
    setStreaming(false);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, age_group: currentAge.key, domain }),
      });
      console.log("Response status:", res.status);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let firstChunk = true;
      let receivedAnyContent = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (!receivedAnyContent) {
            setAnswer("Something went wrong and no response was received. Please try again.");
          }
          break;
        }
        if (!value) {
          // stream produced a "not done" read with no value — treat as a hiccup, keep looping
          continue;
        }
        receivedAnyContent = true;
        if(firstChunk) {
            setLoading(false);
            setStreaming(true);
            firstChunk = false;
        }
        const chunk = decoder.decode(value, { stream: true });
        setAnswer((prev) => prev + chunk);
      }
    } catch (err) {
      if(err.message) {
        setAnswer("The model is a bit overloaded right now — mind trying again in a few seconds?");
      } else {
        setAnswer("Error: " + err.message);
      }
      setLoading(false);
      setStreaming(false);
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  };

  return (
    <div style={styles.page}>
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <div style={styles.card}>
        <div style={styles.eyebrow}>EXPLAIN IT TO ME</div>
        <h1 style={styles.title}>Any topic. Tuned to who's listening.</h1>

        <label style={styles.label}>Topic</label>
        <input
          style={styles.input}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. how vaccines work, black holes, inflation..."
        />

        <label style={styles.label}>Explain it for</label>
        <div style={styles.ageRow}>
          {AGE_STOPS.map((stop, i) => (
            <button
              key={stop.key}
              onClick={() => setAgeIndex(i)}
              style={{
                ...styles.ageStop,
                ...(i === ageIndex ? styles.ageStopActive : {}),
              }}
            >
              <span style={styles.ageIcon}>{stop.icon}</span>
              <span>{stop.label}</span>
            </button>
          ))}
        </div>
        <input
          type="range"
          min="0"
          max="3"
          value={ageIndex}
          onChange={(e) => setAgeIndex(Number(e.target.value))}
          style={styles.slider}
        />
        <div style={styles.ageHint}>{currentAge.hint}</div>
        <label style={styles.label}>Knowledge base</label>
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          style={styles.input}
        >
          {domains.map((d) => (
            <option key={d} value={d}>{d.replace(/-/g, " ")}</option>
          ))}
        </select>
        <button
          onClick={handleAsk}
          disabled={loading || streaming || !question.trim()}
          style={styles.cta}
        >
          {loading ? "Thinking…" : streaming ? "Explaining…" : "Explain it"}
        </button>

        <div style={styles.output}>
          {loading && <SkeletonLoader />}
          {!loading && answer && (
            <div style={styles.answerBox}>
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {answer}
              </ReactMarkdown>
            </div>
          )}
          {!loading && !answer && (
            <div style={styles.empty}>Pick a topic and an audience — the explanation shows up here.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function SkeletonLoader() {
  const bar = (w) => ({
    height: 12,
    width: w,
    background: "#262E52",
    borderRadius: 6,
    marginBottom: 10,
    animation: "pulse 1.3s ease-in-out infinite",
  });
  return (
    <div>
      <div style={bar("92%")} />
      <div style={bar("78%")} />
      <div style={bar("64%")} />
      <style>{`@keyframes pulse { 0%,100% { opacity: .5 } 50% { opacity: 1 } }`}</style>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#12172B",
    display: "flex",
    justifyContent: "center",
    padding: "48px 20px",
    fontFamily: "'Inter', sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "50%",
    background: "#1C2340",
    borderRadius: 16,
    padding: "36px 36px 32px",
    boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: "0.14em",
    color: "#F5A623",
    fontWeight: 600,
    marginBottom: 10,
  },
  title: {
    fontFamily: "'Fraunces', serif",
    fontWeight: 600,
    fontSize: 28,
    color: "#F4F1EA",
    margin: "0 0 28px",
    lineHeight: 1.25,
  },
  label: {
    display: "block",
    fontSize: 13,
    color: "#9AA3C7",
    marginBottom: 8,
    fontWeight: 500,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #313A63",
    background: "#141A33",
    color: "#F4F1EA",
    fontSize: 15,
    marginBottom: 24,
    outline: "none",
  },
  ageRow: {
    display: "flex",
    gap: 8,
    marginBottom: 10,
  },
  ageStop: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    padding: "10px 6px",
    borderRadius: 10,
    border: "1px solid #313A63",
    background: "#141A33",
    color: "#9AA3C7",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
  },
  ageStopActive: {
    border: "1px solid #F5A623",
    background: "#26224A",
    color: "#F4F1EA",
  },
  ageIcon: { fontSize: 18 },
  slider: {
    width: "100%",
    accentColor: "#F5A623",
    marginBottom: 8,
  },
  ageHint: {
    fontSize: 13,
    color: "#5EEAD4",
    marginBottom: 24,
  },
  cta: {
    width: "100%",
    padding: "13px 0",
    borderRadius: 10,
    border: "none",
    background: "#F5A623",
    color: "#12172B",
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
    marginBottom: 24,
  },
  output: {
    borderTop: "1px solid #262E52",
    paddingTop: 20,
  },
  answerBox: {
    color: "#F4F1EA",
    fontSize: 15,
    lineHeight: 1.65,
  },
  empty: {
    color: "#5A628C",
    fontSize: 14,
    fontStyle: "italic",
  },
};

export default Chat;