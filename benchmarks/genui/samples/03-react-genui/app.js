// Client-rendered React generative UI — the render-cost profile shared by
// Thesys C1/Crayon, tambo, Vercel AI SDK + AI Elements, and assistant-ui:
// a canned "spec" (DATA) hydrated into a React component tree in the browser.
// The same dashboard as the other samples, so only the stack differs.
const html = htm.bind(React.createElement);

const DATA = {
  title: "Revenue overview",
  subtitle: "Acme Analytics · last 30 days",
  kpis: [
    { label: "Revenue", value: "$128,430", delta: "+12.4%", positive: true },
    { label: "Active users", value: "8,942", delta: "+3.1%", positive: true },
    { label: "Conversion", value: "3.8%", delta: "-0.4%", positive: false },
    { label: "Churn", value: "1.2%", delta: "+0.2%", positive: true },
  ],
  trend: [52, 63, 58, 78, 71, 92],
  months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  invoices: [
    { who: "Northwind Ltd", plan: "Enterprise", status: "Paid" },
    { who: "Globex", plan: "Team", status: "Paid" },
    { who: "Initech", plan: "Team", status: "Pending" },
    { who: "Umbrella", plan: "Starter", status: "Paid" },
  ],
};

function Kpi({ label, value, delta, positive }) {
  return html`
    <div className="c-card c-kpi">
      <div className="c-kpi-label">${label}</div>
      <div className="c-kpi-value">${value}</div>
      <div className=${"c-delta " + (positive ? "pos" : "neg")}>
        <span className="c-dot"></span>${delta}
      </div>
    </div>`;
}

function AreaChart({ points }) {
  const w = 460, h = 150, pad = 8;
  const max = Math.max(...points);
  const step = (w - pad * 2) / (points.length - 1);
  const xy = points.map((p, i) => [pad + i * step, h - pad - (p / max) * (h - pad * 2)]);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${pad},${h - pad} ${line} ${(w - pad).toFixed(1)},${h - pad}`;
  return html`
    <svg className="c-chart" viewBox=${`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#7c3aed" stop-opacity="0" />
        </linearGradient>
      </defs>
      <polygon points=${area} fill="url(#g)" />
      <polyline points=${line} fill="none" stroke="#7c3aed" stroke-width="2.5"
        stroke-linejoin="round" stroke-linecap="round" />
      ${xy.map(([x, y]) => html`<circle cx=${x} cy=${y} r="3.5" fill="#fff" stroke="#7c3aed" stroke-width="2" />`)}
    </svg>`;
}

function App() {
  return html`
    <div className="c-root">
      <div className="c-head">
        <h1>${DATA.title}</h1>
        <p>${DATA.subtitle}</p>
      </div>
      <div className="c-kpis">
        ${DATA.kpis.map((k) => html`<${Kpi} ...${k} key=${k.label} />`)}
      </div>
      <div className="c-grid">
        <div className="c-card c-pad">
          <div className="c-card-title">Revenue trend</div>
          <div className="c-card-cap">Monthly gross, Jan–Jun</div>
          <${AreaChart} points=${DATA.trend} />
          <div className="c-months">${DATA.months.map((m) => html`<span key=${m}>${m}</span>`)}</div>
        </div>
        <div className="c-card c-pad">
          <div className="c-card-title">Recent invoices</div>
          <div className="c-list">
            ${DATA.invoices.map(
              (r) => html`
              <div className="c-row" key=${r.who}>
                <div>
                  <div className="c-who">${r.who}</div>
                  <div className="c-plan">${r.plan}</div>
                </div>
                <span className=${"c-badge " + r.status.toLowerCase()}>${r.status}</span>
              </div>`
            )}
          </div>
        </div>
      </div>
      <button className="c-btn">View full report →</button>
    </div>`;
}

ReactDOM.createRoot(document.getElementById("root")).render(html`<${App} />`);
