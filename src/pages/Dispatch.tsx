import { useEffect } from "react";
import { useDispatchStore } from "@/store/dispatchStore";
import { useSkillStore } from "@/store/skillStore";
import { DispatchMethod, SyncStatus } from "@/types/dispatch";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  FolderOpen,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Trash2,
} from "lucide-react";

const Badge = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <span
    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${className}`}
  >
    {children}
  </span>
);

const getStatusColor = (status: SyncStatus) => {
  switch (status) {
    case SyncStatus.Synced:
      return "bg-green-500/10 text-green-500 border-green-500/20";
    case SyncStatus.Outdated:
      return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    case SyncStatus.Conflict:
      return "bg-orange-500/10 text-orange-500 border-orange-500/20";
    case SyncStatus.Error:
      return "bg-red-500/10 text-red-500 border-red-500/20";
  }
};

const getStatusIcon = (status: SyncStatus) => {
  switch (status) {
    case SyncStatus.Synced:
      return <CheckCircle2 className="h-3 w-3 mr-1" />;
    case SyncStatus.Outdated:
      return <Clock className="h-3 w-3 mr-1" />;
    case SyncStatus.Conflict:
      return <AlertTriangle className="h-3 w-3 mr-1" />;
    case SyncStatus.Error:
      return <AlertCircle className="h-3 w-3 mr-1" />;
  }
};

const getMethodColor = (method: DispatchMethod) => {
  switch (method) {
    case DispatchMethod.Symlink:
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case DispatchMethod.Copy:
      return "bg-purple-500/10 text-purple-500 border-purple-500/20";
    case DispatchMethod.Hardlink:
      return "bg-gray-500/10 text-gray-500 border-gray-500/20";
  }
};

export function DispatchPage() {
  const {
    targetDirs,
    dispatches,
    loading,
    fetchTargetDirs,
    fetchDispatches,
    checkDispatchSync,
    syncDispatchedSkill,
  } = useDispatchStore();
  const { skills, fetchSkills } = useSkillStore();

  useEffect(() => {
    fetchTargetDirs().catch(() => {});
    fetchSkills().catch(() => {});
    fetchDispatches().catch(() => {});
  }, [fetchTargetDirs, fetchSkills, fetchDispatches]);

  const getSkillName = (skillId: string) => {
    const skill = skills.find((s) => s.id === skillId);
    return skill?.name || "Unknown Skill";
  };

  const getTargetDirName = (targetDirId: string) => {
    const dir = targetDirs.find((d) => d.id === targetDirId);
    return dir?.name || "Unknown Directory";
  };

  const handleSync = async (dispatchId: string) => {
    try {
      await checkDispatchSync(dispatchId);
      await syncDispatchedSkill(dispatchId);
      await fetchDispatches();
    } catch (error) {
      console.error("Failed to sync dispatch:", error);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dispatches</h1>
          <p className="text-gray-500">Manage your dispatched skills</p>
        </div>
        <Button onClick={fetchDispatches} disabled={loading}>
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {loading && dispatches.length === 0 && (
        <div className="flex justify-center items-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}

      {!loading && dispatches.length === 0 && (
        <div className="flex flex-col justify-center items-center py-20 text-center">
          <FolderOpen className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-xl font-medium mb-2">No dispatches yet</h3>
          <p className="text-gray-500 mb-6 max-w-md">
            You haven't dispatched any skills yet. Go to the Skills page and
            click "Dispatch" on any skill to get started.
          </p>
        </div>
      )}

      {dispatches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dispatches.map((dispatch) => (
            <Card
              key={dispatch.id}
              className="overflow-hidden hover:shadow-md transition-shadow"
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl font-semibold">
                    {getSkillName(dispatch.skill_id)}
                  </CardTitle>
                  <Badge className={getStatusColor(dispatch.sync_status)}>
                    {getStatusIcon(dispatch.sync_status)}
                    {dispatch.sync_status}
                  </Badge>
                </div>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Badge className={getMethodColor(dispatch.method)}>
                    {dispatch.method}
                  </Badge>
                  <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                    {getTargetDirName(dispatch.target_dir)}
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Target:</span>
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs break-all">
                      {dispatch.dest_path}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Source:</span>
                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs break-all">
                      {dispatch.source_path}
                    </code>
                  </div>
                  {dispatch.error_message && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded mt-2">
                      <p className="text-xs text-red-600">
                        {dispatch.error_message}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4 flex justify-between">
                <div className="text-xs text-gray-500">
                  Dispatched{" "}
                  {new Date(dispatch.dispatched_at).toLocaleDateString()}
                  {dispatch.last_synced_at && (
                    <span className="block mt-1">
                      Last synced{" "}
                      {new Date(dispatch.last_synced_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={
                      loading ||
                      dispatch.sync_status === SyncStatus.Conflict ||
                      dispatch.sync_status === SyncStatus.Error
                    }
                    onClick={() => handleSync(dispatch.id)}
                  >
                    <RefreshCw
                      className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
                    />
                    Sync
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    disabled
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
