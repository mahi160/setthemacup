# JavaScript Classes Learning Path - Your Status Extension

A complete guide to learning and using classes in your status extension.

---

## 📚 Files to Read (In Order)

### 1. **JAVASCRIPT_CLASSES_GUIDE.md** (Essential!)
   **Read first!** Learn the fundamentals.
   
   Topics covered:
   - What is a class?
   - Constructor & properties
   - Methods & getters/setters
   - Static methods
   - Inheritance
   - Private fields
   - Real-world examples

   ⏱️ **Time:** 20-30 minutes

### 2. **STATUS_EXTENSION_WITH_CLASSES.md** (Apply!)
   See 4 different approaches to refactor your status extension.
   
   Approaches:
   1. Simple Class (recommended for beginners)
   2. Multiple Classes (more organized)
   3. Inheritance Pattern (reusable widgets)
   4. Registry Pattern (professional/scalable)

   ⏱️ **Time:** 15-20 minutes

### 3. **STATUS_CLASS_EXTENSIONS.md** (Practice!)
   12 real-world examples of extending the class.
   
   Examples:
   - Add timestamp
   - Hide widgets conditionally
   - Show environment variables
   - Cache git branch
   - Show git status (dirty/clean)
   - Extend with inheritance
   - Multi-line widgets
   - Toggle with commands
   - Color-coding
   - Activity indicator
   - Filter providers
   - Custom formatting

   ⏱️ **Time:** 10-15 minutes (skim examples)

### 4. **status-classes.js** (See it in action!)
   A working class-based version of your status extension.
   
   This is the "Simple Class" approach from file #2.
   Ready to deploy!

   ⏱️ **Time:** 5 minutes (read code)

---

## 🎯 Quick Start (30 minutes)

### Step 1: Understand Classes (10 min)
Read the first 2 sections of `JAVASCRIPT_CLASSES_GUIDE.md`:
- What is a Class?
- Basic Class Syntax

### Step 2: See Examples (10 min)
Read the "Simple Class Approach" in `STATUS_EXTENSION_WITH_CLASSES.md`

### Step 3: Try It (10 min)
Copy `status-classes.js` and test:
```bash
cp status-classes.js ~/.pi/agent/extensions/
# Then in pi: /reload
```

---

## 📊 Learning Progression

```
Level 1: Basics (20 min)
├─ What is a class?
├─ Constructor & properties
├─ Methods
└─ Creating instances

Level 2: Features (15 min)
├─ Getters & setters
├─ Static methods
└─ Private fields

Level 3: Advanced (15 min)
├─ Inheritance
├─ super() keyword
└─ Method overriding

Level 4: Application (30 min)
├─ Apply to status extension
├─ See 4 different approaches
└─ Practice 12 examples
```

---

## 💡 Why Classes for Your Status Extension?

### Before (Functions)
```javascript
function getGitBranch() { ... }
function renderGitWidget() { ... }
function updateWidget() { ... }

// Problem: State is scattered, hard to manage
```

### After (Classes)
```javascript
class StatusWidget {
  get gitBranch() { ... }
  renderGit() { ... }
  update() { ... }
  
  // Benefit: All related code in one place!
}
```

### Key Benefits

| Aspect | Function | Class |
|--------|----------|-------|
| Organization | Scattered | Grouped |
| State | Global | Instance-based |
| Reusability | Hard | Easy (inheritance) |
| Maintainability | Medium | High |
| Extensibility | Difficult | Trivial |
| Testing | Can be hard | Easy (mock instance) |

---

## 🔄 Refactoring Process

### Your Current Code (Functional)
```javascript
// 273 lines, 6 separate layers
function getGitBranch() { ... }
function renderGitWidget() { ... }
function getBottomWidgetContent() { ... }
function updateAllWidgets() { ... }
// ... etc
```

### Refactored with Classes
```javascript
// 200 lines, organized class
class StatusWidget {
  get gitBranch() { ... }
  renderGit() { ... }
  getBottomWidget() { ... }
  update() { ... }
}
```

### Benefits
- ✅ Less boilerplate
- ✅ Cleaner code
- ✅ Easier to understand
- ✅ Easier to extend

---

## 🎓 Practical Example

### Problem: Add a Timestamp Widget

**Without Classes (Harder):**
```javascript
function getTimestamp() {
  return new Date().toLocaleTimeString();
}

function renderTimestamp() {
  const timestamp = getTimestamp();
  return `🕐 ${timestamp}`;
}

function getTopWidgetContent(model, pi, ctx) {
  // ... existing code
  const timestamp = renderTimestamp();
  // ... modify existing return
}

function formatLine({ pi, ctx, model }) {
  // ... modify complex function
}
```

**With Classes (Easier):**
```javascript
class StatusWidget {
  get timestamp() {
    return new Date().toLocaleTimeString();
  }
  
  renderTimestamp() {
    return `🕐 ${this.timestamp}`;
  }
  
  getTopWidget() {
    const provider = this.renderProvider();
    const timestamp = this.renderTimestamp();
    return [provider + ` | ${timestamp}`];
  }
}
```

---

## 📋 Common Class Patterns

### Pattern 1: Simple Class
```javascript
class Widget {
  constructor(pi, ctx, model) {
    this.pi = pi;
    this.ctx = ctx;
    this.model = model;
  }
  
  get data() { return "value"; }
  render() { return this.data; }
  update() { /* set in UI */ }
}
```

### Pattern 2: Inheritance
```javascript
class BaseWidget {
  render() { throw new Error("override me"); }
}

class MyWidget extends BaseWidget {
  render() { return "my content"; }
}
```

### Pattern 3: Composition
```javascript
class Container {
  constructor(widget1, widget2) {
    this.widgets = [widget1, widget2];
  }
  
  updateAll() {
    this.widgets.forEach(w => w.update());
  }
}
```

### Pattern 4: Static Methods (Utilities)
```javascript
class Git {
  static getBranch() { /* execute git */ }
  static getStatus() { /* check dirty */ }
}

// Usage: Git.getBranch()
```

---

## ✅ Checklist: Ready to Use Classes?

- [ ] Read `JAVASCRIPT_CLASSES_GUIDE.md` (sections 1-2)
- [ ] Understand constructors and methods
- [ ] Read `STATUS_EXTENSION_WITH_CLASSES.md` (Simple Class approach)
- [ ] Look at `status-classes.js`
- [ ] Copy and try it with `/reload`
- [ ] Read one extension example from `STATUS_CLASS_EXTENSIONS.md`
- [ ] Modify one example and test
- [ ] Try creating your own class-based widget

---

## 🚀 Next Steps

### Quick Path (30 min)
1. Read classes basics (10 min)
2. Read simple class approach (5 min)
3. Copy and test `status-classes.js` (10 min)
4. Try one example (5 min)

### Deep Path (2 hours)
1. Read all class fundamentals (30 min)
2. Read all 4 approaches (30 min)
3. Copy `status-classes.js` and understand it (20 min)
4. Try 5 examples from extensions file (30 min)
5. Create your own custom widget (10 min)

### Expert Path (3+ hours)
1. Complete deep path
2. Read and understand all approaches
3. Try all 12 examples
4. Build your own multi-widget system
5. Learn advanced patterns (factory, singleton, etc.)

---

## 🎯 Your Goal

By the end, you should be able to:

1. **Understand Classes**
   - [ ] What is a class and why use it?
   - [ ] How to write a basic class
   - [ ] How to create instances

2. **Apply to Status Extension**
   - [ ] Convert functions to methods
   - [ ] Use getters for computed properties
   - [ ] Bundle state in constructor

3. **Extend Classes**
   - [ ] Override methods
   - [ ] Add new getters
   - [ ] Use inheritance with `extends`

4. **Customize for Your Needs**
   - [ ] Add new widgets
   - [ ] Hide/show conditionally
   - [ ] Optimize performance

---

## 📖 File Summary

| File | Purpose | Time | Level |
|------|---------|------|-------|
| `JAVASCRIPT_CLASSES_GUIDE.md` | Learn basics | 30 min | Beginner |
| `STATUS_EXTENSION_WITH_CLASSES.md` | See approaches | 20 min | Beginner |
| `STATUS_CLASS_EXTENSIONS.md` | Practice examples | 30 min | Intermediate |
| `status-classes.js` | Working code | 5 min | Beginner |
| `CLASS_LEARNING_PATH.md` | This file | 10 min | Guide |

---

## 🎓 Key Concepts to Remember

### Classes are Blueprints
```javascript
class Cookie {
  constructor(flavor) {
    this.flavor = flavor;
  }
}

const c1 = new Cookie("chocolate");
const c2 = new Cookie("vanilla");
// Two different instances, same blueprint
```

### `this` refers to the instance
```javascript
class Dog {
  constructor(name) {
    this.name = name;  // Property of this instance
  }
  
  bark() {
    console.log(`${this.name} barks`);  // this.name = name of this dog
  }
}

const dog1 = new Dog("Rex");
const dog2 = new Dog("Buddy");

dog1.bark();  // Rex barks (this = dog1)
dog2.bark();  // Buddy barks (this = dog2)
```

### Methods have access to properties
```javascript
class Calculator {
  constructor(initial) {
    this.value = initial;
  }
  
  add(x) {
    this.value += x;  // Can access this.value
    return this;
  }
  
  multiply(x) {
    this.value *= x;
    return this;  // Return this for chaining
  }
}

const calc = new Calculator(5);
calc.add(3).multiply(2).add(1);  // Method chaining!
```

---

## 🎯 Recommended Path for You

1. **Day 1:** Learn (30 min)
   - Read `JAVASCRIPT_CLASSES_GUIDE.md` (sections 1-3)
   - Read simple class approach in `STATUS_EXTENSION_WITH_CLASSES.md`

2. **Day 2:** Try (1 hour)
   - Copy `status-classes.js`
   - Test with `pi`
   - Try 1-2 examples from extensions file

3. **Day 3:** Build (1 hour)
   - Try 5-10 examples
   - Customize one for your needs
   - Build confidence

4. **Day 4+:** Master (ongoing)
   - Try inheritance approach
   - Try registry pattern
   - Build multi-widget systems

---

## 💬 Common Questions

**Q: Do I have to use classes?**
A: No! Functions work fine. But classes are cleaner for complex code.

**Q: Is it hard to learn?**
A: No! If you understand functions, classes are just organized functions.

**Q: Can I mix functions and classes?**
A: Yes! Start with functions, add classes when beneficial.

**Q: What's the difference from your current code?**
A: Just organization. Same functionality, cleaner structure.

**Q: Do I need to refactor everything?**
A: No! You can gradually convert pieces to classes.

**Q: How do I know when to use classes?**
A: When you have related data and functions that work together.

---

## 🏁 Get Started!

### Quickest Path (Ready now?)
1. Skip to `status-classes.js`
2. Copy it to `~/.pi/agent/extensions/`
3. Use `/reload` in pi
4. See it work!

### Learning Path (Want to understand?)
1. Start with `JAVASCRIPT_CLASSES_GUIDE.md`
2. Read sections 1-3
3. Then look at `status-classes.js`
4. Compare function version to class version

### Expert Path (Go deep?)
1. Read all 4 files in order
2. Try all 12 examples
3. Create your own widgets
4. Build a professional system

---

**Choose your path and get started! 🚀**

Questions? Check the relevant file above.
