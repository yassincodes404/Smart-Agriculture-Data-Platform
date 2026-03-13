import { useState } from "react";

function App() {

  const [message, setMessage] = useState("");

  const testBackend = async () => {
    const res = await fetch("/api/health");
    const data = await res.json();
    setMessage(data.status);
  };

  return (
    <div>
      <h1>Agricultural Data Platform</h1>

      <button onClick={testBackend}>
        Test Backend
      </button>

      <p>{message}</p>
    </div>
  );
}

export default App;