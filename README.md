# Reactify

Reactify is a simplified implementation of React, built from scratch to understand and master the core concepts of React by reimplementing its fundamental features. This project serves as a learning tool to delve deep into how React works under the hood, focusing on key aspects like the reconciliation algorithm, the fiber architecture, hooks, and concurrent rendering.

## Table of Contents

- [Introduction](#introduction)
- [What I Learned and Achieved](#what-i-learned-and-achieved)
  - [Reconciliation Logic](#reconciliation-logic)
  - [The Three Trees](#the-three-trees)
    - [React Element Tree](#react-element-tree)
    - [Fiber Tree](#fiber-tree)
    - [DOM Tree](#dom-tree)
  - [Rendering Lifecycle](#rendering-lifecycle)
  - [Concurrent Mode and the Commit Phase](#concurrent-mode-and-the-commit-phase)
  - [`useState` Hook Implementation](#usestate-hook-implementation)
- [Limitations of Reactify](#limitations-of-reactify)
  - [Key Prop Handling](#key-prop-handling)
  - [Other Hooks](#other-hooks)
  - [Advanced Features](#advanced-features)
- [Setup and Usage](#setup-and-usage)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Project](#running-the-project)
- [Conclusion](#conclusion)

## Introduction

The motivation behind building Reactify was to gain a deeper understanding of React by reimplementing its core functionalities. By constructing a simplified version of React, I aimed to:

- **Master React Concepts**: Reinforce my knowledge of React's architecture and inner workings.
- **Understand Reconciliation**: Learn how React efficiently updates the DOM by reconciling changes.
- **Explore Fiber Architecture**: Dive into React's fiber architecture and understand how it improves performance.
- **Implement Hooks**: Get hands-on experience with implementing hooks like `useState`.
- **Experience Concurrent Rendering**: Understand how React schedules rendering work without blocking the browser.

Reactify serves as a foundation for experimenting with React's concepts and provides insights into building a UI library from the ground up.

## What I Learned and Achieved

### Reconciliation Logic

One of the key learnings was the implementation of the **reconciliation algorithm**. React's reconciliation process determines how the UI should update in response to changes in state or props. By reimplementing this logic, I learned:

- **Diffing Algorithms**: How to compare the previous and next virtual DOM trees to identify changes.
- **Efficient Updates**: Strategies for updating only the parts of the DOM that have changed.
- **Effect Tags**: Using effect tags like `"PLACEMENT"`, `"UPDATE"`, and `"DELETION"` to manage DOM updates.

### The Three Trees

Understanding the interaction between the different trees in React was crucial. Reactify works with three primary trees:

#### React Element Tree

- **Definition**: A plain JavaScript object representation of the UI structure created using `createElement`.
- **Purpose**: Serves as the blueprint for what needs to be rendered.
- **Implementation**: Constructed every time the render function is called.

#### Fiber Tree

- **Definition**: A tree of fiber nodes representing units of work for rendering and reconciliation.
- **Purpose**: Enables React to pause and resume work, making rendering asynchronous and efficient.
- **Implementation**:
  - Each fiber node contains information about the component, its state, props, and effects.
  - Fibers are linked via `child`, `sibling`, and `parentFiber` pointers.

#### DOM Tree

- **Definition**: The actual rendered UI in the browser.
- **Purpose**: Reflects the current state of the UI as seen by the user.
- **Implementation**:
  - Fiber nodes with changes lead to updates in the DOM tree.
  - Efficient updates are applied to minimize reflows and repaints.

### Rendering Lifecycle

Implementing the rendering lifecycle involved:

- **Creating DOM Elements**: Translating fiber nodes into actual DOM nodes.
- **Work Loop**: Managing units of work with `requestIdleCallback` to render updates during idle periods.
- **Commit Phase**: Applying changes to the DOM after reconciliation is complete.
- **Scheduling Updates**: Triggering re-renders when state changes occur.

### Concurrent Mode and the Commit Phase

A significant aspect of Reactify is its implementation of a simplified version of **Concurrent Mode** and the **Commit Phase**, inspired by React's approach to non-blocking rendering.

#### Concurrent Mode

- **Purpose**: Allows Reactify to perform rendering work without blocking the main thread, ensuring that the browser remains responsive for user interactions, animations, and other high-priority tasks.
- **Implementation**:
  - **Unit of Work**: The rendering work is broken down into small units called "fibers."
  - **Work Loop**: Uses `requestIdleCallback` to schedule and perform work during the browser's idle time.
    - The `workLoop` function checks the time remaining and processes fibers accordingly.
    - This prevents long-running tasks from blocking the main thread.
  - **Non-blocking Rendering**: By yielding control back to the browser when necessary, Reactify ensures smooth animations and interactions.

```javascript
private static workLoop(deadline: { timeRemaining: () => number }) {
  Reactify.logInfo("Starting work loop");
  while (Reactify.nextUnitOfWork && deadline.timeRemaining() > 0) {
    Reactify.logInfo("Performing unit of work:", Reactify.nextUnitOfWork);
    Reactify.performUnitOfWork();
  }
  if (Reactify.nextUnitOfWork) {
    requestIdleCallback((deadline) => Reactify.workLoop(deadline));
  } else if (Reactify.workInProgressRoot) {
    Reactify.commitRoot();
  }
}
```

- **Benefits**:
  - **Responsiveness**: The UI remains responsive to user input.
  - **Efficiency**: Rendering work is done efficiently without unnecessary blocking.

#### Commit Phase

- **Purpose**: The phase where all the changes calculated during reconciliation are applied to the DOM in a single, atomic operation.
- **Implementation**:
  - **Collecting Effects**: During the render phase, fibers are marked with effect tags indicating what changes need to be made.
  - **Applying Changes**: The `commitRoot` function processes all the changes in one go, ensuring the UI updates are consistent.
  - **Atomic Updates**: By committing all changes at once, Reactify avoids intermediate states that could cause visual glitches.

```javascript
private static commitRoot() {
  Reactify.logInfo("Committing changes to root...");
  // Process deletions
  Reactify.deletions.forEach((fiber) => {
    let domParentFiber = fiber.parentFiber;
    while (domParentFiber && !domParentFiber.currentDomElement) {
      domParentFiber = domParentFiber.parentFiber!;
    }
    if (domParentFiber && domParentFiber.currentDomElement) {
      Reactify.commitDeletion(fiber, domParentFiber.currentDomElement as HTMLElement);
    }
  });
  // Commit work
  if (Reactify.workInProgressRoot && Reactify.workInProgressRoot.child) {
    Reactify.commitWork(Reactify.workInProgressRoot.child);
    Reactify.currentRoot = Reactify.workInProgressRoot;
    Reactify.workInProgressRoot = null;
  }
}
```

- **Ensuring Consistency**: The commit phase ensures that all DOM updates are applied together, preventing inconsistencies and partial updates.
- **Handling Deletions, Updates, and Placements**: The commit functions handle different types of changes based on the effect tags.

#### Importance in Reactify

- **Learning Outcome**: Implementing concurrent rendering and the commit phase provided insights into how React manages rendering work efficiently.
- **Understanding Prioritization**: Recognized how React can prioritize certain updates over others, improving user experience.
- **Avoiding Blocking**: Ensured that Reactify's rendering process does not block the browser's main thread, keeping the application responsive.

### `useState` Hook Implementation

The `useState` hook was implemented to manage state within functional components:

- **State Management**: Each fiber node maintains its own state via hooks.
- **Hook Queue**: Updates are queued and processed during rendering.
- **Preserving State**: The `alternate` fiber allows state to persist between renders.
  Example Implementation:

```javascript
static useState(initialValue: any) {
  const fiber = Reactify.nextUnitOfWork;
  // Initialize hooks
  fiber.hooks = fiber.hooks || [];
  fiber.hookIndex = fiber.hookIndex || 0;
  const hookIndex = fiber.hookIndex;
  const oldHook = fiber.alternate?.hooks?.[hookIndex];
  const hook = oldHook || { state: initialValue, queue: [] };
  // Process queued actions
  hook.queue.forEach((action: Function) => {
    hook.state = action(hook.state);
  });
  hook.queue = [];
  const setState = (action: Function | any) => {
    const newAction = typeof action === "function" ? action : () => action;
    hook.queue.push(newAction);
    Reactify.scheduleRender(fiber);
  };
  fiber.hooks[hookIndex] = hook;
  fiber.hookIndex++;
  return [hook.state, setState];
}
```

## Limitations of Reactify

While Reactify achieves a basic implementation of React's core features, it has several limitations:

### Key Prop Handling

- **Issue**: Reactify does not fully implement key prop handling in reconciliation.
- **Impact**:
  - When components are added or removed from the middle of a list, state may not persist correctly.
  - Components may not update as expected without unique keys.
- **Understanding**: Recognizing the importance of keys in React for list reconciliation and state preservation.
- **Decision**: For learning purposes, the focus was on understanding the core concepts rather than perfecting key handling.

### Other Hooks

- **Not Implemented**: Hooks like `useEffect`, `useContext`, `useReducer`, and others are not implemented.
- **Learning Opportunity**: Implementing these hooks would provide deeper insights into React's capabilities.

### Advanced Features

- **Lifecycle Methods**: Class component lifecycle methods are not supported.
- **Error Boundaries**: No handling for errors during rendering.
- **Context API**: There's no implementation for context to pass data through the component tree.
- **Portals and Suspense**: Advanced features like portals or suspense for code-splitting are not included.

## Setup and Usage

### Prerequisites

- **Node.js**: Ensure you have Node.js installed (version 14 or higher recommended).
- **NPM**: NPM comes with Node.js; make sure it's up to date.

### Installation

1. Clone the Repository
   ```
   git clone https://github.com/OmaralAnazi/Reactify.git
   ```
2. Navigate to the Project Directory
   ```
   cd reactify
   ```
3. Install Dependencies
   ```
   npm install
   ```

### Running the Project

1. Start the Development Server
   ```
   npm run dev
   ```
2. Open in Browser
   - Open your browser and navigate to http://localhost:5173 (or the port specified in your setup).
3. Explore
   - The application renders a simple UI with components `ComponentA`, `ComponentB`, and `ComponentC`.
   - Interact with the buttons to see state updates in action.

## Conclusion

Building Reactify was an enlightening experience that deepened my understanding of React's inner workings. By reimplementing key features, I gained practical knowledge of:

- **Concurrent Rendering**: How React schedules rendering work without blocking the browser, enhancing user experience.
- **Reconciliation and the Commit Phase**: How React efficiently updates the DOM in a consistent and performant manner.
- **Fiber Architecture**: Understanding how fibers enable React to pause and resume rendering work.
- **State Management with Hooks**: Implementing `useState` and recognizing how hooks manage state within components.

While Reactify has limitations and does not encompass all of React's features, it serves as a solid foundation for further exploration and learning. Future enhancements could include implementing additional hooks, improving reconciliation with key props, and adding support for more advanced React features.

**Note:** This project is intended for educational purposes and is not suitable for production use.
