export type ElementType = keyof HTMLElementTagNameMap | "TEXT_ELEMENT";

export type ReactifyElement = {
  type: ElementType;
  props: {
    [key: string]: any;
    children: ReactifyElement[];
  };
};

export type FiberNode = {
  type: ElementType;
  currentDomElement: HTMLElement | Text | null;
  fiberParent: FiberNode | null;
  child: FiberNode | null;
  sibling: FiberNode | null;
  props: {
    [key: string]: any;
    children: ReactifyElement[];
  };
};

export default class Reactify {
  private static workInProgressRoot: FiberNode | null;
  private static nextUnitOfWork: FiberNode | null;
  private static debugMode = false;

  static setDebugMode(enabled: boolean) {
    Reactify.debugMode = enabled;
    console.log(`Debug mode set to ${enabled ? "ON" : "OFF"}`);
  }

  private static log(...args: any[]) {
    if (Reactify.debugMode) {
      console.log("[Reactify]", ...args);
    }
  }

  static createElement(
    type: ElementType,
    props: { [key: string]: any } | null = null,
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
      fiberParent: null,
      child: null,
      sibling: null,
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
    if (Reactify.workInProgressRoot && Reactify.workInProgressRoot.child) {
      Reactify.commitWork(Reactify.workInProgressRoot.child);
      Reactify.log("Changes committed successfully.");
      Reactify.workInProgressRoot = null;
    }
  }

  private static commitWork(fiber: FiberNode) {
    Reactify.log(`Committing work for fiber: ${fiber.type}`);
    if (
      fiber.fiberParent &&
      fiber.currentDomElement &&
      fiber.fiberParent.currentDomElement &&
      fiber.fiberParent.currentDomElement instanceof HTMLElement
    ) {
      const domParent = fiber.fiberParent.currentDomElement;
      domParent.appendChild(fiber.currentDomElement);
      Reactify.log(`Appended ${fiber.type} to ${domParent.tagName}`);
      if (fiber.child) Reactify.commitWork(fiber.child);
      if (fiber.sibling) Reactify.commitWork(fiber.sibling);
    }
  }

  private static performUnitOfWork() {
    Reactify.log("Processing nextUnitOfWork:", Reactify.nextUnitOfWork);
    if (!Reactify.nextUnitOfWork) return;

    if (!Reactify.nextUnitOfWork.currentDomElement) {
      Reactify.nextUnitOfWork.currentDomElement = Reactify.createDomElement(Reactify.nextUnitOfWork);
    }

    const children = Reactify.nextUnitOfWork.props.children;
    let prevSibling: FiberNode | null = null;

    children.forEach((child, index) => {
      if (!Reactify.nextUnitOfWork) return;

      const newFiber: FiberNode = {
        type: child.type,
        currentDomElement: null,
        fiberParent: Reactify.nextUnitOfWork,
        child: null,
        sibling: null,
        props: child.props,
      };

      if (index === 0) {
        Reactify.nextUnitOfWork.child = newFiber;
      } else if (prevSibling) {
        prevSibling.sibling = newFiber;
      }
      prevSibling = newFiber;
    });

    if (Reactify.nextUnitOfWork.child) {
      Reactify.nextUnitOfWork = Reactify.nextUnitOfWork.child;
      return;
    }

    if (Reactify.nextUnitOfWork.sibling) {
      Reactify.nextUnitOfWork = Reactify.nextUnitOfWork.sibling;
      return;
    }

    let ancestor = Reactify.nextUnitOfWork.fiberParent;
    while (ancestor && !ancestor.sibling) {
      ancestor = ancestor.fiberParent;
    }
    if (ancestor && ancestor.sibling) {
      Reactify.nextUnitOfWork = ancestor.sibling;
      return;
    }

    Reactify.nextUnitOfWork = null;
  }
}
