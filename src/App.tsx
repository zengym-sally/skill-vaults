import { useEffect, useCallback, Component, ErrorInfo, ReactNode } from "react";
import {
  HashRouter,
  Routes,
  Route,
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useConfigStore } from "./store/configStore";
import { useSettingsStore } from "./store/settingsStore";
import Onboarding from "./pages/Onboarding";
import { Skills } from "./pages/Skills";
import { DispatchPage } from "./pages/Dispatch";
import { SettingsPage } from "./pages/Settings";
import { Repositories } from "./pages/Repositories";
import {
  Loader2,
  BookOpen,
  Database,
  Send,
  Settings as SettingsIcon,
  AlertTriangle,
  Vault,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function GradientBackground() {
  return (
    <div className="glass-bg glass-grain">
      <div className="glass-bg-base" />
      <div className="glass-bg-caustic glass-bg-caustic-1" />
      <div className="glass-bg-caustic glass-bg-caustic-2" />
      <div className="glass-bg-caustic glass-bg-caustic-3" />
    </div>
  );
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    toast.error(`应用发生错误: ${error.message}`);
  }

  render() {
    if (this.state.hasError) {
      return (
        <>
          <GradientBackground />
          <div className="min-h-screen flex flex-col items-center justify-center p-4">
            <div className="glass-card rounded-2xl p-8 max-w-md w-full text-center">
              <div className="w-16 h-16 bg-red-100/80 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-4">
                哎呀，出问题了
              </h1>
              <p className="text-muted-foreground mb-6">
                {this.state.error?.message || "应用遇到了一个意外错误。"}
              </p>
              <Button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="w-full"
              >
                刷新页面
              </Button>
            </div>
          </div>
        </>
      );
    }

    return this.props.children;
  }
}

function Navigation() {
  useLocation();

  const navItems = [
    { path: "/", label: "Skills", icon: <BookOpen className="h-4 w-4" /> },
    {
      path: "/repositories",
      label: "Repositories",
      icon: <Database className="h-4 w-4" />,
    },
    {
      path: "/dispatches",
      label: "Dispatches",
      icon: <Send className="h-4 w-4" />,
    },
    {
      path: "/settings",
      label: "Settings",
      icon: <SettingsIcon className="h-4 w-4" />,
    },
  ];

  return (
    <nav className="glass-nav sticky top-0 z-40 px-4 py-2.5">
      <div className="container mx-auto flex items-center gap-1">
        <div className="flex items-center gap-2.5 mr-6">
          <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-teal-500/20">
            <Vault className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-bold bg-gradient-to-r from-teal-700 to-teal-500 bg-clip-text text-transparent">
            Skill Vaults
          </h1>
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-teal-500/10 text-teal-700 shadow-sm"
                  : "text-foreground/60 hover:bg-white/40 hover:text-foreground"
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function AppContent() {
  const { basePath, isLoading, getBasePath } = useConfigStore();
  const { loadThemeConfig } = useSettingsStore();
  const navigate = useNavigate();

  useEffect(() => {
    getBasePath();
    loadThemeConfig();
  }, [getBasePath, loadThemeConfig]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (e.key === "1") {
        e.preventDefault();
        navigate("/");
      } else if (e.key === "2") {
        e.preventDefault();
        navigate("/repositories");
      } else if (e.key === "3") {
        e.preventDefault();
        navigate("/dispatches");
      } else if (e.key === "4") {
        e.preventDefault();
        navigate("/settings");
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("skill-vault:open-search"));
      }
    },
    [navigate],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (isLoading) {
    return (
      <>
        <GradientBackground />
        <div className="flex flex-col items-center justify-center h-screen">
          <div className="glass-card rounded-2xl p-8 flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-teal-600 animate-spin mb-4" />
            <p className="text-muted-foreground">加载中...</p>
          </div>
        </div>
      </>
    );
  }

  if (!basePath) {
    return (
      <>
        <GradientBackground />
        <Onboarding />
      </>
    );
  }

  return (
    <>
      <GradientBackground />
      <div className="min-h-screen">
        <Navigation />
        <main>
          <Routes>
            <Route path="/" element={<Skills />} />
            <Route path="/repositories" element={<Repositories />} />
            <Route path="/dispatches" element={<DispatchPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
        <Toaster />
      </div>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </ErrorBoundary>
  );
}

export default App;
