#!/usr/bin/env python3
"""
Constellation Graph Extractor - Python Engine
Performs AST & Dependency scanning, generates typed graph JSON payload.
"""

import os
import re
import json
from pathlib import Path
from datetime import datetime, timezone

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_FILE = WORKSPACE_ROOT / "constellation-graph-data.json"

EXCLUDE_DIRS = {'.git', 'node_modules', '.venv', '__pycache__', 'dist', 'build', '.next', 'scripts'}

def get_node_metadata(rel_path: str):
    p = Path(rel_path)
    ext = p.suffix.lower()
    parts = p.parts
    cluster = "root" if len(parts) <= 1 else parts[0]
    
    node_type = "utility"
    if ext in ('.html', '.htm'):
        node_type = "component"
    elif ext in ('.css', '.scss', '.sass', '.less'):
        node_type = "style"
    elif ext in ('.py', '.ts', '.js'):
        if 'app.py' in rel_path or 'service' in rel_path or 'server' in rel_path:
            node_type = "service"
        elif 'hook' in rel_path:
            node_type = "hook"
        else:
            node_type = "utility"
    elif ext in ('.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.ico', '.pdf'):
        node_type = "asset"
    elif ext in ('.md', '.txt', '.rst'):
        node_type = "doc"
    elif 'Dockerfile' in rel_path:
        node_type = "service"
        
    return cluster, node_type, ext

def resolve_target_path(source_rel: str, target_ref: str, registered_nodes: dict):
    clean_ref = re.split(r'[?#]', target_ref)[0].strip()
    if re.match(r'^(https?://|mailto:|#|data:)', clean_ref):
        return None
    
    source_dir = Path(source_rel).parent
    cand1 = (source_dir / clean_ref).as_posix()
    if cand1 in registered_nodes:
        return cand1
    
    clean_root = clean_ref.lstrip('/\\')
    if clean_root in registered_nodes:
        return clean_root
    
    fn = Path(clean_ref).name
    for k in registered_nodes:
        if Path(k).name == fn:
            return k
    return None

def main():
    print(f"[Constellation Scanner] Scanning root: {WORKSPACE_ROOT}")
    nodes = {}
    raw_links = []

    for root, dirs, files in os.walk(WORKSPACE_ROOT):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for f in files:
            if f == "constellation-graph-data.json":
                continue
            abs_p = Path(root) / f
            rel_p = abs_p.relative_to(WORKSPACE_ROOT).as_posix()
            cluster, ntype, ext = get_node_metadata(rel_p)
            
            line_count = 0
            try:
                with open(abs_p, 'r', encoding='utf-8', errors='ignore') as fp:
                    line_count = sum(1 for _ in fp)
            except Exception:
                pass
            
            size = abs_p.stat().st_size
            nodes[rel_p] = {
                "id": rel_p,
                "label": f,
                "type": ntype,
                "cluster": cluster,
                "extension": ext,
                "metrics": {
                    "fileSize": size,
                    "fileSizeFormatted": f"{size / 1024:.2f} KB",
                    "lineCount": line_count,
                    "exportCount": 0,
                    "importCount": 0,
                    "inDegree": 0,
                    "outDegree": 0,
                    "degree": 0,
                    "circularRiskScore": 0.0
                },
                "exports": [],
                "imports": []
            }

    # AST scanning
    for node_id, node in nodes.items():
        abs_p = WORKSPACE_ROOT / node_id
        try:
            content = abs_p.read_text(encoding='utf-8', errors='ignore')
        except Exception:
            continue
        
        ext = node["extension"]
        if ext in ('.html', '.htm'):
            for m in re.finditer(r'<link[^>]+href=["\']([^"\']+)["\'][^>]*>', content):
                t = resolve_target_path(node_id, m.group(1), nodes)
                if t:
                    raw_links.append({"source": node_id, "target": t, "weight": 8, "type": "style-dep", "description": "Imports stylesheet"})
                    node["imports"].append(t)
            for m in re.finditer(r'<script[^>]+src=["\']([^"\']+)["\'][^>]*>', content):
                t = resolve_target_path(node_id, m.group(1), nodes)
                if t:
                    raw_links.append({"source": node_id, "target": t, "weight": 10, "type": "import", "description": "Loads JavaScript module"})
                    node["imports"].append(t)
            for m in re.finditer(r'<img[^>]+src=["\']([^"\']+)["\'][^>]*>', content):
                t = resolve_target_path(node_id, m.group(1), nodes)
                if t:
                    raw_links.append({"source": node_id, "target": t, "weight": 3, "type": "asset-ref", "description": "Renders image asset"})
                    node["imports"].append(t)
            for m in re.finditer(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>', content):
                t = resolve_target_path(node_id, m.group(1), nodes)
                if t:
                    raw_links.append({"source": node_id, "target": t, "weight": 4, "type": "link", "description": "Navigates to document"})
                    node["imports"].append(t)
            for m in re.finditer(r'src:\s*["\']([^"\']+)["\']', content):
                t = resolve_target_path(node_id, m.group(1), nodes)
                if t:
                    raw_links.append({"source": node_id, "target": t, "weight": 3, "type": "asset-ref", "description": "Lightbox asset reference"})
                    node["imports"].append(t)
            for m in re.finditer(r'id=["\']([a-zA-Z0-9_-]+)["\']', content):
                node["exports"].append(f"#{m.group(1)}")
            for m in re.finditer(r'function\s+([a-zA-Z0-9_]+)\s*\(', content):
                node["exports"].append(f"fn:{m.group(1)}")

        elif ext in ('.css', '.scss'):
            for m in re.finditer(r'(--[a-zA-Z0-9_-]+)\s*:', content):
                node["exports"].append(m.group(1))

        elif ext == '.py':
            for m in re.finditer(r'(?:from\s+([a-zA-Z0-9_.]+)\s+import|import\s+([a-zA-Z0-9_.]+))', content):
                node["imports"].append(m.group(1) or m.group(2))
            req_t = resolve_target_path(node_id, 'requirements.txt', nodes)
            if req_t:
                raw_links.append({"source": node_id, "target": req_t, "weight": 5, "type": "runtime-bind", "description": "Runtime dependency manifest"})
            for m in re.finditer(r'@app\.(?:get|post|put|delete)\(["\']([^"\']+)["\']', content):
                node["exports"].append(f"route:{m.group(1)}")
            for m in re.finditer(r'def\s+([a-zA-Z0-9_]+)\s*\(', content):
                node["exports"].append(f"def:{m.group(1)}")

        elif 'Dockerfile' in node_id:
            for m in re.finditer(r'COPY\s+([^\s]+)\s+', content):
                t = resolve_target_path(node_id, m.group(1), nodes)
                if t:
                    raw_links.append({"source": node_id, "target": t, "weight": 7, "type": "runtime-bind", "description": "Container layer injection"})
                    node["imports"].append(t)

        elif ext in ('.md', '.markdown'):
            for m in re.finditer(r'\[([^\]]+)\]\(([^)]+)\)', content):
                t = resolve_target_path(node_id, m.group(2), nodes)
                if t:
                    raw_links.append({"source": node_id, "target": t, "weight": 3, "type": "doc-ref", "description": "Documentation cross-reference"})
                    node["imports"].append(t)

    # Architectural cross-bindings
    if "index.html" in nodes and "yolov8_demo/app.py" in nodes:
        raw_links.append({
            "source": "index.html",
            "target": "yolov8_demo/app.py",
            "weight": 5,
            "type": "runtime-bind",
            "description": "Portfolio AI system architecture binding to YOLOv8 inference service"
        })
    if "README.md" in nodes and "index.html" in nodes:
        raw_links.append({
            "source": "README.md",
            "target": "index.html",
            "weight": 3,
            "type": "doc-ref",
            "description": "Server target entrypoint documented in README"
        })
    if "index.html" in nodes and "next.html" in nodes:
        raw_links.append({
            "source": "index.html",
            "target": "next.html",
            "weight": 4,
            "type": "link",
            "description": "Detailed biography route pairing"
        })

    # Deduplicate links
    consolidated = {}
    for link in raw_links:
        s, t = link["source"], link["target"]
        if s not in nodes or t not in nodes or s == t:
            continue
        key = f"{s}-->{t}"
        if key in consolidated:
            consolidated[key]["weight"] += min(link["weight"], 5)
        else:
            consolidated[key] = dict(link)

    link_list = list(consolidated.values())

    # Degrees and counts
    for l in link_list:
        nodes[l["source"]]["metrics"]["outDegree"] += 1
        nodes[l["target"]]["metrics"]["inDegree"] += 1

    for n in nodes.values():
        n["metrics"]["degree"] = n["metrics"]["inDegree"] + n["metrics"]["outDegree"]
        n["metrics"]["exportCount"] = len(n["exports"])
        n["metrics"]["importCount"] = len(n["imports"])

    # Tarjan's Strongly Connected Components
    adj = {k: [] for k in nodes}
    for l in link_list:
        adj[l["source"]].append(l["target"])

    index = 0
    indices = {}
    lowlinks = {}
    on_stack = {}
    stack = []
    sccs = []

    def strong_connect(v):
        nonlocal index
        indices[v] = index
        lowlinks[v] = index
        index += 1
        stack.append(v)
        on_stack[v] = True

        for w in adj.get(v, []):
            if w not in indices:
                strong_connect(w)
                lowlinks[v] = min(lowlinks[v], lowlinks[w])
            elif on_stack.get(w, False):
                lowlinks[v] = min(lowlinks[v], indices[w])

        if lowlinks[v] == indices[v]:
            scc = []
            while True:
                item = stack.pop()
                on_stack[item] = False
                scc.append(item)
                if item == v:
                    break
            sccs.append(scc)

    for k in nodes:
        if k not in indices:
            strong_connect(k)

    for scc in sccs:
        if len(scc) > 1:
            score = round(min(1.0, 0.35 + len(scc) * 0.15), 2)
            for m in scc:
                nodes[m]["metrics"]["circularRiskScore"] = score

    node_list = list(nodes.values())
    cluster_counts = {}
    type_counts = {}
    for n in node_list:
        cluster_counts[n["cluster"]] = cluster_counts.get(n["cluster"], 0) + 1
        type_counts[n["type"]] = type_counts.get(n["type"], 0) + 1

    payload = {
        "version": "1.0.0",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "totalNodes": len(node_list),
            "totalLinks": len(link_list),
            "clusters": [{"name": k, "count": v} for k, v in cluster_counts.items()],
            "types": [{"name": k, "count": v} for k, v in type_counts.items()]
        },
        "nodes": node_list,
        "links": link_list
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, indent=2)

    print(f"Extraction complete! {len(node_list)} nodes, {len(link_list)} links written to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
