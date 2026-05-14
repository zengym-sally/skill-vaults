import { useState } from "react";

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center p-8 bg-white rounded-2xl shadow-xl">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Welcome to SkillVault
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Your personal knowledge management tool built with Tauri 2.x + React +
          TypeScript
        </p>

        <div className="flex gap-4 justify-center">
          <button
            onClick={() => setCount((count) => count + 1)}
            className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg"
          >
            Count: {count}
          </button>
        </div>

        <p className="mt-8 text-sm text-gray-500">
          Edit{" "}
          <code className="bg-gray-100 px-2 py-1 rounded">src/App.tsx</code> to
          get started
        </p>
      </div>
    </div>
  );
}

export default App;
