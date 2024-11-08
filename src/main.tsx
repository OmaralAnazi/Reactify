import Reactify from "./Reactify";

// Reactify.setDebugMode(true);

function App() {
  const [showC, setShowC] = Reactify.useState(true);
  return (
    <div>
      <h1>Welcome to Reactify</h1>
      <button onClick={() => setShowC(!showC)}>Toggle show C</button>
      <ComponentA title="Component A" content="This is the content of Component A." />
      <ComponentB title="Component B" content="This is the content of Component B." />
      {showC && <ComponentC title="Component C" content="This is the content of Component C." />}
    </div>
  );
}

function ComponentA({ title, content }: any) {
  const [counter, setCounter] = Reactify.useState(0);

  return (
    <div>
      <h2>{title}</h2>
      <p>
        {content}, Counter: {counter}
      </p>
      <button onClick={() => setCounter(counter + 1)}>Click me</button>
    </div>
  );
}

function ComponentB({ title, content }: any) {
  const [counter, setCounter] = Reactify.useState(0);

  return (
    <div>
      <h2>{title}</h2>
      <p>
        {content}, Counter: {counter}
      </p>
      <button onClick={() => setCounter(counter + 1)}>Click me</button>
    </div>
  );
}

function ComponentC({ title, content }: any) {
  const [counter, setCounter] = Reactify.useState(0);

  return (
    <div>
      <h2>{title}</h2>
      <p>
        {content}, Counter: {counter}
      </p>
      <button onClick={() => setCounter(counter + 1)}>Click me</button>
    </div>
  );
}

const container = document.getElementById("app")!;
Reactify.render(<App />, container);
