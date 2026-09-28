/**
 * Constellation Graph Extractor - Node.js Engine
 * Performs AST & Dependency scanning, generates typed graph JSON payload
 */

const fs = require('fs');
const path = require('path');

const WORKSPACE_ROOT = process.cwd();
const OUTPUT_FILE = path.join(WORKSPACE_ROOT, 'constellation-graph-data.json');

const EXCLUDE_DIRS = new Set(['.git', 'node_modules', '.venv', '__pycache__', 'dist', 'build', '.next', 'scripts']);

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!EXCLUDE_DIRS.has(file)) {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      if (file !== 'constellation-graph-data.json') {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

function getNodeMetadata(relPath) {
  const ext = path.extname(relPath).toLowerCase();
  const dir = path.dirname(relPath).replace(/\\/g, '/');
  const cluster = dir === '.' || dir === '' ? 'root' : dir.split('/')[0];

  let type = 'utility';
  if (['.html', '.htm'].includes(ext)) {
    type = 'component';
  } else if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
    type = 'style';
  } else if (['.py', '.ts', '.js'].includes(ext)) {
    if (relPath.includes('app.py') || relPath.includes('service') || relPath.includes('server')) {
      type = 'service';
    } else if (relPath.includes('hook')) {
      type = 'hook';
    } else {
      type = 'utility';
    }
  } else if (['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.ico', '.pdf'].includes(ext)) {
    type = 'asset';
  } else if (['.md', '.txt', '.rst'].includes(ext)) {
    type = 'doc';
  } else if (relPath.includes('Dockerfile')) {
    type = 'service';
  }

  return { cluster, type, ext };
}

function resolveTargetPath(sourceRel, targetRef, registeredNodes) {
  const cleanRef = targetRef.split(/[?#]/)[0].trim();
  if (/^(https?:\/\/|mailto:|#|data:)/.test(cleanRef)) return null;

  const sourceDir = path.dirname(sourceRel).replace(/\\/g, '/');
  const candidate1 = sourceDir === '.' ? cleanRef : path.join(sourceDir, cleanRef).replace(/\\/g, '/');
  if (registeredNodes.has(candidate1)) return candidate1;

  const cleanRoot = cleanRef.replace(/^[/\\]+/, '');
  if (registeredNodes.has(cleanRoot)) return cleanRoot;

  const fn = path.basename(cleanRef);
  for (const k of registeredNodes.keys()) {
    if (path.basename(k) === fn) return k;
  }
  return null;
}

function runScanner() {
  console.log(`[Constellation Scanner] Scanning root: ${WORKSPACE_ROOT}`);
  const allFilePaths = getAllFiles(WORKSPACE_ROOT);

  const nodes = new Map();
  const rawLinks = [];

  for (const absPath of allFilePaths) {
    const rel = path.relative(WORKSPACE_ROOT, absPath).replace(/\\/g, '/');
    const stat = fs.statSync(absPath);
    const meta = getNodeMetadata(rel);
    
    let lineCount = 0;
    try {
      const txt = fs.readFileSync(absPath, 'utf8');
      lineCount = txt.split('\n').length;
    } catch (e) {
      lineCount = 0;
    }

    nodes.set(rel, {
      id: rel,
      label: path.basename(rel),
      type: meta.type,
      cluster: meta.cluster,
      extension: meta.ext,
      metrics: {
        fileSize: stat.size,
        fileSizeFormatted: (stat.size / 1024).toFixed(2) + ' KB',
        lineCount,
        exportCount: 0,
        importCount: 0,
        inDegree: 0,
        outDegree: 0,
        degree: 0,
        circularRiskScore: 0.0
      },
      exports: [],
      imports: []
    });
  }

  for (const [nodeId, node] of nodes.entries()) {
    const absPath = path.join(WORKSPACE_ROOT, nodeId);
    let content = '';
    try {
      content = fs.readFileSync(absPath, 'utf8');
    } catch {
      continue;
    }

    const ext = node.extension.toLowerCase();

    // HTML Scanner
    if (['.html', '.htm'].includes(ext)) {
      const linkRegex = /<link[^>]+href=["']([^"']+)["'][^>]*>/g;
      let m;
      while ((m = linkRegex.exec(content)) !== null) {
        const target = resolveTargetPath(nodeId, m[1], nodes);
        if (target) {
          rawLinks.push({ source: nodeId, target, weight: 8, type: 'style-dep', description: 'Imports stylesheet' });
          node.imports.push(target);
        }
      }

      const scriptRegex = /<script[^>]+src=["']([^"']+)["'][^>]*>/g;
      while ((m = scriptRegex.exec(content)) !== null) {
        const target = resolveTargetPath(nodeId, m[1], nodes);
        if (target) {
          rawLinks.push({ source: nodeId, target, weight: 10, type: 'import', description: 'Loads JavaScript module' });
          node.imports.push(target);
        }
      }

      const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
      while ((m = imgRegex.exec(content)) !== null) {
        const target = resolveTargetPath(nodeId, m[1], nodes);
        if (target) {
          rawLinks.push({ source: nodeId, target, weight: 3, type: 'asset-ref', description: 'Renders image asset' });
          node.imports.push(target);
        }
      }

      const aRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/g;
      while ((m = aRegex.exec(content)) !== null) {
        const target = resolveTargetPath(nodeId, m[1], nodes);
        if (target) {
          rawLinks.push({ source: nodeId, target, weight: 4, type: 'link', description: 'Navigates to document' });
          node.imports.push(target);
        }
      }

      const lbRegex = /src:\s*["']([^"']+)["']/g;
      while ((m = lbRegex.exec(content)) !== null) {
        const target = resolveTargetPath(nodeId, m[1], nodes);
        if (target) {
          rawLinks.push({ source: nodeId, target, weight: 3, type: 'asset-ref', description: 'Lightbox asset reference' });
          node.imports.push(target);
        }
      }

      const idRegex = /id=["']([a-zA-Z0-9_-]+)["']/g;
      while ((m = idRegex.exec(content)) !== null) {
        node.exports.push('#' + m[1]);
      }
      const fnRegex = /function\s+([a-zA-Z0-9_]+)\s*\(/g;
      while ((m = fnRegex.exec(content)) !== null) {
        node.exports.push('fn:' + m[1]);
      }
    }

    // CSS Scanner
    if (['.css', '.scss'].includes(ext)) {
      const varRegex = /(--[a-zA-Z0-9_-]+)\s*:/g;
      let m;
      while ((m = varRegex.exec(content)) !== null) {
        node.exports.push(m[1]);
      }
    }

    // Python Scanner
    if (ext === '.py') {
      const pyImportRegex = /(?:from\s+([a-zA-Z0-9_.]+)\s+import|import\s+([a-zA-Z0-9_.]+))/g;
      let m;
      while ((m = pyImportRegex.exec(content)) !== null) {
        node.imports.push(m[1] || m[2]);
      }
      const reqTarget = resolveTargetPath(nodeId, 'requirements.txt', nodes);
      if (reqTarget) {
        rawLinks.push({ source: nodeId, target: reqTarget, weight: 5, type: 'runtime-bind', description: 'Runtime dependency manifest' });
      }
      const routeRegex = /@app\.(?:get|post|put|delete)\(["']([^"']+)["']/g;
      while ((m = routeRegex.exec(content)) !== null) {
        node.exports.push('route:' + m[1]);
      }
      const defRegex = /def\s+([a-zA-Z0-9_]+)\s*\(/g;
      while ((m = defRegex.exec(content)) !== null) {
        node.exports.push('def:' + m[1]);
      }
    }

    // Dockerfile Scanner
    if (nodeId.includes('Dockerfile')) {
      const copyRegex = /COPY\s+([^\s]+)\s+/g;
      let m;
      while ((m = copyRegex.exec(content)) !== null) {
        const target = resolveTargetPath(nodeId, m[1], nodes);
        if (target) {
          rawLinks.push({ source: nodeId, target, weight: 7, type: 'runtime-bind', description: 'Container layer injection' });
          node.imports.push(target);
        }
      }
    }

    // Markdown Scanner
    if (['.md', '.markdown'].includes(ext)) {
      const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      let m;
      while ((m = mdLinkRegex.exec(content)) !== null) {
        const target = resolveTargetPath(nodeId, m[2], nodes);
        if (target) {
          rawLinks.push({ source: nodeId, target, weight: 3, type: 'doc-ref', description: 'Documentation cross-reference' });
          node.imports.push(target);
        }
      }
    }
  }

  // Cross-module architecture links
  if (nodes.has('index.html') && nodes.has('yolov8_demo/app.py')) {
    rawLinks.push({
      source: 'index.html',
      target: 'yolov8_demo/app.py',
      weight: 5,
      type: 'runtime-bind',
      description: 'Portfolio AI system architecture binding to YOLOv8 inference service'
    });
  }
  if (nodes.has('README.md') && nodes.has('index.html')) {
    rawLinks.push({
      source: 'README.md',
      target: 'index.html',
      weight: 3,
      type: 'doc-ref',
      description: 'Server target entrypoint documented in README'
    });
  }
  if (nodes.has('index.html') && nodes.has('next.html')) {
    rawLinks.push({
      source: 'index.html',
      target: 'next.html',
      weight: 4,
      type: 'link',
      description: 'Detailed biography route pairing'
    });
  }

  // Deduplicate and consolidate links
  const consolidated = new Map();
  for (const link of rawLinks) {
    if (!nodes.has(link.source) || !nodes.has(link.target)) continue;
    if (link.source === link.target) continue;

    const key = `${link.source}-->${link.target}`;
    if (consolidated.has(key)) {
      const item = consolidated.get(key);
      item.weight += Math.min(link.weight, 5);
    } else {
      consolidated.set(key, { ...link });
    }
  }

  const links = Array.from(consolidated.values());

  // Metrics computation
  for (const l of links) {
    nodes.get(l.source).metrics.outDegree++;
    nodes.get(l.target).metrics.inDegree++;
  }

  for (const n of nodes.values()) {
    n.metrics.degree = n.metrics.inDegree + n.metrics.outDegree;
    n.metrics.exportCount = n.exports.length;
    n.metrics.importCount = n.imports.length;
  }

  // Tarjan's Strongly Connected Components
  const adj = new Map();
  for (const id of nodes.keys()) adj.set(id, []);
  for (const l of links) adj.get(l.source).push(l.target);

  let index = 0;
  const indices = new Map();
  const lowlinks = new Map();
  const onStack = new Map();
  const stack = [];
  const sccs = [];

  function strongConnect(v) {
    indices.set(v, index);
    lowlinks.set(v, index);
    index++;
    stack.push(v);
    onStack.set(v, true);

    const neighbors = adj.get(v) || [];
    for (const w of neighbors) {
      if (!indices.has(w)) {
        strongConnect(w);
        lowlinks.set(v, Math.min(lowlinks.get(v), lowlinks.get(w)));
      } else if (onStack.get(w)) {
        lowlinks.set(v, Math.min(lowlinks.get(v), indices.get(w)));
      }
    }

    if (lowlinks.get(v) === indices.get(v)) {
      const scc = [];
      let item;
      do {
        item = stack.pop();
        onStack.set(item, false);
        scc.push(item);
      } while (item !== v);
      sccs.push(scc);
    }
  }

  for (const id of nodes.keys()) {
    if (!indices.has(id)) {
      strongConnect(id);
    }
  }

  for (const scc of sccs) {
    if (scc.length > 1) {
      const score = Math.round(Math.min(1.0, 0.35 + scc.length * 0.15) * 100) / 100;
      for (const id of scc) {
        nodes.get(id).metrics.circularRiskScore = score;
      }
    }
  }

  const nodeList = Array.from(nodes.values());

  const clusterCounts = {};
  const typeCounts = {};
  for (const n of nodeList) {
    clusterCounts[n.cluster] = (clusterCounts[n.cluster] || 0) + 1;
    typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
  }

  const payload = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    summary: {
      totalNodes: nodeList.length,
      totalLinks: links.length,
      clusters: Object.entries(clusterCounts).map(([name, count]) => ({ name, count })),
      types: Object.entries(typeCounts).map(([name, count]) => ({ name, count }))
    },
    nodes: nodeList,
    links
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Scan complete! ${nodeList.length} nodes, ${links.length} links saved to ${OUTPUT_FILE}`);
}

runScanner();
