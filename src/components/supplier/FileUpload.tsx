'use client';
import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { registerOrderFile } from '@/app/actions/supplier';
import { toast } from './Feedback';

const BUCKET = 'order-files';

// Upload a file to the private order-files bucket under the order's folder.
// Storage RLS only allows suppliers to write inside their own orders' paths.
export async function uploadToOrder(orderId: string, file: File): Promise<{ path?: string; error?: string }> {
  const supabase = createClient();
  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `orders/${orderId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) return { error: error.message };
  return { path };
}

// Button-styled uploader that stores the file and registers it against the order.
export function FileUpload({
  orderId, fileType, label, onUploaded, multiple = false,
}: {
  orderId: string; fileType: string; label: string;
  onUploaded?: (path: string, name: string) => void; multiple?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      const { path, error } = await uploadToOrder(orderId, file);
      if (error || !path) { toast(`Upload failed: ${error}`, false); continue; }
      const res = await registerOrderFile(orderId, fileType, path);
      if (res.error) { toast(`Could not save file: ${res.error}`, false); continue; }
      toast(`Uploaded ${file.name}`);
      onUploaded?.(path, file.name);
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <span>
      <input
        ref={inputRef} type="file" className="hidden" multiple={multiple}
        accept="image/*,application/pdf"
        onChange={(e) => onFiles(e.target.files)}
      />
      <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? 'Uploading…' : label}
      </button>
    </span>
  );
}
