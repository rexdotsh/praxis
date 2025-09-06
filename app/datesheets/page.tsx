'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { toast } from 'sonner';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

type ParsedItem = { subject: string; examDate: string; syllabus?: string[] };

export default function DatesheetsPage() {
  const create = useMutation(api.datesheets.create);
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [title, setTitle] = useState('');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedItem[]>([]);

  async function onUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/blob/upload', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) throw new Error('upload failed');
      const data = (await res.json()) as { url: string };
      setFileUrl(data.url);
      toast.success('Uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function onParse() {
    if (!fileUrl) return;
    setParsing(true);
    try {
      const res = await fetch('/api/datesheets/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl }),
      });
      if (!res.ok) throw new Error('parse failed');
      const data = (await res.json()) as {
        parsed: { title?: string; items: ParsedItem[] };
      };
      setTitle(data.parsed.title ?? '');
      setRows(data.parsed.items);
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
      await create({
        title: title.trim() || 'Datesheet',
        sourceType,
        fileUrl: sourceType === 'upload' ? (fileUrl ?? undefined) : undefined,
        items: cleaned,
      });
      toast.success('Saved');
      // TODO(IST timezone): adjust any date handling if needed
      router.push('/dashboard');
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
    setRows((prev) => [...prev, { subject: '', examDate: '', syllabus: [] }]);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="mb-4 text-2xl font-semibold">Datesheets</h1>
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
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <div className="flex gap-2">
                    <Button onClick={onUpload} disabled={!file || uploading}>
                      {uploading ? 'Uploading…' : 'Upload'}
                    </Button>
                    <Button
                      onClick={onParse}
                      disabled={!fileUrl || parsing}
                      variant="secondary"
                    >
                      {parsing ? 'Parsing…' : 'Parse with AI'}
                    </Button>
                  </div>
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
                        <TableRow
                          key={`${r.subject}-${r.examDate}-${(r.syllabus ?? []).join('|')}`}
                        >
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
                                setRow(
                                  i,
                                  'syllabus',
                                  e.target.value.split('\n'),
                                )
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
                      <TableRow
                        key={`${r.subject}-${r.examDate}-${(r.syllabus ?? []).join('|')}`}
                      >
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
                  <Button size="sm" onClick={() => void onSave('manual')}>
                    Save datesheet
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
