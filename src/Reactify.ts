export type ReactifyElementType = keyof HTMLElementTagNameMap | "TEXT_ELEMENT" | Function;
export type FiberNodeElementType = keyof HTMLElementTagNameMap | "TEXT_ELEMENT" | Function;

export type ReactifyElement = {
  type: ReactifyElementType;
  props: Props;
};

export type Hook = {
  state: any;
  queue: Function[];
};

export type EffectTag = "UPDATE" | "PLACEMENT" | "DELETION";

export type Props = {
  [key: string]: any;
  children: ReactifyElement[];
};

export type FiberNode = {
  type: FiberNodeElementType;
  currentDomElement: HTMLElement | Text | null;
  parentFiber: FiberNode | null;
  child: FiberNode | null;
  sibling: FiberNode | null;
  alternate: FiberNode | null;
  effectTag: EffectTag;
  props: Props;
  hooks?: Hook[];
  hookIndex?: number;
};

export default class Reactify {
  private static workInProgressRoot: FiberNode | null;
  private static nextUnitOfWork: FiberNode | null;
  private static currentRoot: FiberNode | null;
  private static deletions: FiberNode[] = [];
  private static debugMode = false;

  static setDebugMode(enabled: boolean) {
    Reactify.debugMode = enabled;
    console.log(`[Reactify] Debug mode set to ${enabled ? "ON" : "OFF"}`);
  }

  private static logInfo(...args: any[]) {
    if (Reactify.debugMode) {
      console.log("[Reactify]", ...args);
    }
  }

  private static logWarning(...args: any[]) {
    console.warn("[Reactify]", ...args); // this should be displayed on the dev environment only...
  }

  private static logError(...args: any[]) {
    console.error("[Reactify]", ...args);
  }

  static createElement(
    type: ReactifyElementType,
    props: Props | null = null,
    ...children: (ReactifyElement | string)[]
  ): ReactifyElement {
    Reactify.logInfo(`Creating element of type: ${type} with props: ${JSON.stringify(props)}`);
    const element = {
      type,
      props: {
        ...props,
        children: children
          .filter((child) => child !== "false" && child !== "true" && child != null)
          .map((child) => {
            if (typeof child === "object") {
              return child;
            } else if (typeof child === "string" || typeof child === "number") {
              return Reactify.createTextElement(String(child));
            }
            Reactify.logInfo(`Encountered an unsupported child type in props; child will be ignored: ${child}`);
            return null;
          })
          .filter((child) => child !== null),
      },
    };
    Reactify.logInfo(`Created element: ${element}`);
    return element;
  }

  private static createTextElement(text: string): ReactifyElement {
    Reactify.logInfo(`Creating text element for text: ${text}`);
    const textElement = {
      type: "TEXT_ELEMENT" as ReactifyElementType,
      props: {
        value: text,
        children: [],
      },
    };
    Reactify.logInfo(`Created text element: ${textElement}`);
    return textElement;
  }

  private static createDomElement(fiberNode: FiberNode) {
    if (fiberNode.type instanceof Function) {
      Reactify.logInfo(`Skipping creation DOM element for invalid fiber node of type: ${fiberNode.type}`);
      return;
    }

    Reactify.logInfo("Creating DOM element for fiber:", fiberNode);
    const isTextElement = fiberNode.type === "TEXT_ELEMENT";
    const DomElement = isTextElement
      ? document.createTextNode(fiberNode.props.value)
      : document.createElement(fiberNode.type);

    if (!isTextElement) {
      const currentNode = DomElement as HTMLElement;
      Object.keys(fiberNode.props)
        .filter((key) => key !== "children")
        .forEach((key) => {
          if (Reactify.isEvent(key)) {
            const eventType = key.toLowerCase().substring(2);
            const handler = fiberNode.props[key];
            currentNode.addEventListener(eventType, handler);
            Reactify.logInfo(`Added event listener: ${eventType}`);
          } else {
            Reactify.logInfo(`Setting property '${key}' to '${fiberNode.props[key]}' on DOM element`);
            if (typeof fiberNode.props[key] === "boolean" || fiberNode.props[key] === null) {
              // @ts-ignore
              currentNode[key] = fiberNode.props[key]; // Direct assignment for boolean and null types
            } else {
              currentNode.setAttribute(key, fiberNode.props[key]); // Use setAttribute for other types
            }
          }
          currentNode.setAttribute(key, fiberNode.props[key]);
        });
    }

    Reactify.logInfo("DOM element created:", DomElement);
    return DomElement;
  }

  static render(reactifyElement: ReactifyElement, container: HTMLElement) {
    Reactify.logInfo("Starting render for element:", reactifyElement, "into container:", container);
    Reactify.workInProgressRoot = Reactify.nextUnitOfWork = {
      type: container.tagName as FiberNodeElementType,
      currentDomElement: container,
      parentFiber: null,
      child: null,
      sibling: null,
      alternate: Reactify.currentRoot,
      effectTag: "PLACEMENT", // this value will not be used for the workInProgressRoot, but we have to set it anyway...
      props: {
        children: [reactifyElement],
      },
    };
    requestIdleCallback((deadline) => Reactify.workLoop(deadline));
  }

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

  private static commitRoot() {
    Reactify.logInfo("Committing changes to root...");

    // Process deletions using commitDeletion
    Reactify.deletions.forEach((fiber) => {
      let domParentFiber = fiber.parentFiber;
      while (domParentFiber && !domParentFiber.currentDomElement) {
        domParentFiber = domParentFiber.parentFiber;
      }
      if (domParentFiber && domParentFiber.currentDomElement) {
        Reactify.commitDeletion(fiber, domParentFiber.currentDomElement as HTMLElement);
      }
    });

    if (Reactify.workInProgressRoot && Reactify.workInProgressRoot.child) {
      Reactify.commitWork(Reactify.workInProgressRoot.child);
      Reactify.currentRoot = Reactify.workInProgressRoot;
      Reactify.logInfo("Changes committed successfully.");
      Reactify.workInProgressRoot = null;
    }
  }

  private static commitWork(fiber: FiberNode) {
    Reactify.logInfo(`Committing work for fiber: ${fiber.type}, Effect Tag: ${fiber.effectTag}`);

    if (!fiber.parentFiber) {
      Reactify.logError(`Skipping fiber due to missing parent. Type: ${fiber.type}, Effect Tag: ${fiber.effectTag}`);
      return;
    }

    if (!(fiber.type instanceof Function) && fiber.currentDomElement) {
      let domParentFiber = fiber.parentFiber;
      while (!domParentFiber.currentDomElement) {
        domParentFiber = domParentFiber.parentFiber!;
      }
      const domParent = domParentFiber.currentDomElement;

      Reactify.logInfo(`Parent DOM found for fiber: ${fiber.type}, Parent Type: ${fiber.parentFiber.type}`);

      switch (fiber.effectTag) {
        case "PLACEMENT":
          domParent.appendChild(fiber.currentDomElement);
          Reactify.logInfo(`Placed new DOM element for type: ${fiber.type} under parent: ${fiber.parentFiber.type}`);
          break;
        case "UPDATE":
          if (fiber.alternate) {
            Reactify.updateDom(fiber.currentDomElement, fiber.alternate.props, fiber.props);
            Reactify.logInfo(`Updated DOM element for type: ${fiber.type}`);
          } else {
            Reactify.logError(`Skipped update for ${fiber.type} due to missing alternate fiber`);
          }
          break;
        case "DELETION":
          Reactify.commitDeletion(fiber, domParent as HTMLElement);
          break;
        default:
          Reactify.logError(`Unhandled effect tag: ${fiber.effectTag} for type: ${fiber.type}`);
          break;
      }
    }

    if (fiber.child) {
      Reactify.logInfo(`Proceeding to commit child fiber of: ${fiber.type}`);
      Reactify.commitWork(fiber.child);
    } else {
      Reactify.logInfo(`No child fiber to commit for type: ${fiber.type}`);
    }

    if (fiber.sibling) {
      Reactify.logInfo(`Proceeding to commit sibling fiber of: ${fiber.type}`);
      Reactify.commitWork(fiber.sibling);
    } else {
      Reactify.logInfo(`No sibling fiber to commit for type: ${fiber.type}`);
    }
  }

  private static commitDeletion(fiber: FiberNode, domParent: HTMLElement) {
    if (fiber.currentDomElement) {
      domParent.removeChild(fiber.currentDomElement);
    } else {
      let child = fiber.child;
      while (child) {
        Reactify.commitDeletion(child, domParent);
        child = child.sibling;
      }
    }
  }

  private static isEvent = (key: string) => key.startsWith("on");
  private static isProperty = (key: string) => key !== "children";
  private static isNew = (prevProps: Props, nextProps: Props) => (key: string) => prevProps[key] !== nextProps[key];
  private static isGone = (nextProps: Props) => (key: string) => !(key in nextProps) || this.isEvent(key);

  private static updateDom(domElement: HTMLElement | Text, prevProps: Props, nextProps: Props) {
    if (domElement instanceof Text) {
      if (prevProps.value !== nextProps.value) {
        Reactify.logInfo(`Updating text content from '${prevProps.value}' to '${nextProps.value}'`);
        domElement.nodeValue = nextProps.value;
      }
      return;
    }

    // Remove old properties or change event listeners
    Reactify.logInfo("Removing old or changed properties and event listeners...");
    Object.keys(prevProps)
      .filter(Reactify.isProperty)
      .filter(Reactify.isGone(nextProps))
      .forEach((key) => {
        if (Reactify.isEvent(key)) {
          const eventType = key.toLowerCase().substring(2);
          const handler = prevProps[key];
          domElement.removeEventListener(eventType, handler);
          Reactify.logInfo(`Removed event listener: ${eventType}`);
        } else {
          Reactify.logInfo(`Clearing property '${key}' from DOM element`);
          // @ts-ignore
          if (typeof domElement[key] === "boolean" || typeof domElement[key] === "number") {
            // @ts-ignore
            domElement[key] = false; // or some default value based on the property type
          } else {
            domElement.removeAttribute(key); // Use removeAttribute for non-boolean attributes
          }
        }
      });

    Reactify.logInfo("Setting new or changed properties...");
    Object.keys(nextProps)
      .filter(Reactify.isProperty)
      .filter(Reactify.isNew(prevProps, nextProps))
      .forEach((key) => {
        if (Reactify.isEvent(key)) {
          const eventType = key.toLowerCase().substring(2);
          const handler = nextProps[key];
          domElement.addEventListener(eventType, handler);
          Reactify.logInfo(`Added event listener: ${eventType}`);
        } else {
          Reactify.logInfo(`Setting property '${key}' to '${nextProps[key]}' on DOM element`);
          if (typeof nextProps[key] === "boolean" || nextProps[key] === null) {
            // @ts-ignore
            domElement[key] = nextProps[key]; // Direct assignment for boolean and null types
          } else {
            domElement.setAttribute(key, nextProps[key]); // Use setAttribute for other types
          }
        }
      });
  }

  private static performUnitOfWork() {
    if (!Reactify.nextUnitOfWork) {
      Reactify.logInfo("No more work to perform.");
      return;
    }

    Reactify.logInfo("Processing nextUnitOfWork:", Reactify.nextUnitOfWork);

    if (Reactify.nextUnitOfWork.type instanceof Function) Reactify.updateFunctionComponent();
    else Reactify.updateHostComponent();

    Reactify.findNextUnitOfWork();
  }

  private static updateFunctionComponent() {
    if (!Reactify.nextUnitOfWork) {
      Reactify.logInfo("No more work to perform.");
      return;
    }

    if (!(Reactify.nextUnitOfWork.type instanceof Function)) {
      Reactify.logError("Attempted to update a component, but the component type is not a function.");
      return;
    }

    const children = [Reactify.nextUnitOfWork.type(Reactify.nextUnitOfWork.props)] as ReactifyElement[];
    Reactify.reconcileChildren(children);
  }

  private static updateHostComponent() {
    if (!Reactify.nextUnitOfWork) {
      Reactify.logInfo("No more work to perform.");
      return;
    }

    if (!Reactify.nextUnitOfWork.currentDomElement) {
      Reactify.logInfo("Creating DOM element for:", Reactify.nextUnitOfWork.type);
      Reactify.nextUnitOfWork.currentDomElement = Reactify.createDomElement(Reactify.nextUnitOfWork)!;
    }

    const children = Reactify.nextUnitOfWork.props.children;
    Reactify.logInfo("Reconciling children for:", Reactify.nextUnitOfWork.type);
    Reactify.reconcileChildren(children);
  }

  private static findNextUnitOfWork() {
    if (!Reactify.nextUnitOfWork) {
      Reactify.logInfo("No more work units found, ending work loop.");
      return;
    }

    if (Reactify.nextUnitOfWork.child) {
      Reactify.logInfo("Moving to child of:", Reactify.nextUnitOfWork.type);
      Reactify.nextUnitOfWork = Reactify.nextUnitOfWork.child;
    } else if (Reactify.nextUnitOfWork.sibling) {
      Reactify.logInfo("Moving to sibling of:", Reactify.nextUnitOfWork.type);
      Reactify.nextUnitOfWork = Reactify.nextUnitOfWork.sibling;
    } else {
      Reactify.logInfo("No child or sibling, finding ancestor with sibling...");
      let ancestor = Reactify.nextUnitOfWork.parentFiber;
      while (ancestor && !ancestor.sibling) {
        ancestor = ancestor.parentFiber;
      }
      if (ancestor && ancestor.sibling) {
        Reactify.logInfo("Moving to sibling of ancestor:", ancestor.type);
        Reactify.nextUnitOfWork = ancestor.sibling;
      } else {
        Reactify.logInfo("No more work units found, ending work loop.");
        Reactify.nextUnitOfWork = null;
      }
    }
  }

  private static reconcileChildren(children: ReactifyElement[]) {
    if (!Reactify.nextUnitOfWork) {
      Reactify.logInfo("No work unit available to reconcile children.");
      return;
    }

    Reactify.logInfo("Reconciling children for fiber:", Reactify.nextUnitOfWork);
    let prevSibling: FiberNode | null = null;
    let oldFiber = Reactify.nextUnitOfWork.alternate && Reactify.nextUnitOfWork.alternate.child;

    let index = 0;
    while (index < children.length || oldFiber != null) {
      const child = children[index];
      let newFiber: FiberNode | null = null;
      const sameType = oldFiber && child && child.type == oldFiber.type;

      if (sameType && oldFiber) {
        newFiber = {
          type: oldFiber.type,
          currentDomElement: oldFiber.currentDomElement,
          parentFiber: Reactify.nextUnitOfWork,
          child: null,
          sibling: null,
          alternate: oldFiber,
          effectTag: "UPDATE",
          props: child.props,
        };
        Reactify.logInfo("Updating fiber for type:", child.type);
      }

      if (child && !sameType) {
        newFiber = {
          type: child.type as FiberNodeElementType,
          currentDomElement: null,
          parentFiber: Reactify.nextUnitOfWork,
          child: null,
          sibling: null,
          alternate: null,
          effectTag: "PLACEMENT",
          props: child.props,
        };
        Reactify.logInfo("Placing new fiber for type:", child.type);
      }

      if (oldFiber && !sameType) {
        oldFiber.effectTag = "DELETION";
        Reactify.deletions.push(oldFiber);
        Reactify.logInfo("Deleting fiber for type:", oldFiber.type);
      }

      if (oldFiber) {
        oldFiber = oldFiber.sibling;
      }

      if (index === 0) {
        Reactify.nextUnitOfWork.child = newFiber;
      } else if (prevSibling) {
        prevSibling.sibling = newFiber;
      }
      prevSibling = newFiber;
      index++;
    }

    Reactify.logInfo("Completed reconciling children for:", Reactify.nextUnitOfWork);
  }

  static useState(initialValue: any) {
    if (!Reactify.nextUnitOfWork) {
      throw new Error("useState must be called within a component's render.");
    }

    const fiber = Reactify.nextUnitOfWork;
    fiber.hooks = fiber.hooks || [];
    fiber.hookIndex = fiber.hookIndex || 0;

    const hookIndex = fiber.hookIndex;
    const oldHook = fiber.alternate?.hooks?.[hookIndex];

    const hook = oldHook || { state: initialValue, queue: [] };

    // Process any queued state updates
    hook.queue.forEach((action: Function) => {
      hook.state = action(hook.state);
    });
    hook.queue = []; // Clear the queue after processing

    const setState = (action: Function | any) => {
      const newAction = typeof action === "function" ? action : () => action;
      hook.queue.push(newAction);
      Reactify.scheduleRender(fiber); // Trigger a re-render
    };

    fiber.hooks[hookIndex] = hook;
    fiber.hookIndex++;

    return [hook.state, setState]; // Return the state and setState function
  }

  private static scheduleRender(nextUnitOfWork: FiberNode) {
    const workInProgressRoot = Reactify.findRoot(nextUnitOfWork);

    Reactify.workInProgressRoot = {
      type: workInProgressRoot.type,
      currentDomElement: workInProgressRoot.currentDomElement,
      parentFiber: null,
      child: null,
      sibling: null,
      alternate: Reactify.currentRoot,
      effectTag: "UPDATE",
      props: workInProgressRoot.props,
    };

    Reactify.nextUnitOfWork = Reactify.workInProgressRoot;
    Reactify.deletions = [];

    requestIdleCallback((deadline) => Reactify.workLoop(deadline));
  }

  private static findRoot(fiber: FiberNode) {
    let node = fiber;
    while (node.parentFiber) {
      node = node.parentFiber;
    }
    return node;
  }
}
