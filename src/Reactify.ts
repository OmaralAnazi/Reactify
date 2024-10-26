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
  static nextUnitOfWork: FiberNode | null;

  static createElement(
    type: ElementType,
    props: { [key: string]: any } | null = null,
    ...children: (ReactifyElement | string)[]
  ): ReactifyElement {
    return {
      type,
      props: {
        ...props,
        children: children.map((child) =>
          typeof child === "object" ? child : Reactify.createTextElement(child)
        ),
      },
    };
  }

  private static createTextElement(text: string): ReactifyElement {
    return {
      type: "TEXT_ELEMENT",
      props: {
        value: text,
        children: [],
      },
    };
  }

  private static createDomElement(fiberNode: FiberNode) {
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

    return DomElement;
  }

  static render(reactifyElement: ReactifyElement, container: HTMLElement) {
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

  static workLoop(deadline: { timeRemaining: () => number }) {
    while (this.nextUnitOfWork && deadline.timeRemaining() > 0) {
      this.performUnitOfWork();
    }
    requestIdleCallback((deadline) => this.workLoop(deadline));
  }

  static performUnitOfWork() {
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
