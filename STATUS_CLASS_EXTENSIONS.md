# Status Extension with Classes - Practical Examples

Learn how to extend the `StatusWidget` class with real-world examples.

---

## Example 1: Add Timestamp Widget

Add the current time to the top widget.

```javascript
import { execSync } from "node:child_process";

class StatusWidget {
  // ... (original code)
  
  get timestamp() {
    return new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
  
  renderTimestamp() {
    return `🕐 ${this.timestamp}`;
  }
  
  getTopWidget() {
    const provider = this.renderProvider();
    const context = this.renderContext();
    const timestamp = this.renderTimestamp();
    
    return [
      provider + 
      (context ? ` | ${context}` : "") + 
      ` | ${timestamp}`
    ];
  }
}

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
    if (widget) widget.update();
  });
}
```

---

## Example 2: Hide Widget Conditionally

Hide the git widget if not in a git repo.

```javascript
class StatusWidget {
  // ... (original code)
  
  getBottomWidget() {
    const project = this.renderProject();
    const git = this.renderGit();
    const tools = this.renderTools();
    
    // Only show git if it's not "no-git"
    const gitDisplay = git === "no-git" ? "" : `| ${git}`;
    
    return [` | ${project} ${gitDisplay} | ${tools}`];
  }
}
```

---

## Example 3: Add Environment Display

Show NODE_ENV or other environment variables.

```javascript
class StatusWidget {
  // ... (original code)
  
  get environment() {
    return process.env.NODE_ENV || "development";
  }
  
  renderEnvironment() {
    const env = this.environment;
    const icon = env === "production" ? "🔒" : "🚀";
    return `${icon} ${env}`;
  }
  
  getTopWidget() {
    const provider = this.renderProvider();
    const context = this.renderContext();
    const env = this.renderEnvironment();
    
    return [
      provider + 
      (context ? ` | ${context}` : "") + 
      ` | ${env}`
    ];
  }
}
```

---

## Example 4: Cache Git Branch (Performance)

Cache git branch result to avoid `execSync` overhead.

```javascript
class StatusWidget {
  // Private field (only accessible inside the class)
  #gitBranchCache = null;
  #gitBranchCacheTime = 0;
  #CACHE_TTL = 5000; // 5 seconds
  
  get gitBranch() {
    const now = Date.now();
    
    // Return cached value if still fresh
    if (
      this.#gitBranchCache !== null &&
      now - this.#gitBranchCacheTime < this.#CACHE_TTL
    ) {
      return this.#gitBranchCache;
    }
    
    // Get fresh value
    try {
      const branch = execSync("git rev-parse --abbrev-ref HEAD", {
        encoding: "utf8",
      }).trim();
      
      this.#gitBranchCache = branch;
      this.#gitBranchCacheTime = now;
      
      return branch;
    } catch {
      this.#gitBranchCache = "no-git";
      this.#gitBranchCacheTime = now;
      return "no-git";
    }
  }
}
```

---

## Example 5: Git Status Widget (Dirty/Clean)

Show if git repo is dirty or clean.

```javascript
class StatusWidget {
  // ... (original code)
  
  getGitStatus() {
    try {
      const status = execSync("git status --porcelain", {
        encoding: "utf8",
        stdio: "pipe", // Capture output
      }).trim();
      
      if (!status) return { isDirty: false, count: 0 };
      
      const lines = status.split("\n");
      return { isDirty: true, count: lines.length };
    } catch {
      return { isDirty: false, count: 0 };
    }
  }
  
  renderGitStatus() {
    const { isDirty, count } = this.getGitStatus();
    if (!isDirty) return "✓ clean";
    return `⚠️  ${count} changes`;
  }
  
  getBottomWidget() {
    const project = this.renderProject();
    const git = this.renderGit();
    const gitStatus = this.renderGitStatus();
    const tools = this.renderTools();
    
    return [
      ` | ${project} | ${git} (${gitStatus}) | ${tools}`
    ];
  }
}
```

---

## Example 6: Extend with Inheritance

Create a subclass that extends StatusWidget.

```javascript
import { execSync } from "node:child_process";

class StatusWidget {
  // ... (all original code here)
}

// Extend StatusWidget to add new features
class EnhancedStatusWidget extends StatusWidget {
  // Add new getter
  get memoryUsage() {
    // Simplified example
    return "512MB";
  }
  
  renderMemory() {
    return `💾 ${this.memoryUsage}`;
  }
  
  // Override existing method to add memory display
  getTopWidget() {
    const original = super.getTopWidget()[0];
    const memory = this.renderMemory();
    return [original + ` | ${memory}`];
  }
  
  // Add new method
  getSystemStats() {
    return {
      memory: this.memoryUsage,
      timestamp: new Date().toLocaleTimeString(),
    };
  }
}

export default function (pi) {
  let widget = null;
  
  pi.on("session_start", (_, ctx) => {
    if (ctx.model) {
      // Use the enhanced class instead
      widget = new EnhancedStatusWidget(pi, ctx, ctx.model);
      widget.update();
    }
  });
  
  pi.on("model_select", (event, ctx) => {
    widget = new EnhancedStatusWidget(pi, ctx, event.model);
    widget.update();
  });
  
  pi.on("turn_end", (_, ctx) => {
    if (widget) widget.update();
  });
}
```

---

## Example 7: Multi-Line Widget

Display widgets across multiple lines.

```javascript
class StatusWidget {
  // ... (original code)
  
  getTopWidget() {
    const provider = this.renderProvider();
    const tokens = this.tokenUsage.tokens;
    const percent = this.tokenUsage.percent;
    const thinking = this.thinkingLevel;
    
    return [
      provider,
      `   └─ Tokens: ${tokens} (${percent}) | Thinking: ${thinking}`
    ];
  }
}
```

---

## Example 8: Toggle Widgets with Commands

Add/remove widgets dynamically using a command.

```javascript
class StatusWidget {
  // ... (original code)
  
  constructor(pi, ctx, model, options = {}) {
    this.pi = pi;
    this.ctx = ctx;
    this.model = model;
    this.showDetails = options.showDetails ?? false;
  }
  
  getTopWidget() {
    const provider = this.renderProvider();
    const context = this.renderContext();
    
    if (this.showDetails) {
      return [
        provider,
        `   └─ Context: ${context}`
      ];
    }
    
    return [provider + (context ? ` | ${context}` : "")];
  }
}

export default function (pi) {
  let widget = null;
  let showDetails = false;
  
  // Command to toggle details
  pi.registerCommand("toggle-status-details", {
    description: "Toggle detailed status info",
    handler: async (args, ctx) => {
      showDetails = !showDetails;
      
      if (widget) {
        widget.showDetails = showDetails;
        widget.update();
      }
      
      ctx.ui.notify(
        `Status details: ${showDetails ? "ON" : "OFF"}`,
        "info"
      );
    },
  });
  
  pi.on("session_start", (_, ctx) => {
    if (ctx.model) {
      widget = new StatusWidget(pi, ctx, ctx.model, {
        showDetails
      });
      widget.update();
    }
  });
  
  pi.on("model_select", (event, ctx) => {
    widget = new StatusWidget(pi, ctx, event.model, {
      showDetails
    });
    widget.update();
  });
  
  pi.on("turn_end", (_, ctx) => {
    if (widget) widget.update();
  });
}
```

---

## Example 9: Color-Coded Thinking Level

Use different colors based on thinking level.

```javascript
class StatusWidget {
  // ... (original code)
  
  getThinkingColor() {
    const colors = {
      off: "\x1b[38;5;8m",        // gray
      minimal: "\x1b[38;5;250m",  // light gray
      low: "\x1b[38;5;46m",       // green
      medium: "\x1b[38;5;226m",   // yellow
      high: "\x1b[38;5;208m",     // orange
      xhigh: "\x1b[38;5;196m",    // red
    };
    
    return colors[this.thinkingLevel] || colors.off;
  }
  
  renderProvider() {
    const { color, icon, name, modelName } = this.providerInfo;
    if (!modelName) return "";
    
    const thinkingColor = this.getThinkingColor();
    
    return (
      `${color}${icon} ${name}\x1b[0m` +
      ` | ${modelName} (${thinkingColor}${this.thinkingLevel}\x1b[0m)`
    );
  }
}
```

---

## Example 10: Activity Indicator

Show if the agent is working or idle.

```javascript
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let spinnerIndex = 0;

class StatusWidget {
  // ... (original code)
  
  get isIdle() {
    return this.ctx.isIdle?.() ?? false;
  }
  
  getActivityIndicator() {
    if (this.isIdle) return "✓ idle";
    
    const frame = SPINNER_FRAMES[spinnerIndex % SPINNER_FRAMES.length];
    spinnerIndex++;
    return `${frame} active`;
  }
  
  renderActivity() {
    return this.getActivityIndicator();
  }
  
  getTopWidget() {
    const provider = this.renderProvider();
    const context = this.renderContext();
    const activity = this.renderActivity();
    
    return [
      provider + 
      (context ? ` | ${context}` : "") + 
      ` | ${activity}`
    ];
  }
}

export default function (pi) {
  let widget = null;
  let spinnerInterval = null;
  
  pi.on("session_start", (_, ctx) => {
    if (ctx.model) {
      widget = new StatusWidget(pi, ctx, ctx.model);
      widget.update();
      
      // Update spinner every 100ms
      spinnerInterval = setInterval(() => {
        if (widget) widget.update();
      }, 100);
    }
  });
  
  pi.on("session_shutdown", () => {
    if (spinnerInterval) clearInterval(spinnerInterval);
  });
  
  pi.on("model_select", (event, ctx) => {
    widget = new StatusWidget(pi, ctx, event.model);
    widget.update();
  });
  
  pi.on("turn_end", (_, ctx) => {
    if (widget) widget.update();
  });
}
```

---

## Example 11: Filter Providers

Only show certain providers.

```javascript
class StatusWidget {
  // ... (original code)
  
  get providerInfo() {
    if (!this.model) return {};
    
    // Whitelist providers
    const allowedProviders = ["anthropic"];
    
    if (!allowedProviders.includes(this.model.provider)) {
      return {};
    }
    
    // ... rest of original code
  }
}
```

---

## Example 12: Custom Formatting

Create custom display formats.

```javascript
class StatusWidget {
  // ... (original code)
  
  formatTokens() {
    const { tokens: rawTokens } = this.tokenUsage;
    const tokens = parseInt(rawTokens);
    
    if (tokens > 100) {
      return `${rawTokens} 🔥`;
    } else if (tokens > 50) {
      return `${rawTokens} ⚠️`;
    } else {
      return `${rawTokens} ✓`;
    }
  }
  
  renderContext() {
    const tokens = this.formatTokens();
    const percent = this.tokenUsage.percent;
    return `${tokens} (${percent})`;
  }
}
```

---

## Comparison: Before and After

### Before (Functional)
```javascript
function getGitBranch() { ... }
function renderGitWidget() { ... }
function getBottomWidget() { ... }
function updateWidgets() { ... }
```

**Issues:**
- Functions scattered around
- Hard to pass state
- Hard to customize
- Hard to extend

### After (Class-Based)
```javascript
class StatusWidget {
  get gitBranch() { ... }
  renderGit() { ... }
  getBottomWidget() { ... }
  update() { ... }
  
  // Easy to extend:
  // class EnhancedStatus extends StatusWidget { ... }
}
```

**Benefits:**
- All related code in one place
- State is bundled with methods
- Easy to customize (override methods)
- Easy to extend (inheritance)

---

## Quick Checklist: How to Extend

✅ **Add a simple widget:**
```javascript
get newData() { return "value"; }
renderNewWidget() { return `${this.newData}`; }
```

✅ **Override existing widget:**
```javascript
renderGit() { return `custom git: ${super.renderGit()}`; }
```

✅ **Customize layout:**
```javascript
getTopWidget() {
  // Add/remove/reorder renderers
  return [...];
}
```

✅ **Add conditional logic:**
```javascript
get gitBranch() {
  const branch = super.gitBranch;
  if (branch === "main") return "⭐ main";
  return branch;
}
```

✅ **Use inheritance:**
```javascript
class MyStatus extends StatusWidget {
  // Override methods here
}
```

✅ **Cache expensive operations:**
```javascript
#cache = null;
get expensiveValue() {
  return this.#cache ??= this.compute();
}
```

---

## Summary

With classes, extending is as simple as:

1. **Add a getter** - `get newData() { ... }`
2. **Add a renderer** - `renderNew() { ... }`
3. **Update layout** - Add to `getTopWidget()` or `getBottomWidget()`
4. Done! Use `/reload` to apply.

Much simpler than before! 🎉
