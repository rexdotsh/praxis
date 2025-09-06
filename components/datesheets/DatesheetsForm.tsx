'use client';

import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ParsedItem = {
  id: string;
  subject: string;
  examDate: string;
  syllabus?: string[];
};

export default function DatesheetsForm({ onSaved }: { onSaved?: () => void }) {
  const create = useMutation(api.datesheets.create);
  const [selectedFiles, setSelectedFiles] = useState<Array<File>>([]);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [title, setTitle] = useState('');
  const [attachments, setAttachments] = useState<
    Array<{ url: string; name: string; contentType: string }>
  >([]);
  const [rows, setRows] = useState<ParsedItem[]>([]);

  function newId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  async function onUpload() {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    try {
      const uploaded: Array<{
        url: string;
        name: string;
        contentType: string;
      }> = [];
      for (const file of selectedFiles) {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/blob/upload', {
          method: 'POST',
          body: form,
        });
        if (!res.ok) throw new Error('upload failed');
        const data = (await res.json()) as { url: string };
        uploaded.push({
          url: data.url,
          name: file.name,
          contentType: file.type,
        });
      }
      setAttachments((prev) => [...prev, ...uploaded]);
      setSelectedFiles([]);
      toast.success(`Uploaded ${uploaded.length} file(s)`);
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function onParse() {
    if (attachments.length === 0) return;
    setParsing(true);
    try {
      const pdfUrls = attachments
        .filter(
          (a) =>
            a.contentType === 'application/pdf' ||
            a.name.toLowerCase().endsWith('.pdf'),
        )
        .map((a) => a.url);
      const imageUrls = attachments
        .filter(
          (a) =>
            a.contentType.startsWith('image/') &&
            !a.name.toLowerCase().endsWith('.pdf'),
        )
        .map((a) => a.url);
      const res = await fetch('/api/datesheets/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrls: pdfUrls, imageUrls }),
      });
      if (!res.ok) throw new Error('parse failed');
      const data = (await res.json()) as {
        parsed: { title?: string; items: Omit<ParsedItem, 'id'>[] };
      };
      setTitle(data.parsed.title ?? '');
      setRows(data.parsed.items.map((it) => ({ ...it, id: newId() })));
      toast.success('Parsed with AI');
    } catch {
      toast.error('Parse failed');
    } finally {
      setParsing(false);
    }
  }

  async function onSave(sourceType: 'upload' | 'manual') {
    try {
      const cleaned = rows
        .map((r) => ({
          subject: r.subject.trim(),
          examDate: r.examDate.trim(),
          syllabus: (r.syllabus ?? [])
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
        }))
        .filter((r) => r.subject && r.examDate);
      if (cleaned.length === 0) {
        toast.error('Add at least one valid row');
        return;
      }
      const primarySourceUrl = attachments[0]?.url;
      const finalTitle = title.trim();
      await create({
        title: finalTitle,
        sourceType,
        fileUrl:
          sourceType === 'upload' ? (primarySourceUrl ?? undefined) : undefined,
        items: cleaned,
      });
      toast.success('Saved');
      onSaved?.();
    } catch {
      toast.error('Save failed');
    }
  }

  function setRow<K extends keyof ParsedItem>(
    idx: number,
    key: K,
    value: ParsedItem[K],
  ) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)),
    );
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { id: newId(), subject: '', examDate: '', syllabus: [] },
    ]);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <Tabs defaultValue="upload">
      <TabsList>
        <TabsTrigger value="upload">Upload & AI Parse</TabsTrigger>
        <TabsTrigger value="manual">Manual Entry</TabsTrigger>
      </TabsList>

      <TabsContent value="upload">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3">
                <Input
                  type="file"
                  accept="application/pdf,image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.currentTarget.files ?? []);
                    if (files.length === 0) return;
                    setSelectedFiles((prev) => [...prev, ...files]);
                    e.currentTarget.value = '';
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={onUpload}
                    disabled={selectedFiles.length === 0 || uploading}
                  >
                    {uploading ? 'Uploading…' : 'Upload selected'}
                  </Button>
                  <Button
                    onClick={onParse}
                    disabled={attachments.length === 0 || parsing}
                    variant="secondary"
                  >
                    {parsing ? 'Parsing…' : 'Parse with AI'}
                  </Button>
                </div>
                {selectedFiles.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <div className="text-sm font-medium">
                      Selected files (not uploaded yet)
                    </div>
                    <ul className="space-y-1">
                      {selectedFiles.map((f, i) => (
                        <li
                          key={`${f.name}-${f.size}-${f.lastModified}`}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="truncate" title={f.name}>
                            {f.name}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setSelectedFiles((prev) =>
                                prev.filter((_, idx) => idx !== i),
                              )
                            }
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                    <div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedFiles([])}
                        disabled={uploading}
                      >
                        Clear selected
                      </Button>
                    </div>
                  </div>
                )}
                {attachments.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <div className="text-sm font-medium">Attached files</div>
                    <ul className="space-y-1">
                      {attachments.map((a, i) => (
                        <li
                          key={`${a.url}-${i}`}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate underline"
                            title={a.name}
                          >
                            {a.name}
                          </a>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              setAttachments((prev) =>
                                prev.filter((_, idx) => idx !== i),
                              )
                            }
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3">
                <Input
                  placeholder="Title (optional)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={parsing}
                />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Date (YYYY-MM-DD)</TableHead>
                      <TableHead>Syllabus (bullets)</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Input
                            value={r.subject}
                            onChange={(e) =>
                              setRow(i, 'subject', e.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={r.examDate}
                            onChange={(e) =>
                              setRow(i, 'examDate', e.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Textarea
                            placeholder="One point per line"
                            value={(r.syllabus ?? []).join('\n')}
                            onChange={(e) =>
                              setRow(i, 'syllabus', e.target.value.split('\n'))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeRow(i)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={addRow} variant="secondary">
                    Add row
                  </Button>
                  <Button size="sm" onClick={() => void onSave('upload')}>
                    Save datesheet
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="manual">
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              <Input
                placeholder="Title (optional)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Date (YYYY-MM-DD)</TableHead>
                    <TableHead>Syllabus (bullets)</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Input
                          value={r.subject}
                          onChange={(e) => setRow(i, 'subject', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.examDate}
                          onChange={(e) =>
                            setRow(i, 'examDate', e.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Textarea
                          placeholder="One point per line"
                          value={(r.syllabus ?? []).join('\n')}
                          onChange={(e) =>
                            setRow(i, 'syllabus', e.target.value.split('\n'))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeRow(i)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={addRow} variant="secondary">
                  Add row
                </Button>
                <Button size="sm" onClick={() => void onSave('manual')}>
                  Save datesheet
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
