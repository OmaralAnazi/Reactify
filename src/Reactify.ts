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
  domParent: FiberNode | null;
  child: FiberNode | null;
  sibling: FiberNode | null;
  props: {
    [key: string]: any;
    children: ReactifyElement[];
  };
};

export default class Reactify {
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
        children: children.map((child) =>
          typeof child === "object" ? child : Reactify.createTextElement(child)
        ),
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
    this.nextUnitOfWork = {
      type: container.tagName as ElementType,
      currentDomElement: container,
      domParent: null,
      child: null,
      sibling: null,
      props: {
        children: [reactifyElement],
      },
    };
    requestIdleCallback((deadline) => this.workLoop(deadline));
  }

  private static workLoop(deadline: { timeRemaining: () => number }) {
    Reactify.log("Starting work loop");
    while (this.nextUnitOfWork && deadline.timeRemaining() > 0) {
      Reactify.log("Performing unit of work:", this.nextUnitOfWork);
      this.performUnitOfWork();
    }
    if (this.nextUnitOfWork) {
      requestIdleCallback((deadline) => this.workLoop(deadline));
    }
  }

  private static performUnitOfWork() {
    Reactify.log("Processing nextUnitOfWork:", this.nextUnitOfWork);
    if (!this.nextUnitOfWork) return;

    if (!this.nextUnitOfWork.currentDomElement) {
      this.nextUnitOfWork.currentDomElement = this.createDomElement(this.nextUnitOfWork);
    }

    if (this.nextUnitOfWork.domParent && this.nextUnitOfWork.domParent.currentDomElement) {
      if (this.nextUnitOfWork.domParent.currentDomElement instanceof HTMLElement) {
        this.nextUnitOfWork.domParent.currentDomElement.append(
          this.nextUnitOfWork.currentDomElement
        );
      }
    }

    const children = this.nextUnitOfWork.props.children;
    let prevSibling: FiberNode | null = null;

    children.forEach((child, index) => {
      if (!this.nextUnitOfWork) return;

      const newFiber: FiberNode = {
        type: child.type,
        currentDomElement: null,
        domParent: this.nextUnitOfWork,
        child: null,
        sibling: null,
        props: child.props,
      };

      if (index === 0) {
        this.nextUnitOfWork.child = newFiber;
      } else if (prevSibling) {
        prevSibling.sibling = newFiber;
      }
      prevSibling = newFiber;
    });

    if (this.nextUnitOfWork.child) {
      this.nextUnitOfWork = this.nextUnitOfWork.child;
      return;
    }

    if (this.nextUnitOfWork.sibling) {
      this.nextUnitOfWork = this.nextUnitOfWork.sibling;
      return;
    }

    let ancestor = this.nextUnitOfWork.domParent;
    while (ancestor && !ancestor.sibling) {
      ancestor = ancestor.domParent;
    }
    if (ancestor && ancestor.sibling) {
      this.nextUnitOfWork = ancestor.sibling;
      return;
    }

    this.nextUnitOfWork = null;
  }
}
