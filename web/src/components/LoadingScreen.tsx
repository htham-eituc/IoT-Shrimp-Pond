import { LoaderCircle, Waves } from "lucide-react";

export function LoadingScreen() {
  return (
    <main className="loading-screen" aria-busy="true">
      <div className="loading-card">
        <span className="brand-mark brand-mark--large" aria-hidden="true">
          <Waves />
        </span>
        <LoaderCircle className="spin" aria-hidden="true" />
        <h1>Preparing dashboard</h1>
        <p>Checking the local mock session.</p>
      </div>
    </main>
  );
}
