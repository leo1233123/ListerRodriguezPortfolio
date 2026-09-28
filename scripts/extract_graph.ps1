# ==============================================================================
# Constellation Graph Extractor - PowerShell Engine
# Exhaustive AST, Regex, and Static Dependency Scanner
# ==============================================================================

param(
    [string]$WorkspaceRoot = (Get-Location).Path,
    [string]$OutputFile = "constellation-graph-data.json"
)

Write-Host "Initiating Exhaustive AST & Dependency Scan on: $WorkspaceRoot" -ForegroundColor Cyan

# Ignored directory patterns
$excludePatterns = @('\\\.git\\', 'node_modules', '\\\.venv\\', '__pycache__', 'dist\\', 'build\\', '\\\.next\\')

# Collect all files
$files = Get-ChildItem -Path $WorkspaceRoot -Recurse -File | Where-Object {
    $fullName = $_.FullName
    $match = $false
    foreach ($pattern in $excludePatterns) {
        if ($fullName -match $pattern) {
            $match = $true
            break
        }
    }
    return -not $match
}

# Node dictionary
$nodes = @{}
$rawLinks = [System.Collections.Generic.List[PSCustomObject]]::new()

# Helper: determine type and cluster
function Get-NodeMetadata($relPath, $fileInfo) {
    $ext = [System.IO.Path]::GetExtension($relPath).ToLower()
    $dir = [System.IO.Path]::GetDirectoryName($relPath).Replace('\', '/')
    $cluster = if ($dir -eq "") { "root" } else { $dir.Split('/')[0] }
    
    $type = "utility"
    if ($ext -in @('.html', '.htm')) {
        $type = "component"
    } elseif ($ext -in @('.css', '.scss', '.sass', '.less')) {
        $type = "style"
    } elseif ($ext -in @('.py', '.ts', '.js')) {
        if ($relPath -match 'app\.py' -or $relPath -match 'service' -or $relPath -match 'server') {
            $type = "service"
        } elseif ($relPath -match 'hook') {
            $type = "hook"
        } else {
            $type = "utility"
        }
    } elseif ($ext -in @('.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.ico', '.pdf')) {
        $type = "asset"
    } elseif ($ext -in @('.md', '.txt', '.rst')) {
        $type = "doc"
    } elseif ($relPath -match 'Dockerfile') {
        $type = "service"
    }

    return @{
        Cluster = $cluster
        Type = $type
    }
}

# Step 1: Register all nodes
foreach ($f in $files) {
    $relPath = $f.FullName.Substring($WorkspaceRoot.Length).TrimStart('\', '/').Replace('\', '/')
    if ($relPath -eq $OutputFile -or $relPath -match '^scripts/') { continue }

    $meta = Get-NodeMetadata $relPath $f
    $lines = 0
    try {
        $lines = (Get-Content $f.FullName -ErrorAction SilentlyContinue | Measure-Object -Line).Lines
    } catch {
        $lines = 0
    }
    if ($null -eq $lines) { $lines = 0 }

    $label = [System.IO.Path]::GetFileName($relPath)

    $nodes[$relPath] = [PSCustomObject]@{
        id = $relPath
        label = $label
        type = $meta.Type
        cluster = $meta.Cluster
        extension = [System.IO.Path]::GetExtension($relPath)
        metrics = [PSCustomObject]@{
            fileSize = $f.Length
            fileSizeFormatted = ("{0:N2} KB" -f ($f.Length / 1KB))
            lineCount = $lines
            exportCount = 0
            importCount = 0
            inDegree = 0
            outDegree = 0
            degree = 0
            circularRiskScore = 0.0
        }
        exports = [System.Collections.Generic.List[string]]::new()
        imports = [System.Collections.Generic.List[string]]::new()
    }
}

# Step 2: Parse dependencies & AST patterns
function Resolve-TargetPath($sourcePath, $targetRef) {
    # Strip query parameters or hashes
    $cleanRef = ($targetRef -split '[?#]')[0].Trim()
    if ($cleanRef -match '^(https?://|mailto:|#|data:)') { return $null }

    $sourceDir = [System.IO.Path]::GetDirectoryName($sourcePath).Replace('\', '/')
    
    # Check direct relative path
    $candidate1 = if ($sourceDir -eq "") { $cleanRef } else { "$sourceDir/$cleanRef" }
    try {
        $fullCand1 = Join-Path $WorkspaceRoot $candidate1
        if (Test-Path $fullCand1) {
            $norm1 = [System.IO.Path]::GetFullPath($fullCand1).Substring($WorkspaceRoot.Length).TrimStart('\', '/').Replace('\', '/')
            if ($nodes.ContainsKey($norm1)) { return $norm1 }
        }
    } catch {}

    # Check root-relative path
    $cleanRoot = $cleanRef.TrimStart('/', '\')
    if ($nodes.ContainsKey($cleanRoot)) { return $cleanRoot }

    # Check fuzzy match by filename
    $fn = [System.IO.Path]::GetFileName($cleanRef)
    foreach ($k in $nodes.Keys) {
        if ([System.IO.Path]::GetFileName($k) -eq $fn) {
            return $k
        }
    }

    return $null
}

# Regex patterns
$reCssLink = [regex]'<link[^>]+href=["'']([^"'']+)["''][^>]*>'
$reScript = [regex]'<script[^>]+src=["'']([^"'']+)["''][^>]*>'
$reImg = [regex]'<img[^>]+src=["'']([^"'']+)["''][^>]*>'
$reA = [regex]'<a[^>]+href=["'']([^"'']+)["''][^>]*>'
$reLbSrc = [regex]'src:\s*["'']([^"'']+)["'']'
$reHtmlId = [regex]'id=["'']([a-zA-Z0-9_-]+)["'']'
$reJsFunc = [regex]'function\s+([a-zA-Z0-9_]+)\s*\('
$reCssImport = [regex]'@import\s+["'']([^"'']+)["'']'
$reCssUrl = [regex]'url\((?:["'']?)([^"'')]+)(?:["'']?)\)'
$reCssVar = [regex]'(--[a-zA-Z0-9_-]+)\s*:'
$rePyImport = [regex]'(?:from\s+([a-zA-Z0-9_.]+)\s+import|import\s+([a-zA-Z0-9_.]+))'
$rePyRoute = [regex]'@app\.(?:get|post|put|delete)\(["'']([^"'']+)["'']'
$rePyDef = [regex]'def\s+([a-zA-Z0-9_]+)\s*\('
$reDockerCopy = [regex]'COPY\s+([^\s]+)\s+'
$reMdLink = [regex]'\[([^\]]+)\]\(([^)]+)\)'

foreach ($nodeId in $nodes.Keys) {
    $node = $nodes[$nodeId]
    $fullPath = Join-Path $WorkspaceRoot ($nodeId.Replace('/', '\'))
    if (-not (Test-Path $fullPath)) { continue }

    $content = ""
    try {
        $content = [System.IO.File]::ReadAllText($fullPath)
    } catch {
        continue
    }

    $ext = $node.extension.ToLower()

    # --- HTML Scanner ---
    if ($ext -in @('.html', '.htm')) {
        foreach ($m in $reCssLink.Matches($content)) {
            $target = Resolve-TargetPath $nodeId $m.Groups[1].Value
            if ($target) {
                $rawLinks.Add([PSCustomObject]@{ source = $nodeId; target = $target; weight = 8; type = "style-dep"; desc = "Imports stylesheet" })
                $node.imports.Add($target)
            }
        }

        foreach ($m in $reScript.Matches($content)) {
            $target = Resolve-TargetPath $nodeId $m.Groups[1].Value
            if ($target) {
                $rawLinks.Add([PSCustomObject]@{ source = $nodeId; target = $target; weight = 10; type = "import"; desc = "Loads JavaScript module" })
                $node.imports.Add($target)
            }
        }

        foreach ($m in $reImg.Matches($content)) {
            $target = Resolve-TargetPath $nodeId $m.Groups[1].Value
            if ($target) {
                $rawLinks.Add([PSCustomObject]@{ source = $nodeId; target = $target; weight = 3; type = "asset-ref"; desc = "Renders image asset" })
                $node.imports.Add($target)
            }
        }

        foreach ($m in $reA.Matches($content)) {
            $target = Resolve-TargetPath $nodeId $m.Groups[1].Value
            if ($target) {
                $rawLinks.Add([PSCustomObject]@{ source = $nodeId; target = $target; weight = 4; type = "link"; desc = "Navigates to document" })
                $node.imports.Add($target)
            }
        }

        foreach ($m in $reLbSrc.Matches($content)) {
            $target = Resolve-TargetPath $nodeId $m.Groups[1].Value
            if ($target) {
                $rawLinks.Add([PSCustomObject]@{ source = $nodeId; target = $target; weight = 3; type = "asset-ref"; desc = "References asset in lightbox data" })
                $node.imports.Add($target)
            }
        }

        foreach ($idM in $reHtmlId.Matches($content)) {
            $node.exports.Add("#" + $idM.Groups[1].Value)
        }
        foreach ($fM in $reJsFunc.Matches($content)) {
            $node.exports.Add("fn:" + $fM.Groups[1].Value)
        }
    }

    # --- CSS Scanner ---
    if ($ext -in @('.css', '.scss')) {
        foreach ($m in $reCssImport.Matches($content)) {
            $target = Resolve-TargetPath $nodeId $m.Groups[1].Value
            if ($target) {
                $rawLinks.Add([PSCustomObject]@{ source = $nodeId; target = $target; weight = 6; type = "style-dep"; desc = "CSS @import cascade" })
                $node.imports.Add($target)
            }
        }
        foreach ($m in $reCssUrl.Matches($content)) {
            $target = Resolve-TargetPath $nodeId $m.Groups[1].Value
            if ($target) {
                $rawLinks.Add([PSCustomObject]@{ source = $nodeId; target = $target; weight = 2; type = "asset-ref"; desc = "CSS asset reference" })
                $node.imports.Add($target)
            }
        }
        foreach ($vM in $reCssVar.Matches($content)) {
            $node.exports.Add($vM.Groups[1].Value)
        }
    }

    # --- Python Scanner ---
    if ($ext -eq '.py') {
        foreach ($m in $rePyImport.Matches($content)) {
            $pkg = if ($m.Groups[1].Value) { $m.Groups[1].Value } else { $m.Groups[2].Value }
            $node.imports.Add($pkg)
        }
        $reqPath = Resolve-TargetPath $nodeId "requirements.txt"
        if ($reqPath) {
            $rawLinks.Add([PSCustomObject]@{ source = $nodeId; target = $reqPath; weight = 5; type = "runtime-bind"; desc = "Runtime dependency manifest" })
        }
        foreach ($r in $rePyRoute.Matches($content)) {
            $node.exports.Add("route:" + $r.Groups[1].Value)
        }
        foreach ($f in $rePyDef.Matches($content)) {
            $node.exports.Add("def:" + $f.Groups[1].Value)
        }
    }

    # --- Dockerfile Scanner ---
    if ($nodeId -match 'Dockerfile') {
        foreach ($m in $reDockerCopy.Matches($content)) {
            $target = Resolve-TargetPath $nodeId $m.Groups[1].Value
            if ($target) {
                $rawLinks.Add([PSCustomObject]@{ source = $nodeId; target = $target; weight = 7; type = "runtime-bind"; desc = "Container layer injection" })
                $node.imports.Add($target)
            }
        }
    }

    # --- Markdown Scanner ---
    if ($ext -in @('.md', '.markdown')) {
        foreach ($m in $reMdLink.Matches($content)) {
            $target = Resolve-TargetPath $nodeId $m.Groups[2].Value
            if ($target) {
                $rawLinks.Add([PSCustomObject]@{ source = $nodeId; target = $target; weight = 3; type = "doc-ref"; desc = "Documentation cross-reference" })
                $node.imports.Add($target)
            }
        }
    }
}

# Cross-module functional bindings (portfolio project architecture)
if ($nodes.ContainsKey("index.html") -and $nodes.ContainsKey("yolov8_demo/app.py")) {
    $rawLinks.Add([PSCustomObject]@{
        source = "index.html"
        target = "yolov8_demo/app.py"
        weight = 5
        type = "runtime-bind"
        desc = "Portfolio AI system architecture binding to YOLOv8 inference service"
    })
}
if ($nodes.ContainsKey("README.md") -and $nodes.ContainsKey("index.html")) {
    $rawLinks.Add([PSCustomObject]@{
        source = "README.md"
        target = "index.html"
        weight = 3
        type = "doc-ref"
        desc = "Server target entrypoint documented in README"
    })
}
if ($nodes.ContainsKey("index.html") -and $nodes.ContainsKey("next.html")) {
    $rawLinks.Add([PSCustomObject]@{
        source = "index.html"
        target = "next.html"
        weight = 4
        type = "link"
        desc = "Detailed biography route pairing"
    })
}

# Aggregate and deduplicate links
$consolidatedLinks = @{}
foreach ($link in $rawLinks) {
    if (-not $nodes.ContainsKey($link.source) -or -not $nodes.ContainsKey($link.target)) { continue }
    if ($link.source -eq $link.target) { continue }

    $key = "$($link.source)-->$($link.target)"
    if ($consolidatedLinks.ContainsKey($key)) {
        $existing = $consolidatedLinks[$key]
        $existing.weight += [Math]::Min($link.weight, 5)
    } else {
        $consolidatedLinks[$key] = [PSCustomObject]@{
            source = $link.source
            target = $link.target
            weight = $link.weight
            type = $link.type
            description = $link.desc
        }
    }
}

$linkList = [System.Collections.Generic.List[PSCustomObject]]::new()
foreach ($l in $consolidatedLinks.Values) {
    $linkList.Add($l)
}

# Step 3: Compute degree and metrics
foreach ($l in $linkList) {
    $nodes[$l.source].metrics.outDegree++
    $nodes[$l.target].metrics.inDegree++
}

foreach ($node in $nodes.Values) {
    $node.metrics.degree = $node.metrics.inDegree + $node.metrics.outDegree
    $node.metrics.exportCount = $node.exports.Count
    $node.metrics.importCount = $node.imports.Count
}

# Step 4: Tarjan's Strongly Connected Components for Circular Dependency Detection
$adj = @{}
foreach ($k in $nodes.Keys) { $adj[$k] = [System.Collections.Generic.List[string]]::new() }
foreach ($l in $linkList) {
    $adj[$l.source].Add($l.target)
}

$script:tarjanIndex = 0
$script:tarjanIndices = @{}
$script:tarjanLowlink = @{}
$script:onStack = @{}
$script:tarjanStack = [System.Collections.Generic.Stack[string]]::new()
$script:sccs = [System.Collections.Generic.List[System.Collections.Generic.List[string]]]::new()

function StrongConnect($v) {
    $script:tarjanIndices[$v] = $script:tarjanIndex
    $script:tarjanLowlink[$v] = $script:tarjanIndex
    $script:tarjanIndex++
    $script:tarjanStack.Push($v)
    $script:onStack[$v] = $true

    foreach ($w in $adj[$v]) {
        if (-not $script:tarjanIndices.ContainsKey($w)) {
            StrongConnect $w
            $script:tarjanLowlink[$v] = [Math]::Min($script:tarjanLowlink[$v], $script:tarjanLowlink[$w])
        } elseif ($script:onStack[$w]) {
            $script:tarjanLowlink[$v] = [Math]::Min($script:tarjanLowlink[$v], $script:tarjanIndices[$w])
        }
    }

    if ($script:tarjanLowlink[$v] -eq $script:tarjanIndices[$v]) {
        $scc = [System.Collections.Generic.List[string]]::new()
        do {
            $item = $script:tarjanStack.Pop()
            $script:onStack[$item] = $false
            $scc.Add($item)
        } while ($item -ne $v)
        $script:sccs.Add($scc)
    }
}

foreach ($nodeId in $nodes.Keys) {
    if (-not $script:tarjanIndices.ContainsKey($nodeId)) {
        StrongConnect $nodeId
    }
}

# Assign circular risk scores based on SCC participation
foreach ($scc in $script:sccs) {
    if ($scc.Count -gt 1) {
        $score = [Math]::Round(([Math]::Min(1.0, 0.35 + ($scc.Count * 0.15))), 2)
        foreach ($member in $scc) {
            $nodes[$member].metrics.circularRiskScore = $score
        }
    } else {
        $single = $scc[0]
        if ($adj[$single].Contains($single)) {
            $nodes[$single].metrics.circularRiskScore = 0.50
        }
    }
}

# Final node array
$nodeList = [System.Collections.Generic.List[PSCustomObject]]::new()
foreach ($n in $nodes.Values) {
    $nodeList.Add([PSCustomObject]@{
        id = $n.id
        label = $n.label
        type = $n.type
        cluster = $n.cluster
        extension = $n.extension
        metrics = $n.metrics
        exports = $n.exports
        imports = $n.imports
    })
}

# Construct Final strictly typed payload
$graphPayload = [PSCustomObject]@{
    version = "1.0.0"
    generatedAt = (Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz")
    summary = [PSCustomObject]@{
        totalNodes = $nodeList.Count
        totalLinks = $linkList.Count
        clusters = ($nodeList | Group-Object cluster | ForEach-Object { [PSCustomObject]@{ name = $_.Name; count = $_.Count } })
        types = ($nodeList | Group-Object type | ForEach-Object { [PSCustomObject]@{ name = $_.Name; count = $_.Count } })
    }
    nodes = $nodeList
    links = $linkList
}

# Export JSON
$jsonOut = $graphPayload | ConvertTo-Json -Depth 6
$outputPath = Join-Path $WorkspaceRoot $OutputFile
[System.IO.File]::WriteAllText($outputPath, $jsonOut, [System.Text.Encoding]::UTF8)

Write-Host "Constellation Graph extraction complete!" -ForegroundColor Green
Write-Host "Total Nodes: $($nodeList.Count) | Total Edges: $($linkList.Count)" -ForegroundColor Green
Write-Host "Output written to: $outputPath" -ForegroundColor Yellow
