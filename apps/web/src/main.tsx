import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import { Home, Features, ComponentsPage, ExamplesPage, DocsPage, TutorialsPage, About, Contact, Legal, NotFound } from "./pages/Public.tsx";
import { Login, Register, ForgotPassword, Dashboard, MyProjects, NewProject, Templates, SharedProjects, Favorites, Settings } from "./pages/Account.tsx";
import Workspace from "./editor/Workspace.tsx";
import { currentUser } from "./api.ts";
import "./styles.css";

if (localStorage.getItem("iot-sim-theme") === "dark") document.documentElement.classList.add("dark");

function Shell({ children }: { children: React.ReactNode }) {
  const user = currentUser();
  return (
    <div>
      <header className="topbar">
        <Link to="/" className="logo"><span className="dot" /> CircuitVerse Sim</Link>
        <nav>
          <Link className="hide-sm" to="/features">Features</Link>
          <Link className="hide-sm" to="/components">Components</Link>
          <Link className="hide-sm" to="/examples">Examples</Link>
          <Link className="hide-sm" to="/docs">Docs</Link>
          <Link className="hide-sm" to="/tutorials">Tutorials</Link>
          <Link to="/workspace">Workspace</Link>
        </nav>
        <span style={{ flex: 1 }} />
        {user ? (<><Link to="/dashboard">Dashboard</Link><Link to="/settings">{user.name}</Link></>) : (<><Link to="/login">Login</Link><Link className="btn primary sm" to="/register">Register</Link></>)}
      </header>
      {children}
      <footer style={{ borderTop: "1px solid var(--line)", padding: "18px 20px", marginTop: 30 }} className="muted small">
        CircuitVerse Sim — original open-source 2D + 3D IoT simulator (MIT). <Link to="/about">About</Link> · <Link to="/contact">Contact</Link> · <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link>
      </footer>
    </div>
  );
}
const page = (el: React.ReactNode) => <Shell>{el}</Shell>;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={page(<Home />)} />
        <Route path="/features" element={page(<Features />)} />
        <Route path="/components" element={page(<ComponentsPage />)} />
        <Route path="/examples" element={page(<ExamplesPage />)} />
        <Route path="/docs" element={page(<DocsPage />)} />
        <Route path="/tutorials" element={page(<TutorialsPage />)} />
        <Route path="/about" element={page(<About />)} />
        <Route path="/contact" element={page(<Contact />)} />
        <Route path="/login" element={page(<Login />)} />
        <Route path="/register" element={page(<Register />)} />
        <Route path="/forgot-password" element={page(<ForgotPassword />)} />
        <Route path="/privacy" element={page(<Legal kind="privacy" />)} />
        <Route path="/terms" element={page(<Legal kind="terms" />)} />
        <Route path="/dashboard" element={page(<Dashboard />)} />
        <Route path="/projects" element={page(<MyProjects />)} />
        <Route path="/projects/new" element={page(<NewProject />)} />
        <Route path="/projects/:id" element={<Navigate to="/workspace" replace />} />
        <Route path="/templates" element={page(<Templates />)} />
        <Route path="/shared" element={page(<SharedProjects />)} />
        <Route path="/favorites" element={page(<Favorites />)} />
        <Route path="/settings" element={page(<Settings />)} />
        <Route path="/workspace" element={<Shell><Workspace /></Shell>} />
        <Route path="*" element={page(<NotFound />)} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
