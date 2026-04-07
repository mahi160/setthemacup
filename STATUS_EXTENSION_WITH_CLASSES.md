# Status Extension - Using JavaScript Classes

Now that you understand classes, let's refactor your status extension to use them!

---

## Approach 1: Simple Class-Based (Recommended)

Convert the widget logic into a class:

```javascript
import { execSync } from "node:child_process";

// ============================================================================
// WIDGET RENDERER CLASS
// ============================================================================

class StatusWidget {
  constructor(pi, ctx, model) {
    this.pi = pi;
    this.ctx = ctx;
    this.model = model;
    
    // Provider metadata
    this.PROVIDER_METADATA = {
      anthropic: {
        name: "Anthropic",
        icon: "󰚩",
        color: "\x1b[38;5;208m",
        models: {
          "claude-sonnet-4-6": "Sonnet 4.6",
          "claude-opus-4-6": "Opus 4.6",
          "claude-haiku-4-5": "Haiku 4.5",
        },
      },
      "github-copilot": {
        name: "Copilot",
        icon: "",
        color: "\x1b[94m",
        models: {
          "gpt-4.1": "GPT 4.1",
          "gpt-5-mini": "GPT 5 Mini",
        },
      },
    };
  }
  
  // ========== GETTERS ==========
  
  get providerInfo() {
    if (!this.model) return {};
    const id = this.model.id.toLowerCase();
    const meta = this.PROVIDER_METADATA[this.model.provider] ?? {};
    const modelName = meta.models?.[id] ?? "Unknown";
    return { ...meta, modelName };
  }
  
  get thinkingLevel() {
    const lvl = this.pi.getThinkingLevel();
    return lvl || "normal";
  }
  
  get tokenUsage() {
    const usage = this.ctx.getContextUsage();
    if (!usage) return { tokens: "0k", percent: "0%" };
    return {
      tokens: `${Math.round(usage.tokens / 1000)}k`,
      percent: `${Math.round(usage.percent)}%`,
    };
  }
  
  get projectName() {
    return this.ctx.cwd?.split("/").pop() ?? "";
  }
  
  get gitBranch() {
    try {
      return execSync("git rev-parse --abbrev-ref HEAD", {
        encoding: "utf8",
      }).trim();
    } catch {
      return "no-git";
    }
  }
  
  // ========== RENDER METHODS ==========
  
  renderProvider() {
    const { color, icon, name, modelName } = this.providerInfo;
    if (!modelName) return "";
    
    return (
      `${color}${icon} ${name}\x1b[0m` +
      ` | ${modelName} (${this.thinkingLevel})`
    );
  }
  
  renderContext() {
    const { tokens, percent } = this.tokenUsage;
    return `${tokens} (${percent})`;
  }
  
  renderProject() {
    return this.projectName || "root";
  }
  
  renderGit() {
    return this.gitBranch;
  }
  
  renderTools() {
    return "🔧";
  }
  
  // ========== LAYOUT METHODS ==========
  
  getTopWidget() {
    const provider = this.renderProvider();
    const context = this.renderContext();
    return [provider + (context ? ` | ${context}` : "")];
  }
  
  getBottomWidget() {
    const project = this.renderProject();
    const git = this.renderGit();
    const tools = this.renderTools();
    return [` | ${project} | ${git} | ${tools}`];
  }
  
  // ========== UPDATE METHOD ==========
  
  update() {
    this.ctx.ui.setWidget("status-top", this.getTopWidget(), {
      placement: "aboveEditor",
    });
    this.ctx.ui.setWidget("status-bottom", this.getBottomWidget(), {
      placement: "belowEditor",
    });
  }
}

// ============================================================================
// EXTENSION EXPORT
// ============================================================================

export default function (pi) {
  let widget = null;
  
  pi.on("session_start", (_, ctx) => {
    if (ctx.model) {
      widget = new StatusWidget(pi, ctx, ctx.model);
      widget.update();
    }
  });
  
  pi.on("model_select", (event, ctx) => {
    widget = new StatusWidget(pi, ctx, event.model);
    widget.update();
  });
  
  pi.on("turn_end", (_, ctx) => {
    if (widget) {
      widget.update();
    }
  });
}
```

**Advantages:**
- ✅ All widget logic in one place
- ✅ Easy to pass data around (constructor)
- ✅ Getters for computed properties
- ✅ Clear separation between data and rendering

---

## Approach 2: Multiple Classes (More Organized)

Separate concerns into different classes:

```javascript
import { execSync } from "node:child_process";

// ============================================================================
// DATA CLASS - Handles all data extraction
// ============================================================================

class StatusData {
  constructor(pi, ctx, model) {
    this.pi = pi;
    this.ctx = ctx;
    this.model = model;
  }
  
  get providerInfo() {
    const PROVIDERS = {
      anthropic: {
        name: "Anthropic",
        icon: "󰚩",
        color: "\x1b[38;5;208m",
        models: {
          "claude-sonnet-4-6": "Sonnet 4.6",
          "claude-opus-4-6": "Opus 4.6",
          "claude-haiku-4-5": "Haiku 4.5",
        },
      },
      // ... more providers
    };
    
    const id = this.model?.id.toLowerCase();
    const meta = PROVIDERS[this.model?.provider] ?? {};
    const modelName = meta.models?.[id] ?? "Unknown";
    return { ...meta, modelName };
  }
  
  get thinkingLevel() {
    return this.pi.getThinkingLevel() || "normal";
  }
  
  get tokenUsage() {
    const usage = this.ctx.getContextUsage();
    if (!usage) return { tokens: "0k", percent: "0%" };
    return {
      tokens: `${Math.round(usage.tokens / 1000)}k`,
      percent: `${Math.round(usage.percent)}%`,
    };
  }
  
  get projectName() {
    return this.ctx.cwd?.split("/").pop() ?? "";
  }
  
  get gitBranch() {
    try {
      return execSync("git rev-parse --abbrev-ref HEAD", {
        encoding: "utf8",
      }).trim();
    } catch {
      return "no-git";
    }
  }
}

// ============================================================================
// RENDERER CLASS - Handles formatting
// ============================================================================

class StatusRenderer {
  constructor(data) {
    this.data = data;
  }
  
  renderProvider() {
    const { color, icon, name, modelName } = this.data.providerInfo;
    if (!modelName) return "";
    return (
      `${color}${icon} ${name}\x1b[0m` +
      ` | ${modelName} (${this.data.thinkingLevel})`
    );
  }
  
  renderContext() {
    const { tokens, percent } = this.data.tokenUsage;
    return `${tokens} (${percent})`;
  }
  
  renderProject() {
    return this.data.projectName || "root";
  }
  
  renderGit() {
    return this.data.gitBranch;
  }
  
  renderTools() {
    return "🔧";
  }
  
  getTopWidget() {
    const provider = this.renderProvider();
    const context = this.renderContext();
    return [provider + (context ? ` | ${context}` : "")];
  }
  
  getBottomWidget() {
    return [
      ` | ${this.renderProject()} | ${this.renderGit()} | ${this.renderTools()}`
    ];
  }
}

// ============================================================================
// UI MANAGER CLASS - Handles widget setup
// ============================================================================

class StatusUI {
  constructor(ctx) {
    this.ctx = ctx;
  }
  
  update(renderer) {
    this.ctx.ui.setWidget("status-top", renderer.getTopWidget(), {
      placement: "aboveEditor",
    });
    this.ctx.ui.setWidget("status-bottom", renderer.getBottomWidget(), {
      placement: "belowEditor",
    });
  }
}

// ============================================================================
// EXTENSION
// ============================================================================

export default function (pi) {
  let data = null;
  let renderer = null;
  let ui = null;
  
  pi.on("session_start", (_, ctx) => {
    if (ctx.model) {
      data = new StatusData(pi, ctx, ctx.model);
      renderer = new StatusRenderer(data);
      ui = new StatusUI(ctx);
      ui.update(renderer);
    }
  });
  
  pi.on("model_select", (event, ctx) => {
    data = new StatusData(pi, ctx, event.model);
    renderer = new StatusRenderer(data);
    ui = new StatusUI(ctx);
    ui.update(renderer);
  });
  
  pi.on("turn_end", (_, ctx) => {
    if (data && renderer && ui) {
      ui.update(renderer);
    }
  });
}
```

**Advantages:**
- ✅ Clear separation: Data → Rendering → UI
- ✅ Easy to test each class independently
- ✅ Easy to swap implementations
- ✅ Follows Single Responsibility Principle

---

## Approach 3: Inheritance Pattern

Create a base widget class and extend it:

```javascript
// ============================================================================
// BASE WIDGET CLASS
// ============================================================================

class BaseWidget {
  constructor(pi, ctx, model) {
    this.pi = pi;
    this.ctx = ctx;
    this.model = model;
  }
  
  // Override these in subclasses
  getContent() {
    throw new Error("getContent() must be implemented");
  }
  
  getPlacement() {
    return "aboveEditor";
  }
  
  getId() {
    return "widget";
  }
  
  update() {
    const content = this.getContent();
    this.ctx.ui.setWidget(this.getId(), content, {
      placement: this.getPlacement(),
    });
  }
}

// ============================================================================
// SPECIFIC WIDGETS
// ============================================================================

class TopStatusWidget extends BaseWidget {
  getId() {
    return "status-top";
  }
  
  getPlacement() {
    return "aboveEditor";
  }
  
  get providerInfo() {
    // ... implementation
  }
  
  getContent() {
    const provider = this.renderProvider();
    const context = this.renderContext();
    return [provider + (context ? ` | ${context}` : "")];
  }
  
  renderProvider() {
    // ... implementation
  }
  
  renderContext() {
    // ... implementation
  }
}

class BottomStatusWidget extends BaseWidget {
  getId() {
    return "status-bottom";
  }
  
  getPlacement() {
    return "belowEditor";
  }
  
  getContent() {
    return [
      ` | ${this.renderProject()} | ${this.renderGit()} | ${this.renderTools()}`
    ];
  }
  
  renderProject() {
    return this.ctx.cwd?.split("/").pop() ?? "";
  }
  
  renderGit() {
    try {
      return execSync("git rev-parse --abbrev-ref HEAD", {
        encoding: "utf8",
      }).trim();
    } catch {
      return "no-git";
    }
  }
  
  renderTools() {
    return "🔧";
  }
}

// ============================================================================
// EXTENSION
// ============================================================================

export default function (pi) {
  let topWidget = null;
  let bottomWidget = null;
  
  const updateWidgets = (model, ctx) => {
    topWidget = new TopStatusWidget(pi, ctx, model);
    bottomWidget = new BottomStatusWidget(pi, ctx, model);
    topWidget.update();
    bottomWidget.update();
  };
  
  pi.on("session_start", (_, ctx) => {
    if (ctx.model) updateWidgets(ctx.model, ctx);
  });
  
  pi.on("model_select", (event, ctx) => {
    updateWidgets(event.model, ctx);
  });
  
  pi.on("turn_end", (_, ctx) => {
    if (topWidget && bottomWidget) {
      topWidget.update();
      bottomWidget.update();
    }
  });
}
```

**Advantages:**
- ✅ Easy to add new widgets (extend BaseWidget)
- ✅ Common logic in base class
- ✅ Each widget responsible for itself

---

## Approach 4: Advanced - Widget Registry Pattern

Create a flexible system to manage multiple widgets:

```javascript
import { execSync } from "node:child_process";

// ============================================================================
// WIDGET BASE CLASS
// ============================================================================

class Widget {
  constructor(pi, ctx, model) {
    this.pi = pi;
    this.ctx = ctx;
    this.model = model;
  }
  
  getId() {
    throw new Error("getId() must be implemented");
  }
  
  getPlacement() {
    return "aboveEditor";
  }
  
  render() {
    throw new Error("render() must be implemented");
  }
  
  update() {
    const content = this.render();
    if (content) {
      this.ctx.ui.setWidget(this.getId(), content, {
        placement: this.getPlacement(),
      });
    }
  }
}

// ============================================================================
// CONCRETE WIDGETS
// ============================================================================

class ProviderWidget extends Widget {
  getId() { return "status-provider"; }
  
  render() {
    if (!this.model) return null;
    
    const providers = {
      anthropic: {
        name: "Anthropic",
        icon: "󰚩",
        color: "\x1b[38;5;208m",
        models: {
          "claude-sonnet-4-6": "Sonnet 4.6",
          "claude-opus-4-6": "Opus 4.6",
          "claude-haiku-4-5": "Haiku 4.5",
        },
      },
      // ... more
    };
    
    const id = this.model.id.toLowerCase();
    const meta = providers[this.model.provider] ?? {};
    const modelName = meta.models?.[id] ?? "Unknown";
    const thinking = this.pi.getThinkingLevel() || "normal";
    
    return [
      `${meta.color}${meta.icon} ${meta.name}\x1b[0m | ${modelName} (${thinking})`
    ];
  }
}

class ContextWidget extends Widget {
  getId() { return "status-context"; }
  
  render() {
    const usage = this.ctx.getContextUsage();
    if (!usage) return null;
    
    const tokens = `${Math.round(usage.tokens / 1000)}k`;
    const percent = `${Math.round(usage.percent)}%`;
    
    return [`${tokens} (${percent})`];
  }
}

class ProjectWidget extends Widget {
  getId() { return "status-project"; }
  getPlacement() { return "belowEditor"; }
  
  render() {
    const project = this.ctx.cwd?.split("/").pop() ?? "root";
    return [`📁 ${project}`];
  }
}

class GitWidget extends Widget {
  getId() { return "status-git"; }
  getPlacement() { return "belowEditor"; }
  
  render() {
    try {
      const branch = execSync("git rev-parse --abbrev-ref HEAD", {
        encoding: "utf8",
      }).trim();
      return [`🌿 ${branch}`];
    } catch {
      return null;  // no git, don't show
    }
  }
}

// ============================================================================
// WIDGET REGISTRY/MANAGER
// ============================================================================

class WidgetManager {
  constructor(pi, ctx, model) {
    this.pi = pi;
    this.ctx = ctx;
    this.model = model;
    this.widgets = [];
    
    // Register all widgets
    this.register(ProviderWidget);
    this.register(ContextWidget);
    this.register(ProjectWidget);
    this.register(GitWidget);
  }
  
  register(WidgetClass) {
    const widget = new WidgetClass(this.pi, this.ctx, this.model);
    this.widgets.push(widget);
  }
  
  updateAll() {
    this.widgets.forEach(w => w.update());
  }
  
  add(WidgetClass) {
    this.register(WidgetClass);
    const widget = this.widgets[this.widgets.length - 1];
    widget.update();
  }
  
  remove(widgetId) {
    this.widgets = this.widgets.filter(w => w.getId() !== widgetId);
    this.ctx.ui.setWidget(widgetId, undefined);
  }
}

// ============================================================================
// EXTENSION
// ============================================================================

export default function (pi) {
  let manager = null;
  
  pi.on("session_start", (_, ctx) => {
    if (ctx.model) {
      manager = new WidgetManager(pi, ctx, ctx.model);
      manager.updateAll();
    }
  });
  
  pi.on("model_select", (event, ctx) => {
    manager = new WidgetManager(pi, ctx, event.model);
    manager.updateAll();
  });
  
  pi.on("turn_end", (_, ctx) => {
    if (manager) manager.updateAll();
  });
  
  // Allow dynamic widget addition
  pi.registerCommand("add-widget", {
    description: "Add a new widget",
    handler: async (args, ctx) => {
      // Example: add custom widget
      class TimestampWidget extends Widget {
        getId() { return "status-timestamp"; }
        render() {
          const time = new Date().toLocaleTimeString();
          return [`🕐 ${time}`];
        }
      }
      
      manager.add(TimestampWidget);
      ctx.ui.notify("Widget added!", "info");
    },
  });
}
```

**Advantages:**
- ✅ Ultra flexible - add/remove widgets dynamically
- ✅ Scales well - easy to add 10+ widgets
- ✅ Each widget is independent
- ✅ Registry pattern - professional architecture

---

## Comparison: Which Approach to Use?

| Approach | Complexity | Flexibility | Best For |
|----------|-----------|-------------|----------|
| **1. Simple Class** | ⭐ Low | ⭐ Low | Small extensions |
| **2. Multiple Classes** | ⭐⭐ Medium | ⭐⭐ Medium | Medium extensions |
| **3. Inheritance** | ⭐⭐ Medium | ⭐⭐ Medium | Similar widgets |
| **4. Registry** | ⭐⭐⭐ High | ⭐⭐⭐ High | Complex/growing |

---

## Practical Tips for Using Classes

### 1. Use Getters for Computed Properties

```javascript
class Widget {
  get tokenUsage() {
    const usage = this.ctx.getContextUsage();
    return usage ? `${Math.round(usage.tokens / 1000)}k` : "0k";
  }
  
  render() {
    return [`Tokens: ${this.tokenUsage}`];  // Clean!
  }
}
```

### 2. Group Related Methods

```javascript
class Widget {
  // Data extraction
  get projectName() { ... }
  get gitBranch() { ... }
  
  // Rendering
  renderProject() { ... }
  renderGit() { ... }
  
  // Layout
  getContent() { ... }
  update() { ... }
}
```

### 3. Use Static Methods for Utilities

```javascript
class Git {
  static getBranch() {
    try {
      return execSync("git rev-parse --abbrev-ref HEAD", {
        encoding: "utf8",
      }).trim();
    } catch {
      return "no-git";
    }
  }
}

// Use anywhere:
const branch = Git.getBranch();
```

### 4. Use Private Fields for Hidden Data

```javascript
class SecretWidget {
  #apiKey = "secret";
  
  get safe() {
    return "no key here";  // Can't access #apiKey from outside
  }
}
```

### 5. Chain Methods for Fluent API

```javascript
class Query {
  constructor() {
    this.query = {};
  }
  
  where(field, value) {
    this.query.where = { field, value };
    return this;  // return this!
  }
  
  limit(n) {
    this.query.limit = n;
    return this;  // chain!
  }
  
  build() {
    return this.query;
  }
}

// Usage:
const q = new Query()
  .where("name", "John")
  .limit(10)
  .build();
```

---

## Summary: Classes vs Functions

### Functions (Your Current Code)
```javascript
function getGitBranch() { ... }
function renderGitWidget() { ... }
function getTopWidgetContent() { ... }
```

**Pros:** Simple, lightweight
**Cons:** Scattered logic, hard to manage state

### Classes (New Approach)
```javascript
class StatusWidget {
  get gitBranch() { ... }
  renderGit() { ... }
  getTopWidget() { ... }
}
```

**Pros:** Organized, manageable state, reusable
**Cons:** More boilerplate (but worth it!)

---

## Next Steps

1. **Start with Approach 1** (Simple Class) - easy to understand
2. **Graduate to Approach 2** (Multiple Classes) - when code grows
3. **Use Approach 4** (Registry) - when you need flexibility

**Try it:**
Copy one of the approaches above and test it with `/reload` in pi!

---

## Recommended: Start Here!

Here's a simplified version to get you started:

```javascript
class Status {
  constructor(pi, ctx, model) {
    this.pi = pi;
    this.ctx = ctx;
    this.model = model;
  }
  
  getTopWidget() {
    const provider = this.pi ? "✅ Provider" : "";
    return [provider];
  }
  
  getBottomWidget() {
    const project = this.ctx.cwd?.split("/").pop() ?? "root";
    return [`📁 ${project}`];
  }
  
  update() {
    this.ctx.ui.setWidget("top", this.getTopWidget(), {
      placement: "aboveEditor",
    });
    this.ctx.ui.setWidget("bottom", this.getBottomWidget(), {
      placement: "belowEditor",
    });
  }
}

export default function (pi) {
  let status = null;
  
  pi.on("session_start", (_, ctx) => {
    status = new Status(pi, ctx, ctx.model);
    status.update();
  });
  
  pi.on("turn_end", (_, ctx) => {
    if (status) status.update();
  });
}
```

Done! Simple, clean, class-based! 🎉
