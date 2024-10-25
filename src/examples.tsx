import Reactify from "./Reactify";

// Create element using Reactify.createElement directly
const element1 = Reactify.createElement(
  "h1",
  { id: "foo1" },
  Reactify.createElement("h2", null, "text")
);
console.log(element1);

// Create element using JSX/TSX, which will use our Reactify.createElement!
const element2 = (
  <div id="foo2">
    <h1>Hello, Reactify!</h1>
    <p>This is a paragraph inside Reactify.</p>
  </div>
);
console.log(element2);
