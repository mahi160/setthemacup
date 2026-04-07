# JavaScript Classes - Complete Guide

## What is a Class?

A **class** is a blueprint for creating objects with **properties** (data) and **methods** (functions).

Think of it like a recipe:
- Recipe = Class (blueprint)
- Cookies = Objects (instances)

```javascript
class Cookie {
  constructor(flavor) {
    this.flavor = flavor;  // property
  }
  
  eat() {                  // method
    console.log(`Eating ${this.flavor} cookie`);
  }
}

const myCookie = new Cookie("chocolate");
myCookie.eat();  // Eating chocolate cookie
```

---

## Basic Class Syntax

### 1. Class Declaration

```javascript
class Person {
  constructor(name, age) {
    this.name = name;
    this.age = age;
  }
  
  greet() {
    console.log(`Hello, I'm ${this.name}`);
  }
}

const person = new Person("Alice", 30);
person.greet();  // Hello, I'm Alice
```

**Key points:**
- `constructor()` runs when you create a new instance with `new`
- `this` refers to the object instance
- Methods are defined inside the class (no `function` keyword needed)

### 2. Creating Instances

```javascript
const person1 = new Person("Alice", 30);
const person2 = new Person("Bob", 25);

console.log(person1.name);  // Alice
console.log(person2.name);  // Bob
```

---

## Class Features

### Properties (Data)

```javascript
class Car {
  constructor(brand, model) {
    this.brand = brand;      // property
    this.model = model;      // property
    this.speed = 0;          // initialized to 0
  }
}

const car = new Car("Toyota", "Camry");
console.log(car.brand);  // Toyota
car.speed = 100;         // can change properties
```

### Methods (Functions)

```javascript
class Calculator {
  add(a, b) {
    return a + b;
  }
  
  subtract(a, b) {
    return a - b;
  }
}

const calc = new Calculator();
console.log(calc.add(5, 3));       // 8
console.log(calc.subtract(10, 4)); // 6
```

### Access Methods from Methods

```javascript
class Dog {
  constructor(name) {
    this.name = name;
  }
  
  bark() {
    console.log(`${this.name} says woof!`);
  }
  
  greet() {
    this.bark();  // call another method
    console.log(`Hello, I'm ${this.name}`);
  }
}

const dog = new Dog("Rex");
dog.greet();
// Rex says woof!
// Hello, I'm Rex
```

---

## Getters and Setters

### Getters (read properties)

```javascript
class Person {
  constructor(firstName, lastName) {
    this.firstName = firstName;
    this.lastName = lastName;
  }
  
  get fullName() {  // getter (like a computed property)
    return `${this.firstName} ${this.lastName}`;
  }
}

const person = new Person("John", "Doe");
console.log(person.fullName);  // John Doe (no parentheses!)
```

### Setters (write properties)

```javascript
class Temperature {
  constructor(celsius) {
    this._celsius = celsius;  // underscore = private convention
  }
  
  get celsius() {
    return this._celsius;
  }
  
  get fahrenheit() {
    return (this._celsius * 9/5) + 32;
  }
  
  set celsius(value) {
    this._celsius = value;
  }
}

const temp = new Temperature(0);
console.log(temp.celsius);     // 0
console.log(temp.fahrenheit);  // 32

temp.celsius = 25;
console.log(temp.fahrenheit);  // 77
```

---

## Static Methods

Static methods belong to the **class itself**, not instances.

```javascript
class Math2 {
  static add(a, b) {
    return a + b;
  }
  
  static multiply(a, b) {
    return a * b;
  }
}

console.log(Math2.add(5, 3));      // 8 (no instance needed)
console.log(Math2.multiply(4, 2)); // 8

// Can't call on instance:
// const m = new Math2();
// m.add(5, 3);  // ERROR!
```

### Use Case: Utility Functions

```javascript
class DateUtils {
  static isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }
  
  static daysSince(date) {
    const now = new Date();
    const diff = now - date;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
}

const someDate = new Date("2024-01-01");
console.log(DateUtils.isToday(someDate));  // false
console.log(DateUtils.daysSince(someDate)); // 96 (or whatever)
```

---

## Inheritance (extends)

Extend a class to inherit its properties and methods.

```javascript
class Animal {
  constructor(name) {
    this.name = name;
  }
  
  speak() {
    console.log(`${this.name} makes a sound`);
  }
}

class Dog extends Animal {
  speak() {
    console.log(`${this.name} barks`);
  }
  
  fetch() {
    console.log(`${this.name} fetches the ball`);
  }
}

const dog = new Dog("Rex");
dog.speak();   // Rex barks (overridden)
dog.fetch();   // Rex fetches the ball (new method)
```

### Using super() to call parent methods

```javascript
class Animal {
  constructor(name) {
    this.name = name;
  }
  
  speak() {
    console.log(`${this.name} makes a sound`);
  }
}

class Dog extends Animal {
  constructor(name, breed) {
    super(name);        // call parent constructor
    this.breed = breed;
  }
  
  speak() {
    super.speak();      // call parent method
    console.log(`${this.name} barks`);
  }
}

const dog = new Dog("Rex", "Labrador");
dog.speak();
// Rex makes a sound
// Rex barks
```

---

## Private Fields (Modern JS)

Use `#` prefix for truly private properties.

```javascript
class BankAccount {
  #balance = 0;  // private field
  
  constructor(initialBalance) {
    this.#balance = initialBalance;
  }
  
  deposit(amount) {
    this.#balance += amount;
  }
  
  getBalance() {
    return this.#balance;
  }
}

const account = new BankAccount(1000);
account.deposit(500);
console.log(account.getBalance());  // 1500
console.log(account.#balance);      // ERROR! Can't access private field
```

---

## Comparing: Functions vs Classes

### Function Style (old)
```javascript
function Widget(name) {
  this.name = name;
}

Widget.prototype.render = function() {
  console.log(`Rendering ${this.name}`);
};

const w = new Widget("MyWidget");
w.render();
```

### Class Style (modern)
```javascript
class Widget {
  constructor(name) {
    this.name = name;
  }
  
  render() {
    console.log(`Rendering ${this.name}`);
  }
}

const w = new Widget("MyWidget");
w.render();
```

**Class style is:**
- Cleaner and easier to read
- More familiar if you know Java/Python
- Recommended for new code

---

## Real-World Example

```javascript
class User {
  constructor(email, password) {
    this.email = email;
    this.#password = password;  // private
    this.createdAt = new Date();
  }
  
  #password;  // declare private field
  
  login(password) {
    return this.#password === password;
  }
  
  changePassword(oldPassword, newPassword) {
    if (this.login(oldPassword)) {
      this.#password = newPassword;
      return true;
    }
    return false;
  }
  
  get age() {
    const now = new Date();
    const diff = now - this.createdAt;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
  
  static isValidEmail(email) {
    return email.includes("@");
  }
}

const user = new User("john@example.com", "secret");
console.log(user.login("secret"));        // true
console.log(user.login("wrong"));         // false
console.log(user.age);                    // 0 (created today)
console.log(User.isValidEmail("john@..."));  // true
```

---

## Summary

| Feature | Example | Use |
|---------|---------|-----|
| Constructor | `constructor(name) { this.name = name; }` | Initialize object |
| Properties | `this.name` | Store data |
| Methods | `greet() { ... }` | Define behavior |
| Getters | `get age() { ... }` | Read computed value |
| Setters | `set age(val) { ... }` | Write computed value |
| Static | `static create() { ... }` | Utility functions |
| Inheritance | `class Dog extends Animal` | Reuse code |
| Private Fields | `#password` | Hide implementation |
| super | `super.speak()` | Call parent method |

---

## Common Patterns

### Factory Pattern
```javascript
class User {
  static create(email) {
    return new User(email);
  }
}

const user = User.create("john@example.com");
```

### Singleton Pattern (only one instance)
```javascript
class Database {
  static #instance = null;
  
  static getInstance() {
    if (this.#instance === null) {
      this.#instance = new Database();
    }
    return this.#instance;
  }
}

const db1 = Database.getInstance();
const db2 = Database.getInstance();
console.log(db1 === db2);  // true (same instance)
```

### Builder Pattern
```javascript
class QueryBuilder {
  constructor() {
    this.query = {};
  }
  
  where(field, value) {
    this.query.where = { field, value };
    return this;  // return this for chaining
  }
  
  limit(n) {
    this.query.limit = n;
    return this;
  }
  
  build() {
    return this.query;
  }
}

const q = new QueryBuilder()
  .where("age", 25)
  .limit(10)
  .build();
```

---

## Now Let's Apply This to Your Status Extension! 👇

See the next file: `STATUS_EXTENSION_WITH_CLASSES.md`
