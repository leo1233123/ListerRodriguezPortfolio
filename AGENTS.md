# AGENTS.md - Portfolio Architecture & Design System Guidelines

This document outlines the architecture, data schemas, styling conventions, and integration standards for Lister Rodriguez's Professional Portfolio.

---

## 1. Project Overview & Tech Stack
- **Core Architecture:** Semantic HTML5, Vanilla JavaScript (ES6+), Vanilla CSS with custom properties.
- **Visual Aesthetic:** Obsidian-inspired Deep Space theme (`#0b0e14`, `rgba(15, 23, 42, 0.95)`), celestial neon accents (Indigo `#6366f1`, Violet `#8b5cf6`, Cyan `#00f0ff`, Emerald `#10b981`, Amber `#fbbf24`), glassmorphism, and responsive CSS grid/flexbox layouts.
- **Dual Visual Modes:**
  1. **Standard Portfolio:** Responsive multi-section web portfolio (Hero, About, Skills, Qualifications, Experience, Featured Projects, Automation Showcase, Contact).
  2. **Profile Constellation Graph:** Interactive 2D HTML5 canvas force-directed graph modeling Lister's skills, projects, automations, and work experience orbiting around Lister Rodriguez as the central Head Star.

---

## 2. Work Experience Data Schema

All work experiences conform to the following schema standard:

```typescript
export interface WorkExperience {
  id: string;
  role: string;
  company: string;
  location: string;
  period: string;
  startDate: string;
  endDate: string;
  featured: boolean;
  type: "Full-Time" | "Contract" | "Internship" | "Academic";
  icon: string;
  stats?: string[];
  bullets: string[];
  technologies: string[];
}
```

### Required Fields:
- `id`: Unique slug identifier (e.g. `casgains-operations-manager`).
- `role`: Official position title.
- `company`: Employing entity / organization.
- `location`: Location or Remote indicator (e.g. `Remote (Chicago / International)`).
- `period`: Formatted date range string (e.g. `February 2026 – Present`).
- `startDate` & `endDate`: ISO or Month Year timestamps.
- `featured`: Boolean indicating prominent display.
- `bullets`: Array of measurable responsibilities and achievements.
- `technologies`: Array of tech stack tags, tools, and methodologies.

---

## 3. UI Component Architecture (`#experience`)

The Experience timeline utilizes the following hierarchy:

```html
<div class="experience-card">
  <div class="experience-head">
    <div class="experience-title-group">
      <div class="experience-icon">...</div>
      <div>
        <h3>{role}</h3>
        <span class="experience-role-tag">{company} • {location}</span>
      </div>
    </div>
    <div class="experience-stats">
      <span class="experience-stat">{period}</span>
      <span class="experience-stat">{type}</span>
    </div>
  </div>
  <ul class="experience-list">
    <li>{bullet_1}</li>
    ...
  </ul>
  <div class="experience-tags">
    <span class="experience-tag">{tech}</span>
    ...
  </div>
</div>
```

### Styling Specifications:
- **Card Background:** Glassmorphic translucent panel (`rgba(255, 255, 255, 0.03)` with `backdrop-filter: blur(10px)`).
- **Accent Border:** Left gradient strip (`linear-gradient(180deg, #6366f1, #8b5cf6)`).
- **Tag Pills:** Capsule chips (`padding: 0.35rem 0.8rem; border-radius: 50px; background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.25)`).
- **Responsive Layout:** 2-column grid for bullet points on desktop screens (`> 768px`), automatically collapsing to 1 column on tablet and mobile viewports.

---

## 4. Integration Checklist for Agents
When modifying or adding portfolio sections:
1. Update `index.html` markup within the corresponding section container.
2. Synchronize interactive graph nodes in `constellation-graph-data.json`.
3. Synchronize fallback offline dataset in `constellation-graph.js`.
4. Ensure zero horizontal scrollbars or text wrapping anomalies across mobile viewports (min 360px).
