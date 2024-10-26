export type ElementType = keyof HTMLElementTagNameMap | "TEXT_ELEMENT";

export type ReactifyElement = {
  type: ElementType;
  props: Props;
};

export type EffectTag = "UPDATE" | "PLACEMENT" | "DELETION";

export type Props = {
  [key: string]: any;
  children: ReactifyElement[];
};

export type FiberNode = {
  type: ElementType;
  currentDomElement: HTMLElement | Text | null;
  parentFiber: FiberNode | null;
  child: FiberNode | null;
  sibling: FiberNode | null;
  alternate: FiberNode | null;
  effectTag: EffectTag;
  props: Props;
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

  private static log(...args: any[]) {
    if (Reactify.debugMode) {
      console.log("[Reactify]", ...args);
    }
  }

  static createElement(
    type: ElementType,
    props: Props | null = null,
    ...children: (ReactifyElement | string)[]
  ): ReactifyElement {
    Reactify.log(`Creating element of type: ${type} with props: ${JSON.stringify(props)}`);
    const element = {
      type,
      props: {
        ...props,
        children: children.map((child) => (typeof child === "object" ? child : Reactify.createTextElement(child))),
      },
    };
    Reactify.log(`Created element: ${element}`);
    return element;
  }

  private static createTextElement(text: string): ReactifyElement {
    Reactify.log(`Creating text element for text: ${text}`);
    const textElement = {
      type: "TEXT_ELEMENT" as ElementType,
      props: {
        value: text,
        children: [],
      },
    };
    Reactify.log(`Created text element: ${textElement}`);
    return textElement;
  }

  private static createDomElement(fiberNode: FiberNode) {
    Reactify.log("Creating DOM element for fiber:", fiberNode);
    const isTextElement = fiberNode.type === "TEXT_ELEMENT";
    const DomElement = isTextElement
      ? document.createTextNode(fiberNode.props.value)
      : document.createElement(fiberNode.type);

    if (!isTextElement) {
      const currentNode = DomElement as HTMLElement;
      Object.keys(fiberNode.props)
        .filter((key) => key !== "children")
        .forEach((key) => {
          currentNode.setAttribute(key, fiberNode.props[key]);
        });
    }

    Reactify.log("DOM element created:", DomElement);
    return DomElement;
  }

  static render(reactifyElement: ReactifyElement, container: HTMLElement) {
    Reactify.log("Starting render for element:", reactifyElement, "into container:", container);
    Reactify.workInProgressRoot = Reactify.nextUnitOfWork = {
      type: container.tagName as ElementType,
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
    Reactify.log("Starting work loop");
    while (Reactify.nextUnitOfWork && deadline.timeRemaining() > 0) {
      Reactify.log("Performing unit of work:", Reactify.nextUnitOfWork);
      Reactify.performUnitOfWork();
    }
    if (Reactify.nextUnitOfWork) {
      requestIdleCallback((deadline) => Reactify.workLoop(deadline));
    } else if (Reactify.workInProgressRoot) {
      Reactify.commitRoot();
    }
  }

  private static commitRoot() {
    Reactify.log("Committing changes to root...");
    Reactify.deletions.forEach(Reactify.commitWork);
    if (Reactify.workInProgressRoot && Reactify.workInProgressRoot.child) {
      Reactify.commitWork(Reactify.workInProgressRoot.child);
      Reactify.currentRoot = Reactify.workInProgressRoot;
      Reactify.log("Changes committed successfully.");
      Reactify.workInProgressRoot = null;
    }
  }

  private static commitWork(fiber: FiberNode) {
    Reactify.log(`Committing work for fiber: ${fiber.type}, Effect Tag: ${fiber.effectTag}`);

    if (!fiber.parentFiber || !fiber.currentDomElement || !fiber.parentFiber.currentDomElement) {
      Reactify.log(
        `Skipping fiber due to missing parent or DOM elements. Type: ${fiber.type}, Effect Tag: ${fiber.effectTag}`
      );
      return;
    }

    const domParent = fiber.parentFiber.currentDomElement;
    Reactify.log(`Parent DOM found for fiber: ${fiber.type}, Parent Type: ${fiber.parentFiber.type}`);

    switch (fiber.effectTag) {
      case "PLACEMENT":
        domParent.appendChild(fiber.currentDomElement);
        Reactify.log(`Placed new DOM element for type: ${fiber.type} under parent: ${fiber.parentFiber.type}`);
        break;
      case "UPDATE":
        if (fiber.alternate) {
          Reactify.updateDom(fiber.currentDomElement, fiber.alternate.props, fiber.props);
          Reactify.log(`Updated DOM element for type: ${fiber.type}`);
        } else {
          Reactify.log(`Skipped update for ${fiber.type} due to missing alternate fiber`);
        }
        break;
      case "DELETION":
        if (domParent.contains(fiber.currentDomElement)) {
          domParent.removeChild(fiber.currentDomElement);
          Reactify.log(`Removed DOM element for type: ${fiber.type}`);
        } else {
          Reactify.log(`Attempted to remove non-existent or already removed element for type: ${fiber.type}`);
        }
        break;
      default:
        Reactify.log(`Unhandled effect tag: ${fiber.effectTag} for type: ${fiber.type}`);
        break;
    }

    if (fiber.child) {
      Reactify.log(`Proceeding to commit child fiber of: ${fiber.type}`);
      Reactify.commitWork(fiber.child);
    } else {
      Reactify.log(`No child fiber to commit for type: ${fiber.type}`);
    }

    if (fiber.sibling) {
      Reactify.log(`Proceeding to commit sibling fiber of: ${fiber.type}`);
      Reactify.commitWork(fiber.sibling);
    } else {
      Reactify.log(`No sibling fiber to commit for type: ${fiber.type}`);
    }
  }

  private static isEvent = (key: string) => key.startsWith("on");
  private static isProperty = (key: string) => key !== "children";
  private static isNew = (prevProps: Props, nextProps: Props) => (key: string) => prevProps[key] !== nextProps[key];
  private static isGone = (nextProps: Props) => (key: string) => !(key in nextProps);

  private static updateDom(domElement: HTMLElement | Text, prevProps: Props, nextProps: Props) {
    if (domElement instanceof Text) {
      if (prevProps.value !== nextProps.value) {
        Reactify.log(`Updating text content from '${prevProps.value}' to '${nextProps.value}'`);
        domElement.nodeValue = nextProps.value;
      }
      return;
    }

    // Remove old properties or change event listeners
    Reactify.log("Removing old or changed properties and event listeners...");
    Object.keys(prevProps)
      .filter(Reactify.isProperty)
      .filter(Reactify.isGone(nextProps))
      .forEach((key) => {
        if (Reactify.isEvent(key)) {
          const eventType = key.toLowerCase().substring(2);
          const handler = prevProps[key];
          domElement.removeEventListener(eventType, handler);
          Reactify.log(`Removed event listener: ${eventType}`);
        } else {
          Reactify.log(`Clearing property '${key}' from DOM element`);
          // @ts-ignore
          if (typeof domElement[key] === "boolean" || typeof domElement[key] === "number") {
            // @ts-ignore
            domElement[key] = false; // or some default value based on the property type
          } else {
            domElement.removeAttribute(key); // Use removeAttribute for non-boolean attributes
          }
        }
      });

    Reactify.log("Setting new or changed properties...");
    Object.keys(nextProps)
      .filter(Reactify.isProperty)
      .filter(Reactify.isNew(prevProps, nextProps))
      .forEach((key) => {
        if (Reactify.isEvent(key)) {
          const eventType = key.toLowerCase().substring(2);
          const handler = nextProps[key];
          domElement.addEventListener(eventType, handler);
          Reactify.log(`Added event listener: ${eventType}`);
        } else {
          Reactify.log(`Setting property '${key}' to '${nextProps[key]}' on DOM element`);
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
      Reactify.log("No more work to perform.");
      return;
    }

    Reactify.log("Processing nextUnitOfWork:", Reactify.nextUnitOfWork);

    if (!Reactify.nextUnitOfWork.currentDomElement) {
      Reactify.log("Creating DOM element for:", Reactify.nextUnitOfWork.type);
      Reactify.nextUnitOfWork.currentDomElement = Reactify.createDomElement(Reactify.nextUnitOfWork);
    }

    const children = Reactify.nextUnitOfWork.props.children;
    Reactify.log("Reconciling children for:", Reactify.nextUnitOfWork.type);
    Reactify.reconcileChildren(children);

    if (Reactify.nextUnitOfWork.child) {
      Reactify.log("Moving to child of:", Reactify.nextUnitOfWork.type);
      Reactify.nextUnitOfWork = Reactify.nextUnitOfWork.child;
    } else if (Reactify.nextUnitOfWork.sibling) {
      Reactify.log("Moving to sibling of:", Reactify.nextUnitOfWork.type);
      Reactify.nextUnitOfWork = Reactify.nextUnitOfWork.sibling;
    } else {
      Reactify.log("No child or sibling, finding ancestor with sibling...");
      let ancestor = Reactify.nextUnitOfWork.parentFiber;
      while (ancestor && !ancestor.sibling) {
        ancestor = ancestor.parentFiber;
      }
      if (ancestor && ancestor.sibling) {
        Reactify.log("Moving to sibling of ancestor:", ancestor.type);
        Reactify.nextUnitOfWork = ancestor.sibling;
      } else {
        Reactify.log("No more work units found, ending work loop.");
        Reactify.nextUnitOfWork = null;
      }
    }
  }

  private static reconcileChildren(children: ReactifyElement[]) {
    if (!Reactify.nextUnitOfWork) {
      Reactify.log("No work unit available to reconcile children.");
      return;
    }

    Reactify.log("Reconciling children for fiber:", Reactify.nextUnitOfWork);
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
        Reactify.log("Updating fiber for type:", child.type);
      }

      if (child && !sameType) {
        newFiber = {
          type: child.type,
          currentDomElement: null,
          parentFiber: Reactify.nextUnitOfWork,
          child: null,
          sibling: null,
          alternate: null,
          effectTag: "PLACEMENT",
          props: child.props,
        };
        Reactify.log("Placing new fiber for type:", child.type);
      }

      if (oldFiber && !sameType) {
        oldFiber.effectTag = "DELETION";
        Reactify.deletions.push(oldFiber);
        Reactify.log("Deleting fiber for type:", oldFiber.type);
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

    Reactify.log("Completed reconciling children for:", Reactify.nextUnitOfWork);
  }
}
