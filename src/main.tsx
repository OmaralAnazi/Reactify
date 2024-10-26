import Reactify from "./Reactify";

Reactify.setDebugMode(true);

const element = (
  <div id="root">
    <h1>Hello, Reactify!</h1>
    <p>This is a paragraph inside Reactify.</p>
    <ul>
      <li>Item 1</li>
      <li>Item 2</li>
      <li>Item 3</li>
    </ul>
    <div>
      <span>Nested element 1</span>
      <span>Nested element 2</span>
    </div>
    <footer>
      <small>Footer content here</small>
    </footer>
  </div>
);
const container = document.getElementById("app")!;
Reactify.render(element, container);
