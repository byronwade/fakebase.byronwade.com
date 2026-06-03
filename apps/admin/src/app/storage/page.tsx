"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  Download,
  Upload,
  Folder,
  FolderOpen,
  File,
  Globe,
  Lock,
  ChevronRight,
  HardDrive,
} from "lucide-react";
import { Modal } from "@/components/Modal";

// ---------------------------------------------------------------------------
// Types & fixture data
// ---------------------------------------------------------------------------

interface Bucket {
  id: string;
  name: string;
  public: boolean;
  created_at: string;
  file_count: number;
  size_bytes: number;
}

interface StorageObject {
  id: string;
  bucket_id: string;
  name: string;
  size: number;
  content_type: string;
  created_at: string;
  path: string;
}

const INITIAL_BUCKETS: Bucket[] = [
  {
    id: "avatars",
    name: "avatars",
    public: true,
    created_at: "2024-01-01T10:00:00Z",
    file_count: 3,
    size_bytes: 145000,
  },
  {
    id: "documents",
    name: "documents",
    public: false,
    created_at: "2024-01-02T11:00:00Z",
    file_count: 5,
    size_bytes: 2400000,
  },
  {
    id: "uploads",
    name: "uploads",
    public: false,
    created_at: "2024-01-03T12:00:00Z",
    file_count: 1,
    size_bytes: 50000,
  },
];

const INITIAL_OBJECTS: Record<string, StorageObject[]> = {
  avatars: [
    {
      id: "obj-001",
      bucket_id: "avatars",
      name: "alice.jpg",
      size: 48000,
      content_type: "image/jpeg",
      created_at: "2024-01-05T10:00:00Z",
      path: "alice.jpg",
    },
    {
      id: "obj-002",
      bucket_id: "avatars",
      name: "bob.png",
      size: 62000,
      content_type: "image/png",
      created_at: "2024-01-06T11:00:00Z",
      path: "bob.png",
    },
    {
      id: "obj-003",
      bucket_id: "avatars",
      name: "carol.webp",
      size: 35000,
      content_type: "image/webp",
      created_at: "2024-01-07T09:00:00Z",
      path: "carol.webp",
    },
  ],
  documents: [
    {
      id: "obj-004",
      bucket_id: "documents",
      name: "report-q1.pdf",
      size: 540000,
      content_type: "application/pdf",
      created_at: "2024-01-08T08:00:00Z",
      path: "2024/q1/report.pdf",
    },
    {
      id: "obj-005",
      bucket_id: "documents",
      name: "spec.docx",
      size: 128000,
      content_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      created_at: "2024-01-09T10:00:00Z",
      path: "specs/spec.docx",
    },
    {
      id: "obj-006",
      bucket_id: "documents",
      name: "data.csv",
      size: 8800,
      content_type: "text/csv",
      created_at: "2024-01-10T14:00:00Z",
      path: "exports/data.csv",
    },
    {
      id: "obj-007",
      bucket_id: "documents",
      name: "invoice-001.pdf",
      size: 95000,
      content_type: "application/pdf",
      created_at: "2024-01-11T09:30:00Z",
      path: "invoices/001.pdf",
    },
    {
      id: "obj-008",
      bucket_id: "documents",
      name: "logo.svg",
      size: 28000,
      content_type: "image/svg+xml",
      created_at: "2024-01-12T11:00:00Z",
      path: "assets/logo.svg",
    },
  ],
  uploads: [
    {
      id: "obj-009",
      bucket_id: "uploads",
      name: "test-upload.txt",
      size: 1024,
      content_type: "text/plain",
      created_at: "2024-01-13T15:00:00Z",
      path: "test-upload.txt",
    },
  ],
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// ---------------------------------------------------------------------------
// Create Bucket Modal
// ---------------------------------------------------------------------------

function CreateBucketModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (b: Bucket) => void;
}) {
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  function handleCreate() {
    onCreate({
      id: name,
      name,
      public: isPublic,
      created_at: new Date().toISOString(),
      file_count: 0,
      size_bytes: 0,
    });
    setName("");
    setIsPublic(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Bucket" size="sm">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">
            Bucket Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) =>
              setName(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))
            }
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
            placeholder="my-bucket"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-gray-300">
            Public bucket (files accessible without auth)
          </span>
        </label>
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-400 hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={!name}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
        >
          Create Bucket
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function StoragePage() {
  const [buckets, setBuckets] = useState<Bucket[]>(INITIAL_BUCKETS);
  const [objects, setObjects] =
    useState<Record<string, StorageObject[]>>(INITIAL_OBJECTS);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);
  const [createBucketOpen, setCreateBucketOpen] = useState(false);

  const currentObjects = selectedBucket ? (objects[selectedBucket] ?? []) : [];
  const filteredObjects =
    breadcrumb.length > 0
      ? currentObjects.filter((o) => o.path.startsWith(breadcrumb.join("/") + "/"))
      : currentObjects;

  function handleDeleteBucket(id: string) {
    setBuckets((b) => b.filter((x) => x.id !== id));
    if (selectedBucket === id) {
      setSelectedBucket(null);
      setBreadcrumb([]);
    }
  }

  function handleTogglePublic(id: string) {
    setBuckets((b) => b.map((x) => (x.id === id ? { ...x, public: !x.public } : x)));
  }

  function handleDeleteObject(objId: string) {
    if (!selectedBucket) return;
    setObjects((o) => ({
      ...o,
      [selectedBucket]: (o[selectedBucket] ?? []).filter((x) => x.id !== objId),
    }));
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedBucket || !e.target.files) return;
    const file = e.target.files[0];
    if (!file) return;
    const newObj: StorageObject = {
      id: `obj-${Date.now()}`,
      bucket_id: selectedBucket,
      name: file.name,
      size: file.size,
      content_type: file.type || "application/octet-stream",
      created_at: new Date().toISOString(),
      path: breadcrumb.length > 0 ? `${breadcrumb.join("/")}/${file.name}` : file.name,
    };
    setObjects((o) => ({
      ...o,
      [selectedBucket]: [...(o[selectedBucket] ?? []), newObj],
    }));
    e.target.value = "";
  }

  return (
    <div className="flex h-full">
      {/* Buckets sidebar */}
      <div className="w-56 border-r border-gray-800 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-300">Buckets</span>
          </div>
          <button
            onClick={() => setCreateBucketOpen(true)}
            className="p-1 text-gray-500 hover:text-white transition-colors rounded"
            title="Create bucket"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {buckets.map((bucket) => (
            <div
              key={bucket.id}
              className={`group flex items-center gap-2 px-3 py-2 mx-2 rounded-lg cursor-pointer transition-colors ${selectedBucket === bucket.id ? "bg-blue-600/15 text-blue-400" : "text-gray-400 hover:bg-gray-800 hover:text-white"}`}
              onClick={() => {
                setSelectedBucket(bucket.id);
                setBreadcrumb([]);
              }}
            >
              {selectedBucket === bucket.id ? (
                <FolderOpen className="h-4 w-4 flex-shrink-0" />
              ) : (
                <Folder className="h-4 w-4 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium">{bucket.name}</div>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  {bucket.public ? (
                    <Globe className="h-2.5 w-2.5 text-green-500" />
                  ) : (
                    <Lock className="h-2.5 w-2.5" />
                  )}
                  <span>{formatBytes(bucket.size_bytes)}</span>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteBucket(bucket.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-600 hover:text-red-400 transition-all rounded"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          {buckets.length === 0 && (
            <p className="px-4 py-6 text-xs text-gray-600 text-center">
              No buckets. Create one to get started.
            </p>
          )}
        </div>
      </div>

      {/* File browser */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedBucket ? (
          <>
            {/* Toolbar */}
            <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-1 text-sm text-gray-400">
                <span
                  className="hover:text-white cursor-pointer"
                  onClick={() => {
                    setBreadcrumb([]);
                  }}
                >
                  {selectedBucket}
                </span>
                {breadcrumb.map((seg, idx) => (
                  <span key={idx} className="flex items-center gap-1">
                    <ChevronRight className="h-3.5 w-3.5 text-gray-700" />
                    <span
                      className="hover:text-white cursor-pointer"
                      onClick={() => setBreadcrumb((b) => b.slice(0, idx + 1))}
                    >
                      {seg}
                    </span>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTogglePublic(selectedBucket)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 border border-gray-700 rounded-lg transition-colors"
                >
                  {buckets.find((b) => b.id === selectedBucket)?.public ? (
                    <>
                      <Globe className="h-3.5 w-3.5 text-green-400" /> Public
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" /> Private
                    </>
                  )}
                </button>
                <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer transition-colors">
                  <Upload className="h-3.5 w-3.5" />
                  Upload
                  <input type="file" onChange={handleUpload} className="sr-only" />
                </label>
              </div>
            </div>

            {/* File list */}
            <div className="flex-1 overflow-y-auto">
              {filteredObjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <HardDrive className="h-8 w-8 text-gray-700 mb-3" />
                  <p className="text-sm text-gray-500">No files in this bucket</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Upload a file to get started
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-900">
                      <th className="px-5 py-3 text-left font-medium text-gray-400">
                        Name
                      </th>
                      <th className="px-5 py-3 text-left font-medium text-gray-400">
                        Size
                      </th>
                      <th className="px-5 py-3 text-left font-medium text-gray-400">
                        Type
                      </th>
                      <th className="px-5 py-3 text-left font-medium text-gray-400">
                        Created
                      </th>
                      <th className="px-5 py-3 text-right font-medium text-gray-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {filteredObjects.map((obj) => (
                      <tr
                        key={obj.id}
                        className="hover:bg-gray-800/40 transition-colors"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2 text-gray-300">
                            <File className="h-4 w-4 text-gray-600 flex-shrink-0" />
                            <span className="font-mono text-xs">{obj.name}</span>
                          </div>
                          <div className="text-xs text-gray-600 font-mono pl-6">
                            {obj.path}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-400 font-mono">
                          {formatBytes(obj.size)}
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-400 font-mono">
                          {obj.content_type}
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-500">
                          {new Date(obj.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              className="p-1.5 text-gray-500 hover:text-blue-400 transition-colors rounded"
                              title="Download"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteObject(obj.id)}
                              className="p-1.5 text-gray-500 hover:text-red-400 transition-colors rounded"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-center">
            <Folder className="h-12 w-12 text-gray-700 mb-4" />
            <p className="text-gray-500 text-sm">Select a bucket to browse files</p>
            <p className="text-xs text-gray-600 mt-1">
              Or create a new bucket to get started
            </p>
          </div>
        )}
      </div>

      <CreateBucketModal
        open={createBucketOpen}
        onClose={() => setCreateBucketOpen(false)}
        onCreate={(b) => setBuckets((prev) => [...prev, b])}
      />
    </div>
  );
}
