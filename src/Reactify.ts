export type ElementType = keyof HTMLElementTagNameMap | "TEXT_ELEMENT";

export type ReactifyElement = {
  type: ElementType;
  props: {
    [key: string]: any;
    children: ReactifyElement[];
  };
};

export default class Reactify {
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

  static createTextElement(text: string): ReactifyElement {
    return {
      type: "TEXT_ELEMENT",
      props: {
        value: text,
        children: [],
      },
    };
  }

  static render(reactifyElement: ReactifyElement, container: HTMLElement) {
    const isTextElement = reactifyElement.type === "TEXT_ELEMENT";

    const nodeElement = isTextElement
      ? document.createTextNode(reactifyElement.props.value)
      : document.createElement(reactifyElement.type);

    // Assign the reactifyElement props to the nodeElement
    if (!isTextElement) {
      const currentNode = nodeElement as HTMLElement;
      Object.keys(reactifyElement.props)
        .filter((key) => key !== "children")
        .forEach((key) => {
          currentNode.setAttribute(key, reactifyElement.props[key]);
        });
    }

    // Render children recursively
    reactifyElement.props.children.map((child) => {
      if (!isTextElement) {
        this.render(child, nodeElement as HTMLElement);
      }
    });

    container.appendChild(nodeElement);
  }
}
