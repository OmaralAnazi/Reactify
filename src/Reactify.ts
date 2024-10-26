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
    const element = {
      type,
      props: {
        ...props,
        children: children.map((child) => (typeof child === "object" ? child : Reactify.createTextElement(child))),
      },
    };
    Reactify.log("createElement:", element);
    return element;
  }

  private static createTextElement(text: string): ReactifyElement {
    const textElement = {
      type: "TEXT_ELEMENT" as ElementType,
      props: {
        value: text,
        children: [],
      },
    };
    Reactify.log("createTextElement:", textElement);
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
    Reactify.log(`Committing work for fiber: ${fiber.type}`);
    if (
      fiber.parentFiber &&
      fiber.currentDomElement &&
      fiber.parentFiber.currentDomElement &&
      fiber.parentFiber.currentDomElement instanceof HTMLElement
    ) {
      const domParent = fiber.parentFiber.currentDomElement;
      if (fiber.effectTag === "PLACEMENT") {
        domParent.appendChild(fiber.currentDomElement);
      } else if (fiber.effectTag === "UPDATE" && fiber.alternate) {
        Reactify.updateDom(fiber.currentDomElement, fiber.alternate.props, fiber.props);
      } else if (fiber.effectTag === "DELETION" && domParent.contains(fiber.currentDomElement)) {
        domParent.removeChild(fiber.currentDomElement);
      }

      if (fiber.child) Reactify.commitWork(fiber.child);
      if (fiber.sibling) Reactify.commitWork(fiber.sibling);
    }
  }

  private static isEvent = (key: string) => key.startsWith("on");
  private static isProperty = (key: string) => key !== "children";
  private static isNew = (prevProps: Props, nextProps: Props) => (key: string) => prevProps[key] !== nextProps[key];
  private static isGone = (nextProps: Props) => (key: string) => !(key in nextProps);

  private static updateDom(domElement: HTMLElement | Text, prevProps: Props, nextProps: Props) {
    if (domElement instanceof Text) {
      if (prevProps.value !== nextProps.value) {
        domElement.nodeValue = nextProps.value;
      }
      return;
    }

    // Remove old properties
    Object.keys(prevProps)
      .filter(Reactify.isProperty)
      .filter(Reactify.isGone(nextProps))
      .forEach((key) => {
        // @ts-ignore
        domElement[key] = "";
      });

    // Set new or changed properties
    Object.keys(nextProps)
      .filter(Reactify.isProperty)
      .filter(Reactify.isNew(prevProps, nextProps))
      .forEach((key) => {
        // @ts-ignore
        domElement[key] = nextProps[key];
      });

    // Add event listeners
    Object.keys(nextProps)
      .filter(Reactify.isEvent)
      .filter(Reactify.isNew(prevProps, nextProps))
      .forEach((key) => {
        const eventType = key.toLowerCase().substring(2);
        domElement.addEventListener(eventType, nextProps[key]);
      });
  }

  private static performUnitOfWork() {
    Reactify.log("Processing nextUnitOfWork:", Reactify.nextUnitOfWork);
    if (!Reactify.nextUnitOfWork) return;

    if (!Reactify.nextUnitOfWork.currentDomElement) {
      Reactify.nextUnitOfWork.currentDomElement = Reactify.createDomElement(Reactify.nextUnitOfWork);
    }

    const children = Reactify.nextUnitOfWork.props.children;
    Reactify.reconcileChildren(children);

    if (Reactify.nextUnitOfWork.child) {
      Reactify.nextUnitOfWork = Reactify.nextUnitOfWork.child;
      return;
    }

    if (Reactify.nextUnitOfWork.sibling) {
      Reactify.nextUnitOfWork = Reactify.nextUnitOfWork.sibling;
      return;
    }

    let ancestor = Reactify.nextUnitOfWork.parentFiber;
    while (ancestor && !ancestor.sibling) {
      ancestor = ancestor.parentFiber;
    }
    if (ancestor && ancestor.sibling) {
      Reactify.nextUnitOfWork = ancestor.sibling;
      return;
    }

    Reactify.nextUnitOfWork = null;
  }

  private static reconcileChildren(children: ReactifyElement[]) {
    if (!Reactify.nextUnitOfWork) return;

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
      }
      if (oldFiber && !sameType) {
        oldFiber.effectTag = "DELETION";
        Reactify.deletions.push(oldFiber);
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
  }
}
