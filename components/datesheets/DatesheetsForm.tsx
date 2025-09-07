'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { toast } from 'sonner';
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
import {
  UploadCloud,
  FileText,
  X as IconX,
  Plus,
  Save as IconSave,
  Sparkles,
  Calendar,
  Eye,
  Clock,
  ChevronDown,
  ChevronRight,
  Trash2,
} from 'lucide-react';

type ParsedItem = {
  id: string;
  subject: string;
  examDate: string;
  syllabus?: string[];
};

export default function DatesheetsForm({ onSaved }: { onSaved?: () => void }) {
  const create = useMutation(api.datesheets.create);
  const removeExam = useMutation(api.datesheets.removeExam);
  const upcomingItems =
    useQuery(api.datesheets.listUpcomingItemsByUser, { limit: 20 }) ?? [];
  const datesheets = useQuery(api.datesheets.listByUser) ?? [];

  const [viewMode, setViewMode] = useState<'create' | 'view'>('view');
  const [title, setTitle] = useState('');
  const [attachments, setAttachments] = useState<
    Array<{ url: string; name: string; contentType: string }>
  >([]);
  const [rows, setRows] = useState<ParsedItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [expandedExam, setExpandedExam] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function newId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  async function handleFiles(files: Array<File>) {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: Array<{
        url: string;
        name: string;
        contentType: string;
      }> = [];
      for (const file of files) {
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
      toast.success(`Uploaded ${uploaded.length} file(s)`);
      await parseFromCurrentAttachments([...attachments, ...uploaded]);
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function parseFromCurrentAttachments(
    list: Array<{ url: string; name: string; contentType: string }>,
  ) {
    if (list.length === 0) return;
    setParsing(true);
    try {
      const pdfUrls = list
        .filter(
          (a) =>
            a.contentType === 'application/pdf' ||
            a.name.toLowerCase().endsWith('.pdf'),
        )
        .map((a) => a.url);
      const imageUrls = list
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
      setTitle((prev) =>
        prev.trim().length === 0 ? (data.parsed.title ?? '') : prev,
      );
      setRows(data.parsed.items.map((it) => ({ ...it, id: newId() })));
      toast.success('Parsed with AI');
    } catch {
      toast.error('Parse failed');
    } finally {
      setParsing(false);
    }
  }

  async function onSave() {
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
      await create({
        title: title.trim(),
        sourceType: attachments.length > 0 ? 'upload' : 'manual',
        fileUrl:
          attachments.length > 0 ? (primarySourceUrl ?? undefined) : undefined,
        items: cleaned,
      });
      toast.success('Saved');
      setViewMode('view');
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

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  const hasAnyRows = rows.length > 0;
  const today = new Date().toISOString().slice(0, 10);
  const nextExam = (() => {
    const all = datesheets.flatMap((d) =>
      d.firstExamDate ? [{ title: d.title, date: d.firstExamDate }] : [],
    );
    return all
      .filter((x) => x.date >= today)
      .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  })();

  if (viewMode === 'view') {
    return (
      <div className="flex h-full flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">Upcoming exams</div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Datesheets</span>
              <span className="text-lg font-semibold tabular-nums">
                {datesheets.length}
              </span>
            </div>
            {nextExam && (
              <div className="text-sm">
                Next: {nextExam.title} on {nextExam.date}
              </div>
            )}
          </div>
          <Button size="sm" onClick={() => setViewMode('create')}>
            <Plus className="mr-1 h-4 w-4" /> Create new
          </Button>
        </div>

        {/* Upcoming exams list */}
        <div className="flex-1 min-h-0">
          {upcomingItems.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center">
              <div className="rounded-full bg-muted/50 p-3 mb-4">
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-lg font-semibold mb-2">
                No upcoming exams
              </div>
              <div className="text-sm text-muted-foreground mb-6 max-w-sm">
                Create a datesheet to track your exam schedule and see upcoming
                exams here.
              </div>
              <Button onClick={() => setViewMode('create')}>
                <Plus className="mr-2 h-4 w-4" /> Create your first datesheet
              </Button>
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <div className="space-y-3">
                {upcomingItems
                  .slice()
                  .reverse()
                  .map((item) => {
                    const isExpanded =
                      expandedExam === `${item.datesheetId}-${item.examDate}`;
                    const label =
                      item.title && item.title !== item.subject
                        ? `${item.title}: ${item.subject}`
                        : item.subject;

                    // Calculate days until exam
                    const examDate = new Date(item.examDate);
                    const today = new Date();
                    const diffTime = examDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(
                      diffTime / (1000 * 60 * 60 * 24),
                    );

                    const isToday = diffDays === 0;
                    const isTomorrow = diffDays === 1;
                    const isOverdue = diffDays < 0;

                    let dateDisplay = item.examDate;
                    let dateColor = 'text-muted-foreground';

                    if (isToday) {
                      dateDisplay = 'Today';
                      dateColor = 'text-red-600 font-semibold';
                    } else if (isTomorrow) {
                      dateDisplay = 'Tomorrow';
                      dateColor = 'text-orange-600 font-semibold';
                    } else if (isOverdue) {
                      dateDisplay = `${Math.abs(diffDays)} days ago`;
                      dateColor = 'text-muted-foreground line-through';
                    } else if (diffDays <= 7) {
                      dateDisplay = `${diffDays} day${diffDays === 1 ? '' : 's'}`;
                      dateColor = 'text-yellow-600 font-medium';
                    } else if (diffDays <= 30) {
                      dateDisplay = `${diffDays} days`;
                      dateColor = 'text-blue-600';
                    }

                    return (
                      <div
                        key={`${item.datesheetId}-${item.examDate}`}
                        className={`rounded-lg border-2 transition-all ${
                          isToday
                            ? 'border-red-200 bg-red-50/50'
                            : isTomorrow
                              ? 'border-orange-200 bg-orange-50/50'
                              : diffDays <= 7
                                ? 'border-yellow-200 bg-yellow-50/50'
                                : 'border-border bg-card hover:border-border/80'
                        }`}
                      >
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 rounded-lg transition-colors"
                          onClick={() =>
                            setExpandedExam((prev) =>
                              prev === `${item.datesheetId}-${item.examDate}`
                                ? null
                                : `${item.datesheetId}-${item.examDate}`,
                            )
                          }
                        >
                          <div className="flex-shrink-0">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div
                              className="font-semibold text-base truncate mb-1"
                              title={label}
                            >
                              {label}
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Clock className="h-3 w-3" />
                              <span className={dateColor}>{dateDisplay}</span>
                            </div>
                          </div>

                          <div className="flex-shrink-0">
                            {item.syllabus.length > 0 && (
                              <div className="text-xs bg-muted px-2 py-1 rounded-full">
                                {item.syllabus.length} topic
                                {item.syllabus.length === 1 ? '' : 's'}
                              </div>
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-border/50 pt-3 mt-1">
                            {item.syllabus.length > 0 ? (
                              <div className="mb-4">
                                <div className="text-sm font-medium mb-2 text-muted-foreground">
                                  Syllabus Topics
                                </div>
                                <div className="grid gap-2">
                                  {item.syllabus.map((s, idx) => (
                                    <div
                                      key={s}
                                      className="flex items-start gap-2 text-sm p-2 rounded-md bg-muted/30"
                                    >
                                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="text-xs font-medium text-primary">
                                          {idx + 1}
                                        </span>
                                      </div>
                                      <span className="flex-1">{s}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground mb-4 italic">
                                No syllabus topics specified
                              </div>
                            )}

                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm(`Delete exam for ${label}?`)) {
                                    await removeExam({
                                      datesheetId: item.datesheetId,
                                      subject: item.subject,
                                      examDate: item.examDate,
                                    });
                                  }
                                }}
                                className="text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground"
                              >
                                <Trash2 className="mr-2 h-3 w-3" />
                                Delete exam
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Header with upload area and controls */}
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setViewMode('view')}
          className="shrink-0"
        >
          <Eye className="mr-1 h-4 w-4" /> View exams
        </Button>
        {/* Compact upload area */}
        <div
          className={`flex-1 rounded-md border-2 border-dashed p-3 text-center transition-colors ${dragActive ? 'border-primary/70 bg-primary/5' : 'border-muted-foreground/30 hover:border-muted-foreground'}`}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragActive(false);
          }}
          onDrop={async (e) => {
            e.preventDefault();
            setDragActive(false);
            const files = Array.from(e.dataTransfer.files ?? []);
            await handleFiles(files);
          }}
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ')
              fileInputRef.current?.click();
          }}
        >
          <div className="flex items-center gap-3">
            <UploadCloud className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Upload datesheet</div>
              <div className="text-xs text-muted-foreground">
                PDF or image files
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={uploading || parsing}
            >
              {uploading ? 'Uploading…' : parsing ? 'Parsing…' : 'Browse'}
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = Array.from(e.currentTarget.files ?? []);
              e.currentTarget.value = '';
              await handleFiles(files);
            }}
          />
        </div>

        {/* Title and actions */}
        <Input
          className="w-48"
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={parsing}
        />
        <Button variant="secondary" size="sm" onClick={addRow}>
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
        <Button
          size="sm"
          onClick={() => void onSave()}
          disabled={uploading || parsing}
        >
          <IconSave className="mr-1 h-4 w-4" /> Save
        </Button>
      </div>

      {/* Attached files (if any) */}
      {attachments.length > 0 && (
        <div className="rounded-md border p-2">
          <div className="flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <div
                key={`${a.url}-${i}`}
                className="flex items-center gap-2 rounded bg-muted px-2 py-1 text-xs"
              >
                <FileText className="h-3 w-3" />
                <span className="max-w-24 truncate" title={a.name}>
                  {a.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="hover:text-destructive"
                >
                  <IconX className="h-3 w-3" />
                </button>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              disabled={parsing}
              onClick={() => void parseFromCurrentAttachments(attachments)}
              className="h-6 px-2 text-xs"
            >
              <Sparkles className="mr-1 h-3 w-3" /> Re-parse
            </Button>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 min-h-0">
        {!hasAnyRows ? (
          <div className="flex h-full flex-col items-center justify-center rounded-md border p-6 text-center">
            <FileText className="mb-2 h-8 w-8 text-muted-foreground" />
            <div className="text-base font-medium">No subjects added yet</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Upload a datesheet to auto-fill, or add rows manually.
            </div>
            <div className="mt-4">
              <Button variant="secondary" onClick={addRow}>
                <Plus className="mr-2 h-4 w-4" /> Add first row
              </Button>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/4">Subject</TableHead>
                  <TableHead className="w-32">Date</TableHead>
                  <TableHead>Syllabus</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell className="p-2">
                      <Input
                        value={r.subject}
                        onChange={(e) => setRow(i, 'subject', e.target.value)}
                        placeholder="Subject"
                        className="h-8 border border-input bg-background px-2 text-sm"
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        value={r.examDate}
                        onChange={(e) => setRow(i, 'examDate', e.target.value)}
                        placeholder="YYYY-MM-DD"
                        className="h-8 border border-input bg-background px-2 text-sm"
                      />
                    </TableCell>
                    <TableCell className="p-2 align-top">
                      <Textarea
                        placeholder="One point per line"
                        value={(r.syllabus ?? []).join('\n')}
                        onChange={(e) =>
                          setRow(i, 'syllabus', e.target.value.split('\n'))
                        }
                        className="min-h-16 border border-input bg-background px-2 py-1 text-sm resize-none"
                      />
                    </TableCell>
                    <TableCell className="p-2 align-top">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeRow(i)}
                        className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                      >
                        <IconX className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
