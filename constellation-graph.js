/**
 * ==============================================================================
 * LISTER RODRIGUEZ - INTERACTIVE PROFILE CONSTELLATION GRAPH
 * Centerpiece Galaxy Visualization of Skills, Experience, Projects & Automation
 * ==============================================================================
 */

(function (global) {
  'use strict';

  // Domain Cluster Celestial Palette
  const DOMAIN_PALETTES = {
    profile: {
      primary: '#00f0ff',
      glow: 'rgba(0, 240, 255, 0.65)',
      dark: '#0284c7',
      label: 'Profile Core'
    },
    experience: {
      primary: '#c084fc',
      glow: 'rgba(192, 132, 252, 0.55)',
      dark: '#7e22ce',
      label: 'Experience'
    },
    skills: {
      primary: '#38bdf8',
      glow: 'rgba(56, 189, 248, 0.55)',
      dark: '#0369a1',
      label: 'Skills & Tech'
    },
    projects: {
      primary: '#34d399',
      glow: 'rgba(52, 211, 153, 0.55)',
      dark: '#059669',
      label: 'Featured Projects'
    },
    automation: {
      primary: '#fbbf24',
      glow: 'rgba(251, 191, 36, 0.55)',
      dark: '#d97706',
      label: 'n8n Automations'
    },
    about: {
      primary: '#fb7185',
      glow: 'rgba(251, 113, 133, 0.55)',
      dark: '#e11d48',
      label: 'About Lister'
    },
    qualifications: {
      primary: '#818cf8',
      glow: 'rgba(129, 140, 248, 0.55)',
      dark: '#4f46e5',
      label: 'Qualifications'
    },
    contact: {
      primary: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.55)',
      dark: '#b45309',
      label: 'Contact & Connect'
    },
    default: {
      primary: '#94a3b8',
      glow: 'rgba(148, 163, 184, 0.35)',
      dark: '#475569',
      label: 'Module'
    }
  };

  class ProfileConstellation {
    constructor(options = {}) {
      this.container = options.container || document.getElementById('constellationCanvasContainer');
      this.canvas = options.canvas || document.getElementById('constellationCanvas');
      this.ctx = this.canvas.getContext('2d', { alpha: false });

      // Physics & Simulation Tuning - Expansive Celestial Spacing
      this.params = {
        repulsion: -1600,        // Strong repulsive field keeping stars widely spaced
        linkDistance: 240,       // Generous orbital spring length
        centering: 0.0015,       // Ultra-gentle centering (prevents clump collapse)
        collisionPadding: 60,    // Generous collision barrier
        friction: 0.88,          // Kinetic damping
        showLabels: 'auto',      // 'auto' | 'always' | 'hover'
        particlesEnabled: true,  // Energy pulses along links
        glowIntensity: 1.0       // Celestial glow multiplier
      };

      // Camera Matrix & Viewport (wide perspective to view entire constellation)
      this.camera = {
        x: 0,
        y: 0,
        zoom: 0.62,
        targetX: 0,
        targetY: 0,
        targetZoom: 0.62,
        isPanning: false,
        startX: 0,
        startY: 0
      };

      // Graph Models
      this.nodes = [];
      this.links = [];
      this.nodeMap = new Map();
      this.adjacencyMap = new Map();
      this.headNode = null;

      // Selection & Hover State
      this.hoveredNode = null;
      this.selectedNode = null;
      this.draggedNode = null;
      this.highlightedNeighbors = new Set();

      // Filter State
      this.filterText = '';
      this.activeClusterFilter = 'all';

      // Visuals
      this.particles = [];
      this.backgroundStars = [];
      this.avatarImage = null;
      this.avatarLoaded = false;
      this.alpha = 1.0;
      this.rafId = null;

      // DOM UI Elements
      this.ui = {
        tooltip: document.getElementById('cgTooltip'),
        drawer: document.getElementById('cgDrawer'),
        searchInput: document.getElementById('cgSearchInput'),
        searchClear: document.getElementById('cgSearchClear'),
        searchCount: document.getElementById('cgSearchCount'),
        repulsionSlider: document.getElementById('cgRepulsionSlider'),
        repulsionVal: document.getElementById('cgRepulsionVal'),
        distanceSlider: document.getElementById('cgDistanceSlider'),
        distanceVal: document.getElementById('cgDistanceVal'),
        gravitySlider: document.getElementById('cgGravitySlider'),
        gravityVal: document.getElementById('cgGravityVal'),
        labelSelect: document.getElementById('cgLabelSelect'),
        particlesToggle: document.getElementById('cgParticlesToggle'),
        recenterBtn: document.getElementById('cgRecenterBtn'),
        reheatBtn: document.getElementById('cgReheatBtn'),
        drawerCloseBtn: document.getElementById('cgDrawerCloseBtn'),
        hudToggleBtn: document.getElementById('cgHudToggleBtn'),
        hud: document.getElementById('cgControlHud')
      };

      this.init();
    }

    async init() {
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());

      this.initBackgroundStars();
      this.loadAvatar();
      this.bindInteractions();
      this.bindUIControls();

      // Load Profile Graph Data
      await this.loadGraphData();
      this.startLoop();
    }

    resizeCanvas() {
      if (!this.container) return;
      const rect = this.container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.floor(rect.width * dpr);
      this.canvas.height = Math.floor(rect.height * dpr);
      this.width = rect.width;
      this.height = rect.height;
      this.dpr = dpr;
      this.ctx.scale(dpr, dpr);
    }

    initBackgroundStars() {
      this.backgroundStars = [];
      for (let i = 0; i < 150; i++) {
        this.backgroundStars.push({
          x: (Math.random() - 0.5) * 3200,
          y: (Math.random() - 0.5) * 3200,
          radius: Math.random() * 1.5 + 0.3,
          baseAlpha: Math.random() * 0.45 + 0.1,
          twinkleSpeed: Math.random() * 0.003 + 0.001,
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    loadAvatar() {
      this.avatarImage = new Image();
      this.avatarImage.src = 'photos/Mypic.jpg';
      this.avatarImage.onload = () => {
        this.avatarLoaded = true;
      };
    }

    async loadGraphData() {
      try {
        const res = await fetch('constellation-graph-data.json?t=' + Date.now());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        this.processDataset(data);
      } catch (err) {
        console.warn('[Profile Constellation] Fetch blocked (likely file:// protocol). Using embedded dataset:', err.message);
        const embeddedData = {
          headNodeId: "profile-head",
          nodes: [
            { id: "profile-head", label: "Lister Rodriguez", cluster: "profile", type: "head", radius: 28, icon: "👨‍💻", role: "Virtual Assistant & Full-Stack Data Specialist", summary: "Transforming data into intelligent solutions • Building AI-powered systems • Crafting scalable applications", location: "Malaybalay City Bukidnon, Philippines", email: "listerrodriguez8@gmail.com", avatar: "photos/Mypic.jpg", metrics: { degree: 7, inDegree: 0, outDegree: 7, experienceYears: "4+", channelsManaged: 12, projectsShipped: 15 }, tags: ["Full-Stack", "AI Specialist", "Virtual Assistant", "Data Ops", "Automation Lead"] },
            { id: "exp-root", label: "Work Experience", cluster: "experience", type: "domain", radius: 20, icon: "💼", role: "Professional Career & Leadership", summary: "Proven track record managing multi-channel content operations, leading cross-functional tech teams, and driving AI-powered operational efficiency.", metrics: { degree: 5, inDegree: 1, outDegree: 4 }, tags: ["Team Leadership", "Operations", "Project Delivery", "QA"] },
            { id: "exp-youtube", label: "YouTube Operations Manager", cluster: "experience", type: "item", radius: 13, icon: "📺", role: "Multi-Channel Content Operations", summary: "Managed 12 high-velocity YouTube channels (8 monetized). Directed spokespeople recordings, coordinated post-production editors, performed rigorous QA, managed daily publishing calendars, and scaled subscriber growth.", metrics: { channels: 12, monetized: 8, degree: 2 }, tags: ["12 Channels", "8 Monetized", "QA Operations", "Content Strategy", "VA Training"] },
            { id: "exp-product", label: "Product Development Manager", cluster: "experience", type: "item", radius: 13, icon: "🛠️", role: "Product Strategy & Team Leadership", summary: "Partnered directly with the CEO to shape product vision into actionable development sprints. Led execution, set pace of delivery, owned technical decisions, and managed cross-functional engineering teams.", metrics: { degree: 2 }, tags: ["CEO Direct Alignment", "Sprint Planning", "Execution Pace", "Cross-Functional Lead"] },
            { id: "exp-va-lead", label: "Virtual Assistant Operations Lead", cluster: "experience", type: "item", radius: 12, icon: "🤝", role: "Executive Support & Team Mentorship", summary: "Trained and mentored virtual assistants on recurring workflows, automated standard operating procedures (SOPs), and optimized executive workflows for remote teams.", metrics: { degree: 2 }, tags: ["VA Scaling", "SOP Automation", "Executive Support", "Process Optimization"] },
            { id: "skills-root", label: "Skills & Tech Stack", cluster: "skills", type: "domain", radius: 21, icon: "⚡", role: "Technical Competencies & Tools", summary: "Full-spectrum technical capabilities spanning AI/ML engineering, computer vision, full-stack web architectures, database design, and cloud deployments.", metrics: { degree: 8, inDegree: 1, outDegree: 7 }, tags: ["Python", "YOLOv8", "React", "Node", "MongoDB", "n8n"] },
            { id: "skill-ai-ml", label: "AI & Machine Learning", cluster: "skills", type: "item", radius: 13, icon: "🐍", role: "Model Development & Fine-Tuning", summary: "Deep expertise building intelligent AI systems with Python, PyTorch, TensorFlow, and Ultralytics YOLOv8. From prompt pipelines to production model inference.", metrics: { degree: 3 }, tags: ["Python", "PyTorch", "TensorFlow", "YOLOv8", "Scikit-Learn"] },
            { id: "skill-cv", label: "Computer Vision & YOLO", cluster: "skills", type: "item", radius: 13, icon: "👁️", role: "Object Detection & Image Processing", summary: "Specialized in YOLOv8 model training, OpenCV image transformations, bounding-box annotations, and high-precision defect classification.", metrics: { degree: 3 }, tags: ["YOLOv8", "OpenCV", "Object Detection", "CVAT", "Image Classification"] },
            { id: "skill-fullstack", label: "Full-Stack Web Dev", cluster: "skills", type: "item", radius: 13, icon: "⚛️", role: "Frontend & Interface Engineering", summary: "Building modern, reactive web applications with React, Node.js, modern ES6+ JavaScript, responsive CSS3 architectures, and glassmorphic UI systems.", metrics: { degree: 3 }, tags: ["React", "Node.js", "JavaScript", "HTML5", "CSS3", "Vite"] },
            { id: "skill-backend", label: "Backend & Database Design", cluster: "skills", type: "item", radius: 12, icon: "🗄️", role: "REST APIs & Data Models", summary: "Designing performant REST APIs with FastAPI, Express, and Laravel. Architecting MongoDB NoSQL and SQL relational schemas with JWT security.", metrics: { degree: 2 }, tags: ["MongoDB", "FastAPI", "Express", "Laravel", "SQL", "JWT Auth"] },
            { id: "skill-mlops", label: "Deployment & MLOps", cluster: "skills", type: "item", radius: 12, icon: "⚙️", role: "Containerization & Cloud Serving", summary: "Packaging AI models into Docker containers, automating CI/CD pipelines, and serving live endpoints via Uvicorn, Kubernetes, and cloud platforms.", metrics: { degree: 3 }, tags: ["Docker", "Kubernetes", "CI/CD", "Uvicorn", "FastAPI Serving"] },
            { id: "skill-data-ops", label: "Data Pipelines & Annotation", cluster: "skills", type: "item", radius: 12, icon: "📊", role: "ETL & Dataset Validation", summary: "End-to-end dataset preprocessing, CVAT annotation review pipelines, data sanitization, Google Sheets automation, and high-accuracy training datasets.", metrics: { degree: 2 }, tags: ["ETL", "CVAT", "Google Sheets", "Excel", "Data Validation"] },
            { id: "proj-root", label: "Featured Projects", cluster: "projects", type: "domain", radius: 21, icon: "🚀", role: "Real-World Engineering Solutions", summary: "Showcasing production-ready computer vision sorting, enterprise inventory systems, AI content production, and live microservice APIs.", metrics: { degree: 7, inDegree: 1, outDegree: 6 }, tags: ["YOLO Coffee Sorter", "MERN Inventory", "Video AI", "Data Platform"] },
            { id: "proj-coffee", label: "AI Coffee Bean Sorting", cluster: "projects", type: "item", radius: 14, icon: "☕", role: "Computer Vision Quality Classification", summary: "Developed an automated defect detection system using YOLO and TensorFlow to identify bean irregularities and sort harvest quality with high accuracy.", metrics: { degree: 2 }, tags: ["YOLO", "TensorFlow", "OpenCV", "CVAT", "Python", "Defect Detection"] },
            { id: "proj-inventory", label: "Reservation & Inventory System", cluster: "projects", type: "item", radius: 13, icon: "📦", role: "Full-Stack MERN Platform", summary: "Enterprise web application featuring JWT authentication, role-based access control, responsive dashboards, and optimized MongoDB queries.", metrics: { degree: 2 }, tags: ["React", "Node.js", "MongoDB", "Express", "REST API", "Role Access"] },
            { id: "proj-content", label: "Video Editing & AI Content", cluster: "projects", type: "item", radius: 13, icon: "🎬", role: "Short-Form Production & Strategy", summary: "4 years of professional video editing using CapCut Pro. Managed TikTok accounts, implemented AI-powered scripting, ideation, and trend-based viral production.", metrics: { degree: 2 }, tags: ["CapCut Pro", "TikTok Growth", "AI Scripting", "Viral Video", "Content Strategy"] },
            { id: "proj-data-label", label: "AI Data Labeling & Review", cluster: "projects", type: "item", radius: 12, icon: "🏷️", role: "Annotation & QA Platform", summary: "High-accuracy image annotation and dataset validation platform for machine learning pipelines with rigorous quality assurance workflows.", metrics: { degree: 2 }, tags: ["Data Annotation", "QA Pipelines", "Python", "Training Data"] },
            { id: "proj-yolo-api", label: "YOLOv8 Inference API Demo", cluster: "projects", type: "item", radius: 13, icon: "⚡", role: "FastAPI + Docker Container", summary: "Production scaffold serving YOLOv8 object detection over FastAPI (/predict endpoint) with Docker containerization and live bounding-box output.", metrics: { degree: 2 }, tags: ["FastAPI", "Docker", "YOLOv8", "Uvicorn", "Microservice"] },
            { id: "auto-root", label: "n8n Automation Systems", cluster: "automation", type: "domain", radius: 21, icon: "⚙️", role: "AI Workflow Automation Showcase", summary: "Engineered multi-step automated workflows with n8n, Slack, Notion, OpenAI, and Gemini — eliminating manual friction across business operations.", metrics: { degree: 7, inDegree: 1, outDegree: 6 }, tags: ["n8n", "OpenAI", "Gemini", "Slack Bots", "Notion API", "Pipelines"] },
            { id: "auto-content", label: "AI Content Generation", cluster: "automation", type: "item", radius: 13, icon: "🤖", role: "End-to-End Content Pipeline", image: "photos/AI1.png", summary: "n8n-powered automation pipeline utilizing Gemini and OpenAI models to turn initial prompts into structured, formatted, and published articles automatically.", metrics: { degree: 2 }, tags: ["n8n", "Gemini", "OpenAI", "Automated Publishing"] },
            { id: "auto-notion", label: "Notion Automation Advisor", cluster: "automation", type: "item", radius: 13, icon: "💡", role: "Database Event Analysis", image: "photos/AI2.png", summary: "Reads Notion workspace databases, identifies repetitive manual operational bottlenecks, and automatically recommends the highest-leverage workflows to build next.", metrics: { degree: 2 }, tags: ["n8n", "Notion API", "AI Analysis", "Process Optimization"] },
            { id: "auto-slack", label: "Slack Bot Assistant", cluster: "automation", type: "item", radius: 13, icon: "💬", role: "AI Employee Onboarding Bot", image: "photos/AI3.png", summary: "Conversational Slack assistant built with n8n and LLMs that welcomes new hires, answers company policy questions, and routes requests to team leads.", metrics: { degree: 2 }, tags: ["Slack Bot", "n8n", "HR Onboarding", "Knowledge Base"] },
            { id: "auto-risk", label: "AI Risk Predictor", cluster: "automation", type: "item", radius: 13, icon: "📈", role: "Scheduled Risk Assessment", image: "photos/AI4.png", summary: "Daily scheduled cron workflow that pulls live business metrics, executes predictive risk heuristics, and delivers formatted morning summary alerts.", metrics: { degree: 2 }, tags: ["Scheduled Cron", "Risk Model", "Morning Reports", "n8n"] },
            { id: "auto-onboard", label: "Client Onboarding Pipeline", cluster: "automation", type: "item", radius: 13, icon: "🚀", role: "Zero-Touch Client Provisioning", image: "photos/AI5.png", summary: "Automatically provisions private Slack channels, welcome decks, and calendar invites immediately upon contract signing and form submission.", metrics: { degree: 2 }, tags: ["Zero-Touch", "Slack Provisioning", "Form Triggers", "n8n"] },
            { id: "about-root", label: "About Lister", cluster: "about", type: "domain", radius: 19, icon: "🌟", role: "Background, Traits & Philosophy", summary: "Detail-oriented, tech-savvy Virtual Assistant and Data Specialist with a strong background in Information Technology. Transforming data into intelligent solutions.", metrics: { degree: 5, inDegree: 1, outDegree: 4 }, tags: ["Data Specialist", "IT Background", "Detail-Oriented", "Problem Solver"] },
            { id: "about-traits", label: "Personal Traits", cluster: "about", type: "item", radius: 12, icon: "🎯", role: "Core Professional Strengths", summary: "Detail-Oriented (meticulous QA), Innovative (exploring modern tech), Collaborative (strong team player), and Problem Solver (analytical challenge mindset).", metrics: { degree: 2 }, tags: ["Detail-Oriented", "Innovative", "Collaborative", "Analytical"] },
            { id: "about-hobbies", label: "Hobbies & Interests", cluster: "about", type: "item", radius: 12, icon: "🎮", role: "Life Beyond the Terminal", summary: "Passionate about coding, continuous learning, gaming, music production, photography, outdoor hiking, video editing, and specialty coffee brewing.", metrics: { degree: 2 }, tags: ["Coding", "Photography", "Gaming", "Music", "Coffee", "Hiking"] },
            { id: "qual-root", label: "Qualifications & MLOps", cluster: "qualifications", type: "domain", radius: 18, icon: "🎓", role: "AI Developer — YOLOv8 & Laravel", summary: "Production-ready AI engineering focused on practical deployment. Experienced deploying models via FastAPI, Docker, and Laravel queue worker backends.", metrics: { degree: 4, inDegree: 1, outDegree: 3 }, tags: ["YOLOv8", "Laravel", "FastAPI", "Docker", "MLOps"] },
            { id: "qual-cloud", label: "Cloud & Infrastructure", cluster: "qualifications", type: "item", radius: 12, icon: "☁️", role: "Scalable Cloud Architecture", summary: "Hands-on experience deploying services across AWS, Google Cloud, and Azure environments with containerization and reproducible workflows.", metrics: { degree: 2 }, tags: ["AWS", "Google Cloud", "Azure", "Docker Containers"] },
            { id: "contact-root", label: "Contact & Connect", cluster: "contact", type: "domain", radius: 19, icon: "📬", role: "Get In Touch", summary: "Open to discussing full-time opportunities, high-impact AI/data consulting, virtual assistant roles, and creative software collaborations.", metrics: { degree: 6, inDegree: 1, outDegree: 5 }, tags: ["Email", "LinkedIn", "GitHub", "Resume CV"] },
            { id: "contact-email", label: "Email Lister", cluster: "contact", type: "action", radius: 12, icon: "📧", role: "listerrodriguez8@gmail.com", actionUrl: "mailto:listerrodriguez8@gmail.com", summary: "Reach out directly for freelance engagements, full-time roles, or automation inquiries. Direct inbox access.", metrics: { degree: 2 }, tags: ["listerrodriguez8@gmail.com", "Direct Email"] },
            { id: "contact-cv", label: "View Resume / CV", cluster: "contact", type: "action", radius: 13, icon: "📄", role: "Lister Rodriguez_CV.pdf", actionUrl: "Resume/Lister Rodriguez_CV.pdf", summary: "Detailed curriculum vitae covering professional background, technical proficiencies, project milestones, and education.", metrics: { degree: 2 }, tags: ["Resume", "CV", "PDF Download"] },
            { id: "contact-github", label: "GitHub: leo1233123", cluster: "contact", type: "action", radius: 12, icon: "🐙", role: "github.com/leo1233123", actionUrl: "https://github.com/leo1233123", summary: "Explore open-source repositories, AI experiment scaffolds, automation workflows, and code samples.", metrics: { degree: 2 }, tags: ["GitHub", "Open Source", "Code Repos"] },
            { id: "contact-linkedin", label: "LinkedIn Profile", cluster: "contact", type: "action", radius: 12, icon: "💼", role: "in/lister-rodriguez-3937b0318", actionUrl: "https://www.linkedin.com/in/lister-rodriguez-3937b0318", summary: "Connect professionally on LinkedIn for endorsements, networking, and industry discussions.", metrics: { degree: 2 }, tags: ["LinkedIn", "Professional Network"] }
          ],
          links: [
            { source: "profile-head", target: "exp-root", weight: 12, type: "orbit" },
            { source: "profile-head", target: "skills-root", weight: 12, type: "orbit" },
            { source: "profile-head", target: "proj-root", weight: 12, type: "orbit" },
            { source: "profile-head", target: "auto-root", weight: 12, type: "orbit" },
            { source: "profile-head", target: "about-root", weight: 10, type: "orbit" },
            { source: "profile-head", target: "qual-root", weight: 9, type: "orbit" },
            { source: "profile-head", target: "contact-root", weight: 10, type: "orbit" },
            { source: "exp-root", target: "exp-youtube", weight: 8, type: "branch" },
            { source: "exp-root", target: "exp-product", weight: 8, type: "branch" },
            { source: "exp-root", target: "exp-va-lead", weight: 7, type: "branch" },
            { source: "skills-root", target: "skill-ai-ml", weight: 9, type: "branch" },
            { source: "skills-root", target: "skill-cv", weight: 9, type: "branch" },
            { source: "skills-root", target: "skill-fullstack", weight: 8, type: "branch" },
            { source: "skills-root", target: "skill-backend", weight: 7, type: "branch" },
            { source: "skills-root", target: "skill-mlops", weight: 7, type: "branch" },
            { source: "skills-root", target: "skill-data-ops", weight: 7, type: "branch" },
            { source: "proj-root", target: "proj-coffee", weight: 8, type: "branch" },
            { source: "proj-root", target: "proj-inventory", weight: 8, type: "branch" },
            { source: "proj-root", target: "proj-content", weight: 8, type: "branch" },
            { source: "proj-root", target: "proj-data-label", weight: 7, type: "branch" },
            { source: "proj-root", target: "proj-yolo-api", weight: 8, type: "branch" },
            { source: "auto-root", target: "auto-content", weight: 8, type: "branch" },
            { source: "auto-root", target: "auto-notion", weight: 8, type: "branch" },
            { source: "auto-root", target: "auto-slack", weight: 8, type: "branch" },
            { source: "auto-root", target: "auto-risk", weight: 8, type: "branch" },
            { source: "auto-root", target: "auto-onboard", weight: 8, type: "branch" },
            { source: "about-root", target: "about-traits", weight: 7, type: "branch" },
            { source: "about-root", target: "about-hobbies", weight: 7, type: "branch" },
            { source: "qual-root", target: "qual-cloud", weight: 7, type: "branch" },
            { source: "contact-root", target: "contact-email", weight: 8, type: "branch" },
            { source: "contact-root", target: "contact-cv", weight: 9, type: "branch" },
            { source: "contact-root", target: "contact-github", weight: 8, type: "branch" },
            { source: "contact-root", target: "contact-linkedin", weight: 8, type: "branch" },
            { source: "skill-cv", target: "proj-coffee", weight: 5, type: "cross" },
            { source: "skill-ai-ml", target: "proj-yolo-api", weight: 5, type: "cross" },
            { source: "skill-fullstack", target: "proj-inventory", weight: 5, type: "cross" },
            { source: "exp-youtube", target: "proj-content", weight: 5, type: "cross" },
            { source: "skills-root", target: "auto-root", weight: 5, type: "cross" }
          ]
        };
        this.processDataset(embeddedData);
      }
    }

    processDataset(data) {
      this.nodeMap.clear();
      this.adjacencyMap.clear();
      this.nodes = [];
      this.links = [];

      const rawNodes = data.nodes || [];
      const rawLinks = data.links || [];

      // Sector layout map (7 distinct directions radiating from Head Star)
      const DOMAIN_SECTOR_CONFIG = {
        experience:     { angle: 0,                           orbitDist: 430 }, // 3 o'clock (Right)
        skills:         { angle: (1 * Math.PI * 2 / 7),       orbitDist: 440 }, // Bottom-Right
        projects:       { angle: (2 * Math.PI * 2 / 7),       orbitDist: 450 }, // Bottom
        automation:     { angle: (3 * Math.PI * 2 / 7),       orbitDist: 450 }, // Bottom-Left
        about:          { angle: (4 * Math.PI * 2 / 7),       orbitDist: 440 }, // Top-Left
        qualifications: { angle: (5 * Math.PI * 2 / 7),       orbitDist: 430 }, // Top
        contact:        { angle: (6 * Math.PI * 2 / 7),       orbitDist: 430 }  // Top-Right
      };

      // Group children per domain cluster
      const clusterChildren = new Map();
      rawNodes.forEach(rn => {
        if (rn.type !== 'head' && rn.type !== 'domain') {
          if (!clusterChildren.has(rn.cluster)) clusterChildren.set(rn.cluster, []);
          clusterChildren.get(rn.cluster).push(rn);
        }
      });

      const domainCoords = new Map();

      // First Pass: instantiate Head Star and Domain Stars
      rawNodes.forEach((rn) => {
        const isHead = rn.type === 'head' || rn.id === 'profile-head';
        const isDomain = rn.type === 'domain';

        let radius = rn.radius || 13;
        let x = 0;
        let y = 0;

        if (isHead) {
          radius = 32;
          x = 0;
          y = 0;
        } else if (isDomain) {
          radius = 22;
          const conf = DOMAIN_SECTOR_CONFIG[rn.cluster] || { angle: 0, orbitDist: 430 };
          x = Math.cos(conf.angle) * conf.orbitDist;
          y = Math.sin(conf.angle) * conf.orbitDist;
          domainCoords.set(rn.cluster, { x, y, angle: conf.angle });
        }

        const node = {
          ...rn,
          x,
          y,
          vx: 0,
          vy: 0,
          radius,
          palette: DOMAIN_PALETTES[rn.cluster] || DOMAIN_PALETTES.default,
          isHead,
          isDomain,
          pinned: isHead, // Pin Head Star at celestial origin
          visible: true
        };

        if (isHead) this.headNode = node;

        this.nodeMap.set(node.id, node);
        this.adjacencyMap.set(node.id, { in: [], out: [], all: new Set() });
        this.nodes.push(node);
      });

      // Second Pass: position child sub-stars in wide outward fans radiating away from center
      this.nodes.forEach(node => {
        if (!node.isHead && !node.isDomain) {
          const dom = domainCoords.get(node.cluster) || { x: 0, y: 0, angle: 0 };
          const siblings = clusterChildren.get(node.cluster) || [];
          const idx = siblings.findIndex(s => s.id === node.id);
          const count = siblings.length || 1;

          // Generous radial fan arc (~85-95 degrees spread)
          const spreadArc = Math.min(1.65, 0.40 * Math.max(count, 2));
          const angleStep = count > 1 ? spreadArc / (count - 1) : 0;
          const offsetAngle = dom.angle - (spreadArc * 0.5) + (idx * angleStep);

          // Stagger children into dual orbital rings (alternating inner & outer)
          const tier = (idx % 2 === 0) ? 1 : 2;
          const childDist = tier === 1 ? 230 : 380;
          node.branchLength = childDist;

          node.x = dom.x + Math.cos(offsetAngle) * childDist;
          node.y = dom.y + Math.sin(offsetAngle) * childDist;
        }
      });

      // Process Links with generous physical lengths
      rawLinks.forEach(rl => {
        const s = this.nodeMap.get(rl.source);
        const t = this.nodeMap.get(rl.target);
        if (s && t) {
          const isOrbit = rl.type === 'orbit';
          const isBranch = rl.type === 'branch';
          const length = isOrbit ? 430 : (isBranch ? (t.branchLength || 260) : 320);
          const link = {
            ...rl,
            source: s,
            target: t,
            weight: rl.weight || 8,
            length: length
          };
          this.links.push(link);

          this.adjacencyMap.get(s.id).out.push(t);
          this.adjacencyMap.get(s.id).all.add(t.id);

          this.adjacencyMap.get(t.id).in.push(s);
          this.adjacencyMap.get(t.id).all.add(s.id);
        }
      });

      this.initParticles();
      this.updateSearchCount();
      this.reheatSimulation(1.0);
    }

    initParticles() {
      this.particles = [];
      this.links.forEach((l, i) => {
        this.particles.push({
          link: l,
          progress: (i * 0.17) % 1.0,
          speed: 0.0035 + (l.weight * 0.0003),
          color: l.source.palette.primary
        });
      });
    }

    // --- Physics Simulation (Verlet Velocity Integration with Anti-Clump Repulsion) ---
    stepPhysics() {
      if (this.alpha < 0.002) return;

      const nodes = this.nodes;
      const links = this.links;
      const n = nodes.length;

      // 1. Many-Body Inverse-Distance Repulsion
      const repulsion = this.params.repulsion; // -1600
      for (let i = 0; i < n; i++) {
        const u = nodes[i];
        if (!u.visible) continue;

        for (let j = i + 1; j < n; j++) {
          const v = nodes[j];
          if (!v.visible) continue;

          let dx = v.x - u.x;
          let dy = v.y - u.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) {
            dx = (Math.random() - 0.5) * 2.0;
            dy = (Math.random() - 0.5) * 2.0;
            dist = Math.sqrt(dx * dx + dy * dy);
          }

          // Smooth inverse linear distance force (strong nearby, gentle far)
          const force = (repulsion / Math.max(30, dist)) * this.alpha;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (!u.pinned) { u.vx += fx; u.vy += fy; }
          if (!v.pinned) { v.vx -= fx; v.vy -= fy; }

          // Strict Collision Boundary (Guarantees at least 140px so labels NEVER overlap!)
          const minDist = Math.max(u.radius + v.radius + this.params.collisionPadding, 140);
          if (dist < minDist) {
            const overlap = (minDist - dist) * 0.85 * this.alpha;
            const ox = (dx / dist) * overlap;
            const oy = (dy / dist) * overlap;
            if (!u.pinned) { u.x -= ox; u.y -= oy; }
            if (!v.pinned) { v.x += ox; v.y += oy; }
          }
        }
      }

      // 2. Link Spring Force with dynamic slider scaling
      const lengthScale = this.params.linkDistance / 240;
      for (let i = 0; i < links.length; i++) {
        const l = links[i];
        const u = l.source;
        const v = l.target;
        if (!u.visible || !v.visible) continue;

        const dx = v.x - u.x;
        const dy = v.y - u.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

        const targetDist = l.length * lengthScale;
        const displacement = dist - targetDist;
        const stiffness = l.type === 'orbit' ? 0.022 : (l.type === 'branch' ? 0.032 : 0.012);
        const springForce = displacement * stiffness * this.alpha;

        const fx = (dx / dist) * springForce;
        const fy = (dy / dist) * springForce;

        if (!u.pinned) { u.vx += fx; u.vy += fy; }
        if (!v.pinned) { v.vx -= fx; v.vy -= fy; }
      }

      // 3. Ultra-Gentle Centering Gravity (keeps constellation centered without crushing)
      const centering = this.params.centering * this.alpha;
      for (let i = 0; i < n; i++) {
        const u = nodes[i];
        if (!u.pinned && u.visible) {
          u.vx -= u.x * centering;
          u.vy -= u.y * centering;
        }
      }

      // 4. Kinetic Damping
      const friction = this.params.friction;
      for (let i = 0; i < n; i++) {
        const u = nodes[i];
        if (!u.pinned && u.visible) {
          u.vx *= friction;
          u.vy *= friction;
          u.x += u.vx;
          u.y += u.vy;
        }
      }

      this.alpha *= 0.99;
    }

    reheatSimulation(energy = 0.5) {
      this.alpha = Math.max(this.alpha, energy);
    }

    // --- Rendering Pipeline ---
    render() {
      const ctx = this.ctx;
      const w = this.width;
      const h = this.height;

      // 1. Deep Space Clear
      ctx.fillStyle = '#0b0e14';
      ctx.fillRect(0, 0, w, h);

      // Camera lerp
      this.camera.x += (this.camera.targetX - this.camera.x) * 0.14;
      this.camera.y += (this.camera.targetY - this.camera.y) * 0.14;
      this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.14;

      ctx.save();
      ctx.translate(w * 0.5 + this.camera.x, h * 0.5 + this.camera.y);
      ctx.scale(this.camera.zoom, this.camera.zoom);

      // 2. Cosmic Background Starfield
      this.renderStarfield(ctx);

      // 3. Constellation Threads & Flow Particles
      this.renderLinks(ctx);
      if (this.params.particlesEnabled) {
        this.renderParticles(ctx);
      }

      // 4. Star Nodes (Head Star, Domain Stars, Sub-Stars)
      this.renderNodes(ctx);

      // 5. Constellation Labels
      this.renderLabels(ctx);

      ctx.restore();
    }

    renderStarfield(ctx) {
      const now = performance.now();
      for (const s of this.backgroundStars) {
        const tw = Math.sin(now * s.twinkleSpeed + s.phase);
        const a = s.baseAlpha + tw * 0.15;
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.04, a)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    renderLinks(ctx) {
      const isFocus = Boolean(this.hoveredNode || this.selectedNode);
      const activeId = this.hoveredNode ? this.hoveredNode.id : (this.selectedNode ? this.selectedNode.id : null);

      for (const link of this.links) {
        if (!link.source.visible || !link.target.visible) continue;

        const isHighlighted = link.source.id === activeId || link.target.id === activeId;
        const isOrbit = link.type === 'orbit';

        let alpha = isFocus ? (isHighlighted ? 0.9 : 0.04) : (isOrbit ? 0.35 : 0.18);
        let strokeColor = isHighlighted ? '#00f0ff' : link.source.palette.primary;

        ctx.strokeStyle = strokeColor;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = isHighlighted ? 2.2 : (isOrbit ? 1.6 : 1.1);

        if (isHighlighted) {
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#00f0ff';
        }

        ctx.beginPath();
        ctx.moveTo(link.source.x, link.source.y);
        ctx.lineTo(link.target.x, link.target.y);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
      }
    }

    renderParticles(ctx) {
      ctx.shadowBlur = 9;
      for (const p of this.particles) {
        const l = p.link;
        if (!l.source.visible || !l.target.visible) continue;

        p.progress = (p.progress + p.speed) % 1.0;
        const px = l.source.x + (l.target.x - l.source.x) * p.progress;
        const py = l.source.y + (l.target.y - l.source.y) * p.progress;

        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    renderNodes(ctx) {
      const isFocus = Boolean(this.hoveredNode || this.selectedNode);
      const activeId = this.hoveredNode ? this.hoveredNode.id : (this.selectedNode ? this.selectedNode.id : null);
      const now = performance.now();

      for (const node of this.nodes) {
        if (!node.visible) continue;

        const isDirect = node.id === activeId;
        const isNeighbor = this.highlightedNeighbors.has(node.id);
        const isActive = isDirect || isNeighbor;

        const alpha = isFocus ? (isActive ? 1.0 : 0.15) : 1.0;
        const r = isDirect ? node.radius * 1.25 : node.radius;

        ctx.save();
        ctx.globalAlpha = alpha;

        // --- Head Star (Lister Rodriguez Central Sun) ---
        if (node.isHead) {
          // Double Radiant Halo
          const pulse = Math.sin(now * 0.002) * 5;
          ctx.shadowBlur = isDirect ? 45 : 30 + pulse;
          ctx.shadowColor = 'rgba(0, 240, 255, 0.8)';

          // Outer celestial ring
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 7 + pulse * 0.5, 0, Math.PI * 2);
          ctx.stroke();

          // Golden corona ring
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 4, 0, Math.PI * 2);
          ctx.stroke();

          // If avatar is available, render circular avatar photo!
          if (this.avatarLoaded && this.avatarImage) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(this.avatarImage, node.x - r, node.y - r, r * 2, r * 2);
            ctx.restore();
          } else {
            const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.4, '#00f0ff');
            grad.addColorStop(1, '#0284c7');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
            ctx.fill();
          }

        } else {
          // --- Orbital & Sub-Stars ---
          ctx.shadowBlur = isDirect ? 30 : (node.isDomain ? 20 : 12);
          ctx.shadowColor = node.palette.glow;

          const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r);
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.35, node.palette.primary);
          grad.addColorStop(1, node.palette.dark);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.fill();

          // White-hot stellar core
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(node.x, node.y, r * 0.32, 0, Math.PI * 2);
          ctx.fill();

          // Domain Halo Ring
          if (node.isDomain) {
            ctx.strokeStyle = node.palette.primary;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 4, 0, Math.PI * 2);
            ctx.stroke();
          }

          if (isDirect) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 6, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        ctx.restore();
      }
    }

    renderLabels(ctx) {
      const zoom = this.camera.zoom;
      const mode = this.params.showLabels;
      const isFocus = Boolean(this.hoveredNode || this.selectedNode);
      const activeId = this.hoveredNode ? this.hoveredNode.id : (this.selectedNode ? this.selectedNode.id : null);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      for (const node of this.nodes) {
        if (!node.visible) continue;

        const isDirect = node.id === activeId;
        const isNeighbor = this.highlightedNeighbors.has(node.id);
        const isActive = isDirect || isNeighbor;

        // Label visibility threshold logic
        let show = false;
        if (mode === 'always') show = true;
        else if (mode === 'hover') show = isActive;
        else if (mode === 'auto') {
          show = node.isHead || node.isDomain || isActive || zoom > 0.48;
        }

        if (!show) continue;

        const alpha = isFocus ? (isActive ? 1.0 : 0.18) : 0.95;
        ctx.save();
        ctx.globalAlpha = alpha;

        const text = (node.icon ? node.icon + ' ' : '') + node.label;
        ctx.font = node.isHead
          ? '700 13px "Inter", sans-serif'
          : (node.isDomain ? '600 11.5px "Inter", sans-serif' : '500 10.5px "Inter", sans-serif');

        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        const pillHeight = 20;

        // Smart Radial Label Placement: project outward from celestial center to prevent overlapping links & stars
        let labelX = node.x;
        let labelY;

        if (node.isHead) {
          labelY = node.y + node.radius + 12;
        } else {
          // If in top hemisphere, place above star; if in bottom hemisphere, place below star
          if (node.y < -40) {
            labelY = node.y - node.radius - pillHeight - 6;
          } else {
            labelY = node.y + node.radius + 8;
          }
        }

        // Backing pill for crystal clear legibility
        ctx.fillStyle = node.isHead
          ? 'rgba(0, 240, 255, 0.22)'
          : (isActive ? 'rgba(30, 41, 59, 0.95)' : 'rgba(11, 14, 20, 0.88)');
        ctx.beginPath();
        ctx.roundRect(labelX - textWidth * 0.5 - 7, labelY - 2, textWidth + 14, pillHeight, 6);
        ctx.fill();

        ctx.strokeStyle = node.isHead
          ? '#00f0ff'
          : (isActive ? node.palette.primary : 'rgba(255, 255, 255, 0.16)');
        ctx.lineWidth = isActive ? 1.5 : 1;
        ctx.stroke();

        ctx.fillStyle = node.isHead ? '#00f0ff' : (isActive ? '#ffffff' : '#f1f5f9');
        ctx.fillText(text, labelX, labelY + 2);

        ctx.restore();
      }
    }

    startLoop() {
      const loop = () => {
        this.stepPhysics();
        this.render();
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    }

    // --- Interactive Mouse & Touch Handling ---
    bindInteractions() {
      const container = this.container;

      const screenToWorld = (screenX, screenY) => {
        const rect = container.getBoundingClientRect();
        const cx = screenX - rect.left - this.width * 0.5;
        const cy = screenY - rect.top - this.height * 0.5;
        return {
          x: (cx - this.camera.x) / this.camera.zoom,
          y: (cy - this.camera.y) / this.camera.zoom
        };
      };

      const findNodeAt = (worldX, worldY) => {
        for (let i = this.nodes.length - 1; i >= 0; i--) {
          const n = this.nodes[i];
          if (!n.visible) continue;
          const dx = n.x - worldX;
          const dy = n.y - worldY;
          if (dx * dx + dy * dy <= (n.radius + 8) * (n.radius + 8)) {
            return n;
          }
        }
        return null;
      };

      // Mouse Move
      container.addEventListener('mousemove', e => {
        const wpos = screenToWorld(e.clientX, e.clientY);

        if (this.draggedNode) {
          this.draggedNode.x = wpos.x;
          this.draggedNode.y = wpos.y;
          this.reheatSimulation(0.35);
          return;
        }

        if (this.camera.isPanning) {
          const dx = e.clientX - this.camera.startX;
          const dy = e.clientY - this.camera.startY;
          this.camera.targetX += dx;
          this.camera.targetY += dy;
          this.camera.startX = e.clientX;
          this.camera.startY = e.clientY;
          return;
        }

        const hit = findNodeAt(wpos.x, wpos.y);
        if (hit !== this.hoveredNode) {
          this.hoveredNode = hit;
          this.updateHighlights();
          this.showTooltip(hit, e.clientX, e.clientY);
        } else if (hit) {
          this.showTooltip(hit, e.clientX, e.clientY);
        } else {
          this.hideTooltip();
        }
      });

      // Mouse Down
      container.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        const wpos = screenToWorld(e.clientX, e.clientY);
        const hit = findNodeAt(wpos.x, wpos.y);

        if (hit) {
          this.draggedNode = hit;
          if (!hit.isHead) hit.pinned = true;
          this.reheatSimulation(0.35);
          container.classList.add('is-dragging');
        } else {
          this.camera.isPanning = true;
          this.camera.startX = e.clientX;
          this.camera.startY = e.clientY;
          container.classList.add('is-dragging');
        }
      });

      // Mouse Up
      window.addEventListener('mouseup', () => {
        if (this.draggedNode) {
          if (!this.draggedNode.isHead) this.draggedNode.pinned = false;
          this.draggedNode = null;
        }
        this.camera.isPanning = false;
        container.classList.remove('is-dragging');
      });

      // Click (Select & Open Profile Drawer)
      container.addEventListener('click', e => {
        const wpos = screenToWorld(e.clientX, e.clientY);
        const hit = findNodeAt(wpos.x, wpos.y);

        if (hit) {
          this.selectNode(hit);
        } else {
          if (this.selectedNode && !this.camera.isPanning) {
            this.selectedNode = null;
            this.updateHighlights();
            this.closeDrawer();
          }
        }
      });

      // Zoom
      container.addEventListener('wheel', e => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 0.87;
        const newZoom = Math.max(0.25, Math.min(4.0, this.camera.targetZoom * factor));

        const rect = container.getBoundingClientRect();
        const mx = e.clientX - rect.left - this.width * 0.5;
        const my = e.clientY - rect.top - this.height * 0.5;

        this.camera.targetX -= (mx - this.camera.targetX) * (factor - 1);
        this.camera.targetY -= (my - this.camera.targetY) * (factor - 1);
        this.camera.targetZoom = newZoom;
      }, { passive: false });

      // Keyboard Controls
      window.addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.key === 'Escape') {
          if (this.ui.drawer.classList.contains('open')) {
            this.closeDrawer();
          } else {
            this.toggleViewMode(false);
          }
        }
        if (e.key === 'g' || e.key === 'G') {
          this.toggleViewMode();
        }
        if (e.key === 'r' || e.key === 'R') {
          this.recenterCamera();
        }
      });
    }

    updateHighlights() {
      this.highlightedNeighbors.clear();
      const active = this.hoveredNode || this.selectedNode;
      if (!active) return;

      const adj = this.adjacencyMap.get(active.id);
      if (adj) {
        adj.all.forEach(id => this.highlightedNeighbors.add(id));
      }
    }

    showTooltip(node, screenX, screenY) {
      if (!this.ui.tooltip) return;
      const subtitle = node.role || node.cluster;
      this.ui.tooltip.innerHTML = `
        <div class="cg-tooltip-title">
          <span>${node.icon ? node.icon + ' ' : ''}${node.label}</span>
        </div>
        <div class="cg-tooltip-sub">
          <strong>${subtitle}</strong>
        </div>
      `;
      this.ui.tooltip.style.left = `${screenX}px`;
      this.ui.tooltip.style.top = `${screenY}px`;
      this.ui.tooltip.classList.add('visible');
    }

    hideTooltip() {
      if (this.ui.tooltip) {
        this.ui.tooltip.classList.remove('visible');
      }
    }

    selectNode(node) {
      this.selectedNode = node;
      this.updateHighlights();
      this.openDrawer(node);
      this.focusOnNode(node);
    }

    focusOnNode(node) {
      this.camera.targetX = -node.x * this.camera.targetZoom;
      this.camera.targetY = -node.y * this.camera.targetZoom;
      this.camera.targetZoom = node.isHead ? 1.1 : 1.4;
      this.reheatSimulation(0.25);
    }

    recenterCamera() {
      this.camera.targetX = 0;
      this.camera.targetY = 0;
      this.camera.targetZoom = 0.62;
      this.reheatSimulation(0.5);
    }

    // --- Slide-Over Profile Metadata Drawer ---
    openDrawer(node) {
      const drawer = this.ui.drawer;
      if (!drawer) return;

      const adj = this.adjacencyMap.get(node.id) || { in: [], out: [] };

      // Set Title and Domain Badge
      document.getElementById('cgDrawerTitle').textContent = `${node.icon ? node.icon + ' ' : ''}${node.label}`;
      document.getElementById('cgDrawerPath').textContent = node.role || node.cluster;
      document.getElementById('cgDrawerTypeBadge').textContent = node.type.toUpperCase();
      document.getElementById('cgDrawerClusterBadge').textContent = (DOMAIN_PALETTES[node.cluster]?.label || node.cluster).toUpperCase();

      // Metrics / Quick Info
      const metricsContainer = document.querySelector('.cg-metrics-grid');
      if (metricsContainer) {
        if (node.isHead) {
          metricsContainer.innerHTML = `
            <div class="cg-metric-card"><span class="cg-metric-label">Experience</span><span class="cg-metric-val">4+ Years</span></div>
            <div class="cg-metric-card"><span class="cg-metric-label">Channels Managed</span><span class="cg-metric-val">12 (8 Monetized)</span></div>
            <div class="cg-metric-card"><span class="cg-metric-label">Specialization</span><span class="cg-metric-val">AI & Data Ops</span></div>
            <div class="cg-metric-card"><span class="cg-metric-label">Status</span><span class="cg-risk-pill risk-safe">✓ Available for Hire</span></div>
          `;
        } else {
          metricsContainer.innerHTML = `
            <div class="cg-metric-card"><span class="cg-metric-label">Domain</span><span class="cg-metric-val">${node.cluster}</span></div>
            <div class="cg-metric-card"><span class="cg-metric-label">Connected Stars</span><span class="cg-metric-val">${adj.all.size} Connections</span></div>
          `;
        }
      }

      // Summary / Detailed Story Card
      let storyContainer = document.getElementById('cgDrawerStory');
      if (!storyContainer) {
        storyContainer = document.createElement('div');
        storyContainer.id = 'cgDrawerStory';
        document.querySelector('.cg-drawer-body').insertBefore(storyContainer, document.querySelector('.cg-drawer-body').children[1]);
      }

      let imageHtml = '';
      if (node.image) {
        imageHtml = `
          <div style="margin: 0.8rem 0; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
            <img src="${node.image}" alt="${node.label}" style="width: 100%; display: block; object-fit: cover; max-height: 220px;" />
          </div>
        `;
      } else if (node.isHead) {
        imageHtml = `
          <div style="display: flex; align-items: center; gap: 1rem; margin: 0.8rem 0; padding: 0.8rem; background: rgba(0, 240, 255, 0.08); border: 1px solid rgba(0, 240, 255, 0.25); border-radius: 14px;">
            <img src="photos/Mypic.jpg" alt="Lister Rodriguez" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 2px solid #00f0ff;" />
            <div>
              <div style="font-weight: 700; color: #fff;">Lister Rodriguez</div>
              <div style="font-size: 0.8rem; color: #94a3b8;">Malaybalay City Bukidnon, Philippines</div>
              <div style="font-size: 0.8rem; color: #38bdf8;">listerrodriguez8@gmail.com</div>
            </div>
          </div>
        `;
      }

      storyContainer.innerHTML = `
        ${imageHtml}
        <div style="font-size: 0.92rem; line-height: 1.7; color: #e2e8f0; margin: 0.75rem 0;">
          ${node.summary || ''}
        </div>
      `;

      // Connected Stars List
      const inList = document.getElementById('cgDrawerInList');
      inList.innerHTML = '';
      const connectedNodes = [...adj.out, ...adj.in];
      if (connectedNodes.length === 0) {
        inList.innerHTML = '<div style="color:#64748b;font-size:0.8rem;">Independent node</div>';
      } else {
        connectedNodes.forEach(dep => {
          const item = document.createElement('div');
          item.className = 'cg-dep-item';
          item.innerHTML = `
            <span class="cg-dep-name">${dep.icon ? dep.icon + ' ' : ''}${dep.label}</span>
            <span class="cg-dep-tag">${dep.cluster}</span>
          `;
          item.addEventListener('click', () => this.selectNode(dep));
          inList.appendChild(item);
        });
      }

      // Hide outbound list header or repurpose as tags
      const outSection = document.getElementById('cgDrawerOutList')?.parentElement;
      if (outSection) outSection.style.display = 'none';

      // Tags Pills
      const exportList = document.getElementById('cgDrawerExportList');
      const tags = node.tags || [];
      exportList.innerHTML = '';
      tags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'cg-code-pill';
        span.textContent = tag;
        exportList.appendChild(span);
      });

      // Actions Footer
      const focusBtn = document.getElementById('cgDrawerFocusBtn');
      focusBtn.onclick = () => this.focusOnNode(node);

      const openBtn = document.getElementById('cgDrawerOpenBtn');
      if (node.actionUrl) {
        openBtn.style.display = 'inline-flex';
        openBtn.textContent = '🚀 Open Link / File';
        openBtn.href = node.actionUrl;
        openBtn.target = '_blank';
      } else if (node.isHead) {
        openBtn.style.display = 'inline-flex';
        openBtn.textContent = '📄 Download CV';
        openBtn.href = 'Resume/Lister Rodriguez_CV.pdf';
        openBtn.target = '_blank';
      } else {
        openBtn.style.display = 'none';
      }

      drawer.classList.add('open');
    }

    closeDrawer() {
      if (this.ui.drawer) {
        this.ui.drawer.classList.remove('open');
      }
    }

    // --- Search & Filter Suite ---
    applyFilters() {
      const q = this.filterText.toLowerCase().trim();
      const cluster = this.activeClusterFilter;

      let visibleCount = 0;
      let firstMatch = null;

      this.nodes.forEach(node => {
        const matchText = !q ||
          node.label.toLowerCase().includes(q) ||
          (node.role && node.role.toLowerCase().includes(q)) ||
          (node.summary && node.summary.toLowerCase().includes(q)) ||
          (node.tags && node.tags.some(t => t.toLowerCase().includes(q)));

        const matchCluster = cluster === 'all' || node.cluster === cluster || node.isHead;

        const isVisible = matchText && matchCluster;
        node.visible = isVisible;
        if (isVisible) {
          visibleCount++;
          if (!firstMatch) firstMatch = node;
        }
      });

      this.updateSearchCount(visibleCount);
      this.reheatSimulation(0.3);

      if (q && visibleCount === 1 && firstMatch) {
        this.focusOnNode(firstMatch);
      }
    }

    updateSearchCount(count = this.nodes.length) {
      if (this.ui.searchCount) {
        this.ui.searchCount.textContent = `${count} / ${this.nodes.length} Stars`;
      }
    }

    // --- Control Panel HUD Sliders & Buttons ---
    bindUIControls() {
      if (this.ui.searchInput) {
        this.ui.searchInput.addEventListener('input', e => {
          this.filterText = e.target.value;
          if (this.ui.searchClear) {
            this.ui.searchClear.classList.toggle('visible', Boolean(this.filterText));
          }
          this.applyFilters();
        });
      }

      if (this.ui.searchClear) {
        this.ui.searchClear.addEventListener('click', () => {
          this.ui.searchInput.value = '';
          this.filterText = '';
          this.ui.searchClear.classList.remove('visible');
          this.applyFilters();
        });
      }

      // Domain Filter Pills
      document.querySelectorAll('.cg-pill[data-filter-cluster]').forEach(pill => {
        pill.addEventListener('click', () => {
          document.querySelectorAll('.cg-pill[data-filter-cluster]').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          this.activeClusterFilter = pill.getAttribute('data-filter-cluster');
          this.applyFilters();
        });
      });

      // Repulsion slider
      if (this.ui.repulsionSlider) {
        this.ui.repulsionSlider.value = this.params.repulsion;
        if (this.ui.repulsionVal) this.ui.repulsionVal.textContent = this.params.repulsion;
        this.ui.repulsionSlider.addEventListener('input', e => {
          this.params.repulsion = parseFloat(e.target.value);
          if (this.ui.repulsionVal) this.ui.repulsionVal.textContent = this.params.repulsion;
          this.reheatSimulation(0.4);
        });
      }

      // Link distance slider
      if (this.ui.distanceSlider) {
        this.ui.distanceSlider.value = this.params.linkDistance;
        if (this.ui.distanceVal) this.ui.distanceVal.textContent = this.params.linkDistance;
        this.ui.distanceSlider.addEventListener('input', e => {
          this.params.linkDistance = parseFloat(e.target.value);
          if (this.ui.distanceVal) this.ui.distanceVal.textContent = this.params.linkDistance;
          this.reheatSimulation(0.4);
        });
      }

      // Gravity slider
      if (this.ui.gravitySlider) {
        this.ui.gravitySlider.value = this.params.centering;
        if (this.ui.gravityVal) this.ui.gravityVal.textContent = this.params.centering.toFixed(4);
        this.ui.gravitySlider.addEventListener('input', e => {
          this.params.centering = parseFloat(e.target.value);
          if (this.ui.gravityVal) this.ui.gravityVal.textContent = this.params.centering.toFixed(4);
          this.reheatSimulation(0.3);
        });
      }

      // Labels dropdown
      if (this.ui.labelSelect) {
        this.ui.labelSelect.addEventListener('change', e => {
          this.params.showLabels = e.target.value;
        });
      }

      // Particles switch
      if (this.ui.particlesToggle) {
        this.ui.particlesToggle.addEventListener('change', e => {
          this.params.particlesEnabled = e.target.checked;
        });
      }

      // Recenter & Reheat buttons
      if (this.ui.recenterBtn) {
        this.ui.recenterBtn.addEventListener('click', () => this.recenterCamera());
      }
      if (this.ui.reheatBtn) {
        this.ui.reheatBtn.addEventListener('click', () => this.reheatSimulation(1.0));
      }

      // Drawer close
      if (this.ui.drawerCloseBtn) {
        this.ui.drawerCloseBtn.addEventListener('click', () => this.closeDrawer());
      }

      // HUD Collapse
      if (this.ui.hudToggleBtn && this.ui.hud) {
        this.ui.hudToggleBtn.addEventListener('click', () => {
          this.ui.hud.classList.toggle('collapsed');
        });
      }

      // Top bar Back button
      const backBtn = document.getElementById('cgBackBtn');
      if (backBtn) {
        backBtn.addEventListener('click', () => this.toggleViewMode(false));
      }

      // FAB Switcher
      const fabBtn = document.getElementById('cgFabSwitcher');
      if (fabBtn) {
        fabBtn.addEventListener('click', () => this.toggleViewMode());
      }

      // Nav toggle button
      const navBtn = document.getElementById('navGraphBtn');
      if (navBtn) {
        navBtn.addEventListener('click', e => {
          e.preventDefault();
          this.toggleViewMode(true);
        });
      }
    }

    // --- State & View Mode Transition Hook ---
    toggleViewMode(targetState) {
      const graphWrapper = document.getElementById('constellationView');
      const portfolioWrapper = document.getElementById('portfolioView');
      const fabBtn = document.getElementById('cgFabSwitcher');

      const isCurrentGraph = graphWrapper && graphWrapper.classList.contains('constellation-view-active');
      const nextState = typeof targetState === 'boolean' ? targetState : !isCurrentGraph;

      if (nextState) {
        if (portfolioWrapper) portfolioWrapper.classList.add('portfolio-view-hidden');
        if (graphWrapper) {
          graphWrapper.style.display = 'flex';
          void graphWrapper.offsetWidth;
          graphWrapper.classList.add('constellation-view-active');
        }
        if (fabBtn) {
          fabBtn.innerHTML = '<span class="cg-fab-icon">📄</span> Standard Portfolio';
        }
        window.location.hash = 'constellation';
        this.resizeCanvas();
        this.reheatSimulation(0.65);
      } else {
        if (graphWrapper) {
          graphWrapper.classList.remove('constellation-view-active');
          setTimeout(() => {
            if (!graphWrapper.classList.contains('constellation-view-active')) {
              graphWrapper.style.display = 'none';
            }
          }, 450);
        }
        if (portfolioWrapper) portfolioWrapper.classList.remove('portfolio-view-hidden');
        if (fabBtn) {
          fabBtn.innerHTML = '<span class="cg-fab-icon">🌌</span> Profile Constellation';
        }
        if (window.location.hash === '#constellation' || window.location.hash === '#graph') {
          history.pushState('', document.title, window.location.pathname + window.location.search);
        }
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const engine = new ProfileConstellation();
    global.profileConstellation = engine;

    if (window.location.hash === '#constellation' || window.location.hash === '#graph' || window.location.search.includes('view=constellation')) {
      engine.toggleViewMode(true);
    }
  });

})(window);
