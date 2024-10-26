import Reactify from "./Reactify";

Reactify.setDebugMode(true);
const container = document.getElementById("app")!;

const element1 = (
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
Reactify.render(element1, container);

const element2 = (
  <div id="root2">
    <h1>Hello, Reactify!</h1>
    <p>This is a paragraph inside Reactify.</p>
    <ul>
      <li>First Item</li>
      <li>Last Item</li>
    </ul>
    <footer>
      <small>Footer content here</small>
    </footer>
    <button onClick={() => console.log("element2")}>Click me</button>
  </div>
);
setTimeout(() => Reactify.render(element2, container), 1500);

const element3 = (
  <div id="root2">
    <h1>Hello, Reactify!</h1>
    <p>This is a paragraph inside Reactify.</p>
    <button onClick={() => console.log("element3")}>Click me</button>
  </div>
);
setTimeout(() => Reactify.render(element3, container), 3000);
