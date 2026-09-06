import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Calendar, 
  Tag, 
  Trash2, 
  GitFork, 
  List, 
  Clock, 
  Download,
  BookOpen,
  ArrowUpRight,
  Filter,
  FileCode,
  FileArchive,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import JSZip from 'jszip';
import Markdown from 'react-markdown';
import { JournalEntry, MoodType } from '../types';

interface HistoryListProps {
  entries: JournalEntry[];
  currentEntryId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onDeleteEntry: (entryId: string) => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({
  entries,
  currentEntryId,
  onSelectEntry,
  onDeleteEntry,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMood, setSelectedMood] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'linked' | 'markdown'>('list');
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [previewEntry, setPreviewEntry] = useState<JournalEntry | null>(null);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (entry.summary && entry.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
        entry.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesMood = selectedMood === 'all' || entry.mood === selectedMood;
      const matchesTag = !selectedTag || entry.tags.includes(selectedTag);

      return matchesSearch && matchesMood && matchesTag;
    });
  }, [entries, searchQuery, selectedMood, selectedTag]);

  // Extract all unique tags with count
  const allTagsWithCount = useMemo(() => {
    const counts: Record<string, number> = {};
    entries.forEach((e) => {
      e.tags.forEach((t) => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  // Group entries by tag for Linked Notes View
  const tagGroups = useMemo(() => {
    const groups: Record<string, JournalEntry[]> = {};
    filteredEntries.forEach((entry) => {
      entry.tags.forEach((tag) => {
        if (!groups[tag]) groups[tag] = [];
        groups[tag].push(entry);
      });
    });
    return groups;
  }, [filteredEntries]);

  // Helper to compute related entries based on shared tags/themes
  const getRelatedEntries = (targetEntry: JournalEntry): { entry: JournalEntry; sharedTags: string[] }[] => {
    if (!targetEntry.tags || targetEntry.tags.length === 0) return [];
    const targetTagSet = new Set(targetEntry.tags);
    return entries
      .filter((e) => e.id !== targetEntry.id)
      .map((e) => {
        const shared = e.tags.filter((t) => targetTagSet.has(t));
        return { entry: e, sharedTags: shared };
      })
      .filter((item) => item.sharedTags.length > 0)
      .sort((a, b) => b.sharedTags.length - a.sharedTags.length);
  };

  // Helper to generate full Obsidian-compatible Markdown document with See Also links
  const generateMarkdownDocument = (entry: JournalEntry): string => {
    const dateStr = new Date(entry.createdAt).toISOString().split('T')[0];
    const related = getRelatedEntries(entry);

    let md = `# ${entry.title || 'Untitled Reflection'}\n`;
    md += `*Date: ${new Date(entry.createdAt).toLocaleString()} | Mood: ${entry.mood}*\n`;
    md += `*Tags: ${entry.tags.map((t) => `#${t}`).join(' ')}*\n\n`;
    md += `---\n\n`;
    md += `## Reflection\n${entry.content}\n\n`;

    if (entry.summary) {
      md += `## Summary\n${entry.summary}\n\n`;
    }

    if (entry.messages && entry.messages.length > 0) {
      md += `## AI Introspective Dialogue\n`;
      entry.messages.forEach((m) => {
        const speaker = m.role === 'model' ? 'Aura (Gemini Companion)' : 'You';
        md += `**${speaker}:**\n${m.content}\n\n`;
      });
    }

    if (entry.extractedTasks && entry.extractedTasks.length > 0) {
      md += `## Extracted Tasks\n`;
      entry.extractedTasks.forEach((t) => {
        md += `- [${t.completed ? 'x' : ' '}] ${t.title} (${t.priority})\n`;
      });
      md += `\n`;
    }

    // Directive 17: See also cross-links computed from stored tag/theme metadata
    if (related.length > 0) {
      md += `## See also\n`;
      related.forEach(({ entry: rel, sharedTags }) => {
        const relDate = new Date(rel.createdAt).toISOString().split('T')[0];
        const relSlug = `${relDate}-${(rel.title || 'entry').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        md += `- [[${relSlug}|${rel.title || 'Untitled'}]] (shared: ${sharedTags.map((t) => `#${t}`).join(', ')}) — [Link](${relSlug}.md)\n`;
      });
      md += `\n`;
    }

    return md;
  };

  // Download single markdown
  const handleDownloadMarkdown = (e: React.MouseEvent, entry: JournalEntry) => {
    e.stopPropagation();
    const dateStr = new Date(entry.createdAt).toISOString().split('T')[0];
    const mdContent = generateMarkdownDocument(entry);
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${dateStr}-${(entry.title || 'entry').toLowerCase().replace(/\s+/g, '-')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Directive 17: "Export my journal as Markdown files" - download .zip of all entries as linked markdown files
  const handleExportZip = async () => {
    if (entries.length === 0) {
      alert('No journal entries to export.');
      return;
    }

    try {
      setIsExportingZip(true);
      const zip = new JSZip();

      // Create folder or root files
      const journalFolder = zip.folder('journal') || zip;

      // Table of contents
      let indexMd = `# Journal Vault Index\n\n`;
      indexMd += `*Exported on ${new Date().toLocaleString()}*\n`;
      indexMd += `*Total Reflections: ${entries.length}*\n\n`;
      indexMd += `## Timeline\n`;

      entries.forEach((entry) => {
        const dateStr = new Date(entry.createdAt).toISOString().split('T')[0];
        const slug = `${dateStr}-${(entry.title || 'entry').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        const filename = `${slug}.md`;
        const mdContent = generateMarkdownDocument(entry);

        journalFolder.file(filename, mdContent);
        indexMd += `- [[${slug}|${entry.title || 'Untitled'}]] (${dateStr}) - ${entry.tags.map((t) => `#${t}`).join(' ')}\n`;
      });

      // Add index.md
      journalFolder.file('index.md', indexMd);

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `journal-markdown-vault-${new Date().toISOString().split('T')[0]}.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExportingZip(false);
    }
  };

  const getMoodBadgeColor = (mood: MoodType) => {
    switch (mood) {
      case 'reflective':
        return 'bg-amber-950/40 text-amber-300 border-amber-800/50';
      case 'energized':
        return 'bg-orange-950/40 text-orange-300 border-orange-800/50';
      case 'calm':
        return 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50';
      case 'creative':
        return 'bg-purple-950/40 text-purple-300 border-purple-800/50';
      case 'grateful':
        return 'bg-rose-950/40 text-rose-300 border-rose-800/50';
      case 'focused':
        return 'bg-blue-950/40 text-blue-300 border-blue-800/50';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  const activeMarkdownEntry = previewEntry || (currentEntryId ? entries.find((e) => e.id === currentEntryId) : entries[0]);

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-widest">
            Archive ({entries.length})
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Export Zip Button */}
          <button
            id="export-zip-btn"
            onClick={handleExportZip}
            disabled={isExportingZip || entries.length === 0}
            className="px-2.5 py-1 text-xs font-medium rounded-xl border border-zinc-700 hover:border-zinc-600 bg-zinc-900 text-zinc-300 hover:text-zinc-100 flex items-center gap-1.5 transition-all disabled:opacity-40"
            title="Export entire journal as Obsidian-compatible linked Markdown vault (.zip)"
          >
            <FileArchive className="w-3.5 h-3.5 text-amber-400" />
            <span>{isExportingZip ? 'Packing ZIP...' : 'Export .ZIP'}</span>
          </button>

          {/* View Mode Switcher */}
          <div className="inline-flex p-0.5 bg-zinc-900 rounded-xl border border-zinc-800">
            <button
              id="view-mode-list-btn"
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'list'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Timeline</span>
            </button>
            <button
              id="view-mode-linked-btn"
              onClick={() => setViewMode('linked')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'linked'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Obsidian-inspired linked theme connections"
            >
              <GitFork className="w-3.5 h-3.5 text-amber-400" />
              <span>Linked</span>
            </button>
            <button
              id="view-mode-markdown-btn"
              onClick={() => setViewMode('markdown')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'markdown'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="View formatted Markdown with cross-linked wikilinks"
            >
              <FileCode className="w-3.5 h-3.5 text-blue-400" />
              <span>Markdown</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
          <input
            id="search-entries-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reflections, tags, or topics..."
            className="w-full pl-9 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Clear
            </button>
          )}
        </div>

        {/* Tag Pills Filter */}
        {allTagsWithCount.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider flex items-center gap-1 shrink-0">
              <Filter className="w-3 h-3" />
              Tags:
            </span>
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-2 py-0.5 rounded-full text-[11px] shrink-0 border transition-all ${
                selectedTag === null
                  ? 'bg-zinc-100 text-black font-bold border-zinc-100'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
              }`}
            >
              All
            </button>
            {allTagsWithCount.slice(0, 10).map(([tag, count]) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-2 py-0.5 rounded-full text-[11px] shrink-0 border transition-all flex items-center gap-1 ${
                  selectedTag === tag
                    ? 'bg-zinc-100 text-black font-bold border-zinc-100'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                }`}
              >
                <span>#{tag}</span>
                <span className="opacity-60 text-[9px]">({count})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mode 1: List View */}
      {viewMode === 'list' && (
        <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
          {filteredEntries.length === 0 ? (
            <div className="p-8 text-center bg-[#0F0F0F] border border-zinc-800 rounded-2xl">
              <p className="text-xs text-zinc-500">
                {entries.length === 0
                  ? 'Your journal archive is currently empty. Write your first reflection!'
                  : 'No entries match your search criteria.'}
              </p>
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const isSelected = entry.id === currentEntryId;
              const dateStr = new Date(entry.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <div
                  key={entry.id}
                  onClick={() => onSelectEntry(entry)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-zinc-800/80 border-zinc-600 shadow-md'
                      : 'bg-[#0F0F0F] hover:bg-zinc-900 border-zinc-800 hover:border-zinc-700 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h4 className="font-semibold text-zinc-100 text-sm leading-snug line-clamp-1 tracking-tight">
                      {entry.title || 'Untitled Reflection'}
                    </h4>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => handleDownloadMarkdown(e, entry)}
                        className="p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-md transition-colors"
                        title="Download Markdown"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Are you sure you want to delete this reflection?')) {
                            onDeleteEntry(entry.id);
                          }
                        }}
                        className="p-1 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-md transition-colors"
                        title="Delete reflection"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mb-3 font-sans">
                    {entry.summary || entry.content}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/70 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium capitalize ${getMoodBadgeColor(entry.mood)}`}>
                        {entry.mood}
                      </span>
                      <span className="text-zinc-500 flex items-center gap-1 text-[10px]">
                        <Clock className="w-3 h-3" />
                        {dateStr}
                      </span>
                    </div>

                    {entry.tags && entry.tags.length > 0 && (
                      <div className="flex items-center gap-1 overflow-hidden">
                        {entry.tags.slice(0, 3).map((t) => (
                          <span key={t} className="text-zinc-500 font-mono text-[10px]">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Mode 2: Linked Notes View */}
      {viewMode === 'linked' && (
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
          {Object.keys(tagGroups).length === 0 ? (
            <div className="p-8 text-center bg-[#0F0F0F] border border-zinc-800 rounded-2xl">
              <p className="text-xs text-zinc-500">No linked theme connections found.</p>
            </div>
          ) : (
            Object.entries(tagGroups).map(([tag, groupEntries]) => (
              <div key={tag} className="p-4 bg-[#0F0F0F] border border-zinc-800 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 font-mono text-xs font-semibold">
                      #{tag}
                    </span>
                    <span className="text-xs text-zinc-500">({groupEntries.length} connected reflections)</span>
                  </div>
                </div>

                <div className="space-y-1.5 pl-2 border-l-2 border-zinc-700">
                  {groupEntries.map((entry) => (
                    <div
                      key={entry.id}
                      onClick={() => onSelectEntry(entry)}
                      className="p-2 rounded-xl hover:bg-zinc-800/60 cursor-pointer flex items-center justify-between group transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-zinc-300 truncate group-hover:text-zinc-100">
                          {entry.title || 'Untitled Reflection'}
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Mode 3: Markdown View (Directive 17) */}
      {viewMode === 'markdown' && (
        <div className="p-5 bg-[#0F0F0F] border border-zinc-800 rounded-2xl space-y-4 max-h-[600px] overflow-y-auto">
          {activeMarkdownEntry ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div>
                  <h4 className="text-base font-bold text-zinc-100">
                    {activeMarkdownEntry.title || 'Untitled'}
                  </h4>
                  <p className="text-[11px] text-zinc-500">
                    {new Date(activeMarkdownEntry.createdAt).toLocaleString()} • {activeMarkdownEntry.tags.map(t => `#${t}`).join(' ')}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDownloadMarkdown(e, activeMarkdownEntry)}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center gap-1 text-xs"
                  title="Download this markdown file"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.md</span>
                </button>
              </div>

              {/* Rendered Markdown */}
              <div className="prose prose-invert max-w-none text-xs leading-relaxed text-zinc-300 bg-zinc-950/60 p-4 rounded-xl border border-zinc-800/80 font-mono whitespace-pre-wrap">
                {generateMarkdownDocument(activeMarkdownEntry)}
              </div>

              {/* Cross-Linked Interactive Navigation */}
              {getRelatedEntries(activeMarkdownEntry).length > 0 && (
                <div className="pt-3 border-t border-zinc-800 space-y-2">
                  <h5 className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                    <GitFork className="w-3.5 h-3.5 text-amber-400" />
                    <span>Connected Reflections (See Also):</span>
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {getRelatedEntries(activeMarkdownEntry).map(({ entry: rel, sharedTags }) => (
                      <div
                        key={rel.id}
                        onClick={() => {
                          onSelectEntry(rel);
                          setPreviewEntry(rel);
                        }}
                        className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-all flex items-center justify-between group"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-zinc-200 truncate group-hover:text-amber-300">
                            {rel.title || 'Untitled'}
                          </div>
                          <div className="text-[10px] text-zinc-500 truncate">
                            Shared: {sharedTags.map((t) => `#${t}`).join(' ')}
                          </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-200 shrink-0 ml-2" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-xs text-zinc-500">
              Select an entry from the timeline to view as Markdown.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

