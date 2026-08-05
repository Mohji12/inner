"""Generate print-ready HTML from END_TO_END_PROJECT_REPORT.md"""
from __future__ import annotations

from pathlib import Path

from generate_architecture_html import md_to_html

ROOT = Path(__file__).resolve().parent
MD_PATH = ROOT / "END_TO_END_PROJECT_REPORT.md"
HTML_PATH = ROOT / "end-to-end-project-report.html"

if not MD_PATH.is_file():
    raise SystemExit(f"Markdown not found at {MD_PATH}")


def main() -> None:
    md = MD_PATH.read_text(encoding="utf-8")
    body = md_to_html(md)
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Mijn Levenspad - End-to-End Project Report</title>
<script src="vendor/mermaid.min.js"></script>
<script>
  document.addEventListener("DOMContentLoaded", function () {{
    function boot() {{
      if (typeof mermaid === "undefined") {{
        var n = document.getElementById("diagram-status");
        if (n) n.textContent = "Mermaid failed to load. Keep this HTML next to the vendor/ folder, or check internet for CDN fallback.";
        return;
      }}
      mermaid.initialize({{
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "loose",
        flowchart: {{ htmlLabels: false }},
        er: {{ useMaxWidth: true }},
        sequence: {{ useMaxWidth: true }}
      }});
      mermaid.run({{ querySelector: ".mermaid" }}).then(function () {{
        var n = document.getElementById("diagram-status");
        if (n) n.textContent = "Diagrams rendered. Use Print / Save as PDF when ready.";
      }}).catch(function (err) {{
        console.error(err);
        var n = document.getElementById("diagram-status");
        if (n) n.textContent = "Some diagrams failed to render. Open the browser console for details.";
      }});
    }}
    if (typeof mermaid === "undefined") {{
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js";
      s.onload = boot;
      s.onerror = boot;
      document.head.appendChild(s);
    }} else {{
      boot();
    }}
  }});
</script>
<style>
  :root {{
    --ink: #1a1f16;
    --muted: #5a6454;
    --line: #d5d9cf;
    --bg: #f7f6f1;
    --card: #ffffff;
    --accent: #4a5d3a;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    color: var(--ink);
    background: var(--bg);
    line-height: 1.55;
    font-size: 14px;
  }}
  .toolbar {{
    position: sticky; top: 0; z-index: 10;
    display: flex; gap: 12px; align-items: center; justify-content: space-between;
    padding: 12px 20px;
    background: #2f3b28; color: #fff;
  }}
  .toolbar button {{
    background: #e8efe0; color: #1a1f16; border: 0; border-radius: 8px;
    padding: 8px 14px; font-weight: 600; cursor: pointer;
  }}
  .wrap {{ max-width: 920px; margin: 0 auto; padding: 28px 20px 80px; }}
  h1 {{ font-size: 28px; margin: 0 0 8px; color: var(--accent); }}
  h2 {{ font-size: 20px; margin-top: 36px; padding-top: 12px; border-top: 1px solid var(--line); }}
  h3 {{ font-size: 16px; margin-top: 22px; }}
  p {{ margin: 10px 0; }}
  a {{ color: var(--accent); }}
  code {{ background: #eef1ea; padding: 1px 5px; border-radius: 4px; font-size: 12px; }}
  pre:not(.mermaid) {{ background: #1e241c; color: #e8efe0; padding: 14px; border-radius: 10px; overflow: auto; font-size: 12px; }}
  table {{ width: 100%; border-collapse: collapse; margin: 14px 0; background: var(--card); }}
  th, td {{ border: 1px solid var(--line); padding: 8px 10px; text-align: left; vertical-align: top; }}
  th {{ background: #eef2e8; }}
  pre.mermaid {{
    background: var(--card); border: 1px solid var(--line); border-radius: 10px;
    padding: 16px; margin: 16px 0; overflow-x: auto;
    font-family: ui-monospace, Consolas, monospace; font-size: 12px;
    white-space: pre-wrap;
  }}
  pre.mermaid[data-processed="true"] {{
    font-family: inherit; font-size: inherit; white-space: normal;
  }}
  #diagram-status {{
    background: #e8efe0; border: 1px solid #c5d3b8; border-radius: 8px;
    padding: 10px 12px; margin-bottom: 18px; color: #2f3b28;
  }}
  ul, ol {{ padding-left: 22px; }}
  hr {{ border: 0; border-top: 1px solid var(--line); margin: 24px 0; }}
  .meta {{ color: var(--muted); margin-bottom: 24px; }}
  @media print {{
    .toolbar {{ display: none !important; }}
    #diagram-status {{ display: none !important; }}
    body {{ background: #fff; font-size: 11pt; }}
    .wrap {{ max-width: none; padding: 0; }}
    h2 {{ break-before: page; border-top: 0; margin-top: 0; }}
    h2:first-of-type {{ break-before: avoid; }}
    .mermaid, table {{ break-inside: avoid; }}
    a {{ color: inherit; text-decoration: none; }}
  }}
</style>
</head>
<body>
  <div class="toolbar">
    <div><strong>Mijn Levenspad</strong> · End-to-End Project Report</div>
    <button type="button" onclick="window.print()">Download / Print as PDF</button>
  </div>
  <div class="wrap">
    <p class="meta">Open this file in a browser. Click <strong>Download / Print as PDF</strong> (or Ctrl+P) and choose <em>Save as PDF</em>. Keep this file next to <code>docs/vendor/</code> so diagrams load offline.</p>
    <div id="diagram-status">Loading diagrams…</div>
    {body}
  </div>
</body>
</html>
"""
    HTML_PATH.write_text(html, encoding="utf-8")
    print(f"Wrote {HTML_PATH} ({HTML_PATH.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
