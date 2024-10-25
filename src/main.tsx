import Reactify from "./Reactify";

const element = (
  <div id="root">
    <h1>Hello, Reactify!</h1>
    <p>This is a paragraph inside Reactify.</p>
  </div>
);
const container = document.getElementById("app")!;
Reactify.render(element, container);
