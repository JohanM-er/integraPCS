import { Suspense } from 'react';

function App() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-semibold text-neutral-900">integraPCS</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Suspense fallback={<div>Loading...</div>}>
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-medium text-neutral-900">Welcome to integraPCS</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Event-sourced work package management system
            </p>
          </div>
        </Suspense>
      </main>
    </div>
  );
}

export default App;
