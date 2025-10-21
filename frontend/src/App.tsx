import { Suspense } from 'react';

function App() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-900/10 bg-neutral-50">
        <div className="container py-4">
          <h1 className="text-lg font-semibold text-neutral-900">integraPCS</h1>
        </div>
      </header>

      <main className="container py-8">
        <Suspense fallback={<div>Loading...</div>}>
          <div className="rounded-2 shadow-1 border border-neutral-900/15 bg-neutral-50 p-6">
            <h2 className="text-base font-medium text-neutral-900">Welcome to integraPCS</h2>
            <p className="mt-2 text-sm text-neutral-900/70">
              Event-sourced work package management system
            </p>
          </div>
        </Suspense>
      </main>
    </div>
  );
}

export default App;
