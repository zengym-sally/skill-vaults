import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Brain,
  GitBranch,
  RefreshCw,
  Palette,
  Database,
  Download,
  Upload,
  Save,
} from "lucide-react";
import { useSettingsStore, SyncConfig } from "@/store/settingsStore";
import { LLMConfig } from "@/types/llm";
import { GitConfig } from "@/types/git";

export function SettingsPage() {
  const {
    llmConfig,
    gitConfig,
    syncConfig,
    isLoading,
    loadLLMConfig,
    saveLLMConfig,
    loadGitConfig,
    saveGitConfig,
    loadSyncConfig,
    saveSyncConfig,
  } = useSettingsStore();
  const [llmFormData, setLlmFormData] = useState<LLMConfig>({
    apiKey: "",
    baseUrl: "",
    model: "gpt-4o",
  });
  const [gitFormData, setGitFormData] = useState<GitConfig>({
    username: "",
    email: "",
    sshKeyPath: "",
  });
  const [syncFormData, setSyncFormData] = useState<SyncConfig>({
    autoSyncEnabled: false,
    syncInterval: "daily",
  });

  useEffect(() => {
    loadLLMConfig();
    loadGitConfig();
    loadSyncConfig();
  }, [loadLLMConfig, loadGitConfig, loadSyncConfig]);

  useEffect(() => {
    if (llmConfig) {
      setLlmFormData(llmConfig);
    }
  }, [llmConfig]);

  useEffect(() => {
    if (gitConfig) {
      setGitFormData(gitConfig);
    }
  }, [gitConfig]);

  useEffect(() => {
    if (syncConfig) {
      setSyncFormData(syncConfig);
    }
  }, [syncConfig]);

  const handleLlmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveLLMConfig(llmFormData);
      toast.success("LLM configuration saved successfully");
    } catch (error) {
      toast.error(`Failed to save configuration: ${(error as Error).message}`);
    }
  };

  const handleGitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveGitConfig(gitFormData);
      toast.success("Git configuration saved successfully");
    } catch (error) {
      toast.error(
        `Failed to save Git configuration: ${(error as Error).message}`,
      );
    }
  };

  const handleSyncSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveSyncConfig(syncFormData);
      toast.success("Sync configuration saved successfully");
    } catch (error) {
      toast.error(
        `Failed to save Sync configuration: ${(error as Error).message}`,
      );
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-gray-500">Configure your SkillVault preferences</p>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-500" />
              <CardTitle>LLM Configuration</CardTitle>
            </div>
            <CardDescription>
              Configure your language model providers and API keys
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLlmSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select defaultValue="openai" disabled>
                  <SelectTrigger id="provider">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI / Compatible</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Currently only OpenAI-compatible APIs are supported
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="sk-..."
                  value={llmFormData.apiKey}
                  onChange={(e) =>
                    setLlmFormData({ ...llmFormData, apiKey: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL (Optional)</Label>
                <Input
                  id="baseUrl"
                  placeholder="https://api.openai.com/v1"
                  value={llmFormData.baseUrl || ""}
                  onChange={(e) =>
                    setLlmFormData({
                      ...llmFormData,
                      baseUrl: e.target.value || undefined,
                    })
                  }
                />
                <p className="text-xs text-gray-500">
                  Leave empty for default OpenAI API, or enter your custom
                  endpoint for other providers
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  placeholder="gpt-4o"
                  value={llmFormData.model}
                  onChange={(e) =>
                    setLlmFormData({ ...llmFormData, model: e.target.value })
                  }
                  required
                />
                <p className="text-xs text-gray-500">
                  e.g. gpt-4o, gpt-3.5-turbo, claude-3-opus (for compatible
                  providers)
                </p>
              </div>

              <Button type="submit" disabled={isLoading}>
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? "Saving..." : "Save Configuration"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-purple-500" />
              <CardTitle>Git Configuration</CardTitle>
            </div>
            <CardDescription>
              Set up Git global credentials for repository operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGitSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gitUsername">Global Username</Label>
                <Input
                  id="gitUsername"
                  placeholder="John Doe"
                  value={gitFormData.username}
                  onChange={(e) =>
                    setGitFormData({ ...gitFormData, username: e.target.value })
                  }
                  required
                />
                <p className="text-xs text-gray-500">
                  This will be used as the commit author name for all Git
                  operations
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gitEmail">Global Email</Label>
                <Input
                  id="gitEmail"
                  type="email"
                  placeholder="john@example.com"
                  value={gitFormData.email}
                  onChange={(e) =>
                    setGitFormData({ ...gitFormData, email: e.target.value })
                  }
                  required
                />
                <p className="text-xs text-gray-500">
                  This will be used as the commit author email for all Git
                  operations
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sshKeyPath">SSH Key Path (Optional)</Label>
                <Input
                  id="sshKeyPath"
                  placeholder="~/.ssh/id_rsa"
                  value={gitFormData.sshKeyPath || ""}
                  onChange={(e) =>
                    setGitFormData({
                      ...gitFormData,
                      sshKeyPath: e.target.value || undefined,
                    })
                  }
                />
                <p className="text-xs text-gray-500">
                  Path to your private SSH key for Git authentication. Leave
                  empty to use system default.
                </p>
              </div>

              <Button type="submit" disabled={isLoading}>
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? "Saving..." : "Save Git Configuration"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-green-500" />
              <CardTitle>Sync Strategy</CardTitle>
            </div>
            <CardDescription>
              Configure how skills are synced and updated
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSyncSubmit} className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-sync">Auto Sync</Label>
                  <p className="text-sm text-gray-500">
                    Automatically sync all repositories on a schedule
                  </p>
                </div>
                <Input
                  id="auto-sync"
                  type="checkbox"
                  checked={syncFormData.autoSyncEnabled}
                  onChange={(e) =>
                    setSyncFormData({
                      ...syncFormData,
                      autoSyncEnabled: e.target.checked,
                    })
                  }
                  className="w-5 h-5"
                />
              </div>

              {syncFormData.autoSyncEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="sync-interval">Sync Interval</Label>
                  <Select
                    value={syncFormData.syncInterval}
                    onValueChange={(
                      value: "daily" | "weekly" | "monthly" | "never",
                    ) =>
                      setSyncFormData({ ...syncFormData, syncInterval: value })
                    }
                  >
                    <SelectTrigger id="sync-interval">
                      <SelectValue placeholder="Select interval" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    How often to automatically sync all repositories
                  </p>
                </div>
              )}

              <Button type="submit" disabled={isLoading}>
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? "Saving..." : "Save Sync Configuration"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-orange-500" />
              <CardTitle>Theme & Language</CardTitle>
            </div>
            <CardDescription>
              Customize the appearance and language of SkillVault
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              Theme and language settings will be available here in a future
              update.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-red-500" />
              <CardTitle>Backup & Restore</CardTitle>
            </div>
            <CardDescription>
              Backup your skill library and restore from backups
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Button>
                <Download className="mr-2 h-4 w-4" />
                Create Backup
              </Button>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Restore Backup
              </Button>
            </div>
            <p className="text-sm text-gray-500">
              Full backup and restore functionality coming soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
