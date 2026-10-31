"use client";

import { useEffect, useRef, useState } from "react";
import {
  SandpackCodeEditor,
  SandpackFileExplorer,
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { atomDark } from "@codesandbox/sandpack-themes";
import { RingLoader } from "react-spinners";
import {
  AlertTriangle,
  ArrowUp,
  Code2,
  Download,
  Eye,
  Loader2,
  Wand2,
} from "lucide-react";
import JSZip from "jszip";

import { FileData, StatusStep } from "@/types/workspace";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PricingModal from "./PricingModal";

const PLACEHOLDER_FILES = {
  "/App.js": {
    code: `
    export default function App() {
      return (
        <div style={{
          minHeight: "100vh",
          background: "#0a0a0a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
        }}>
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚡</div>
            <p style={{ fontSize: 14 }}>Your app will appear here</p>
          </div>
        </div>
      );
    }`,
  },
};

const BASE_DEPENDENCIES: Record<string, string> = {
  "react-is": "latest",
  "react-router-dom": "latest",
  "lucide-react": "latest",
  recharts: "latest",
  "date-fns": "latest",
  "framer-motion": "latest",
  "react-hook-form": "latest",
  "@hookform/resolvers": "latest",
  zod: "latest",
  "@radix-ui/react-dialog": "latest",
  "@radix-ui/react-dropdown-menu": "latest",
  "@radix-ui/react-tabs": "latest",
  "@radix-ui/react-tooltip": "latest",
  "@radix-ui/react-accordion": "latest",
  "@radix-ui/react-select": "latest",
  axios: "latest",
  clsx: "latest",
  "class-variance-authority": "latest",
  "tailwind-merge": "latest",
};

type ActiveTab = "preview" | "code";

interface CodePanelProps {
  fileData: FileData | null;
  appTitle: string | null;
  isProUser: boolean;
  statusLog: StatusStep[];
  isGenerating: boolean;
  isImproving: boolean;
  onImprove: (userRequest: string) => Promise<void>;
  onFixError: (error: string) => Promise<void>;
  onFilePatch: (patches: FileData) => void;
}

function SandpackContent({
  fileData,
  appTitle,
  isProUser,
  statusLog,
  isGenerating,
  isImproving,
  onImprove,
  onFixError,
  activeTab,
  setActiveTab,
}: {
  fileData: FileData | null;
  appTitle: string | null;
  isProUser: boolean;
  statusLog: StatusStep[];
  isGenerating: boolean;
  isImproving: boolean;
  onImprove: (userRequest: string) => Promise<void>;
  onFixError: (error: string) => Promise<void>;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}) {
  const { sandpack, listen } = useSandpack();

  const [previewError, setPreviewError] = useState<string | null>(null);
  const [improveInput, setImproveInput] = useState("");
  const [showImproveInput, setShowImproveInput] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const prevFilesRef = useRef<Record<string, { code: string }>>({});
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubscribeRef.current = listen((message) => {
      if (
        message.type === "action" &&
        "action" in message &&
        message.action === "show-error"
      ) {
        const errorMessage =
          "message" in message && typeof message.message === "string"
            ? message.message
            : "An error occurred in the preview.";
        setPreviewError(errorMessage);
        return;
      }

      // Compile error
      if (message.type === "compile" && "error" in message) {
        const errorMessage =
          "message" in message && typeof message.message === "string"
            ? message.message
            : "Compile error in preview";
        setPreviewError(errorMessage);
        return;
      }

      if (message.type === "success") {
        setPreviewError(null);
      }
    });
    return () => unsubscribeRef.current?.();
  }, [listen]);

  useEffect(() => {
    if (isGenerating) setPreviewError(null);
  }, [isGenerating]);

  useEffect(() => {
    if (!fileData?.files) return;

    const prev = prevFilesRef.current;

    for (const [path, { code }] of Object.entries(fileData.files)) {
      if (prev[path]?.code !== code) {
        sandpack.updateFile(path, code);
      }
    }

    prevFilesRef.current = fileData.files;
  }, [fileData?.files]);

  useEffect(() => {
    if (fileData) setActiveTab("preview");
  }, [fileData]);

  const handleImprove = async () => {
    const trimmedInput = improveInput.trim();
    if (!trimmedInput || isImproving) return;
    setImproveInput("");
    setShowImproveInput(false);
    await onImprove(trimmedInput);
  };

  const handleExportZip = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const filesToZip =
        Object.keys(sandpack.files).length > 0
          ? sandpack.files
          : (fileData?.files ?? {});
      const dependencies = {
        ...BASE_DEPENDENCIES,
        ...(fileData?.dependencies ?? {}),
      };

      const zip = new JSZip();

      zip.file(
        "package.json",
        JSON.stringify(
          {
            name: appTitle ?? "forge-agentic-app-builder",
            version: "1.0.0",
            private: true,
            dependencies: {
              react: "^18.2.0",
              "react-dom": "^18.2.0",
              "react-scripts": "5.0.1",
              ...dependencies,
            },
            scripts: {
              start: "react-scripts start",
              build: "react-scripts build",
            },
            browserslist: {
              production: [">0.2%", "not dead", "not op_mini all"],
              development: ["last 1 chrome version"],
            },
          },
          null,
          2,
        ),
      );

      zip.file(
        "public/index.html",
        `<!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>${appTitle ?? "forge-agentic-app-builder"}</title>
            <script src="https://cdn.tailwindcss.com"></script>
          </head>
          <body>
            <div id="root"></div>
          </body>
        </html>`,
      );

      for (const [filePath, fileObject] of Object.entries(filesToZip)) {
        const code =
          typeof fileObject === "object" &&
          fileObject !== null &&
          "code" in fileObject
            ? (fileObject as { code: string }).code
            : "";
        const zipPath = filePath.startsWith("/")
          ? `src${filePath}`
          : `src/${filePath}`;
        zip.file(zipPath, code);
      }

      zip.file(
        "src/index.js",
        `import React from 'react';
        import ReactDOM from 'react-dom/client';
        import App from './App';

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<React.StrictMode><App /></React.StrictMode>);`,
      );

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = appTitle
        ? `${appTitle
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")}.zip}`
        : "forge-agentic-app-builder.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as ActiveTab)}
      className="flex flex-col h-full gap-0"
    >
      <div className="flex justify-between items-center border-b border-white/6 px-2">
        <TabsList
          variant="line"
          className="bg-transparent rounded-none h-auto gap-0 p-0"
        >
          <TabsTrigger className="border-b-2 pt-2" value="code">
            <Code2 className="w-3.5 h-3.5" />
            Code
          </TabsTrigger>
          <TabsTrigger className="border-b-2 pt-2" value="preview">
            <Eye className="w-3.5 h-3.5" />
            Preview
          </TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-2">
          {isProUser ? (
            showImproveInput ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={improveInput}
                  onChange={(e) => setImproveInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleImprove();
                    if (e.key === "Escape") setShowImproveInput(false);
                  }}
                  placeholder="What should I improve ?"
                  className="w-52 h-7 bg-white/5 text-white/80 text-xs border border-white/10 rounded-lg px-3 placeholder:text-white/25 focus:border-white/20 focus:outline-none"
                />
                <Button
                  size="icon"
                  className="w-7 h-7 bg-white text-black rounded-lg hover:bg-white/90"
                  onClick={handleImprove}
                  disabled={!improveInput.trim() || isImproving}
                >
                  {isImproving ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <ArrowUp className="w-3 h-3" />
                  )}
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="text-white/40 text-xs h-7 gap-1.5 hover:text-white/70"
                onClick={() => setShowImproveInput(true)}
                disabled={isImproving || !fileData}
              >
                <Wand2 className="w-3.5 h-3.5" />
                {isImproving ? "Improving..." : "Improve with Agent"}
              </Button>
            )
          ) : (
            <PricingModal reason="upgrade">
              <span className="text-white/40 text-xs flex items-center gap-1.5 rounded-md cursor-pointer h-7 px-2 hover:text-white/70">
                <Wand2 className="w-3.5 h-3.5" />
                Improve with Agent
              </span>
            </PricingModal>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="text-white/40 text-xs gap-1.5 h-7 hover:text-white/70"
            onClick={handleExportZip}
            disabled={isExporting || !fileData}
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {(isGenerating || isImproving) && (
          <div className="absolute bg-[#0a0a0a]/85 flex flex-col justify-center items-center gap-6 backdrop-blur-sm inset-0 z-20 mb-40">
            <RingLoader color="#60a5fa" size={64} speedMultiplier={0.8} />
            <div className="flex flex-col items-center gap-1.5">
              <p className="text-white/60 text-sm font-medium">
                {isImproving
                  ? "Improving with AI Agent..."
                  : (statusLog[statusLog.length - 1]?.label ?? "Generating...")}
              </p>
            </div>
          </div>
        )}

        <SandpackLayout
          style={{
            height: "100vh",
            background: "transparent",
            border: "none",
            borderRadius: 0,
          }}
        >
          <TabsContent
            value="preview"
            keepMounted
            className="w-full h-full mt-0"
          >
            <SandpackPreview
              style={{ height: "89%" }}
              showOpenInCodeSandbox={false}
            />
          </TabsContent>

          <TabsContent
            value="code"
            keepMounted
            className="w-full h-full flex mt-0"
          >
            <SandpackFileExplorer
              style={{
                height: "90%",
                width: "180px",
                borderRight: "0.5px solid rgba(255,255,255,0.08)",
              }}
            />
            <SandpackCodeEditor
              style={{
                height: "90%",
                flex: 1,
              }}
              showTabs
              closableTabs
              showLineNumbers
              showInlineErrors
              readOnly
            />
          </TabsContent>
        </SandpackLayout>
      </div>

      {previewError &&
        !isGenerating &&
        !isImproving &&
        activeTab === "preview" && (
          <div className="absolute inset-x-0 -bottom-3 bg-red-950/99 border-t border-red-500/20 z-20 p-4 pb-6">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-400/70 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-red-400/80 text-xs font-medium">
                  Preview error
                </p>
                <p className="text-red-300/50 text-[11px] break-all">
                  {previewError}
                </p>
              </div>

              <Button
                size="sm"
                variant="destructive"
                onClick={() => onFixError(previewError)}
              >
                <Wand2 className="w-3 h-3" />
                Fix with AI
              </Button>
            </div>
          </div>
        )}
    </Tabs>
  );
}

export default function CodePanel({
  fileData,
  appTitle,
  isProUser,
  statusLog,
  isGenerating,
  isImproving,
  onImprove,
  onFixError,
  onFilePatch: _onFilePatch,
}: CodePanelProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("preview");

  const files = fileData?.files ?? PLACEHOLDER_FILES;
  const dependencies = {
    ...BASE_DEPENDENCIES,
    ...(fileData?.dependencies ?? {}),
  };

  const filePathKey = Object.keys(files).sort().join("|");

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <SandpackProvider
        key={filePathKey}
        template="react"
        theme={atomDark}
        files={files}
        customSetup={{ dependencies }}
        options={{
          externalResources: ["https://cdn.tailwindcss.com"],
          recompileMode: "delayed",
          recompileDelay: 500,
        }}
      >
        <SandpackContent
          fileData={fileData}
          appTitle={appTitle}
          isProUser={isProUser}
          statusLog={statusLog}
          isGenerating={isGenerating}
          isImproving={isImproving}
          onImprove={onImprove}
          onFixError={onFixError}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      </SandpackProvider>
    </div>
  );
}
