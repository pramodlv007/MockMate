/** A run of transcript text and the rubric points whose evidence covers it (none: plain text). */
export interface Segment { text: string; ids: string[] }

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Cut a transcript into runs so each evidence quote can be lit in place.
 * Matching ignores case and whitespace, the same tolerance the grader's evidence check uses;
 * a quote that is not found is skipped, and overlapping quotes share their run.
 */
export function segment(transcript: string, spans: { id: string; span: string | null | undefined }[]): Segment[] {
    const ranges: { start: number; end: number; id: string }[] = [];
    for (const { id, span } of spans) {
        const words = span?.trim().split(/\s+/).filter(Boolean);
        if (!words?.length) continue;
        const m = new RegExp(words.map(esc).join('\\s+'), 'i').exec(transcript);
        if (m) ranges.push({ start: m.index, end: m.index + m[0].length, id });
    }
    const cuts = [...new Set([0, transcript.length, ...ranges.flatMap(r => [r.start, r.end])])].sort((a, b) => a - b);
    const out: Segment[] = [];
    for (let i = 0; i < cuts.length - 1; i++) {
        const [a, b] = [cuts[i], cuts[i + 1]];
        out.push({ text: transcript.slice(a, b), ids: ranges.filter(r => r.start <= a && r.end >= b).map(r => r.id) });
    }
    return out;
}

if (import.meta.env.DEV) {
    const s = segment('We  Shipped it early. I wrote the job.', [
        { id: 'r', span: 'we shipped it' }, { id: 'a', span: 'I wrote the job' }, { id: 'x', span: 'not there' },
    ]);
    console.assert(s.map(x => x.text).join('') === 'We  Shipped it early. I wrote the job.', 'segment: text must survive whole');
    console.assert(s[0].text === 'We  Shipped it' && s[0].ids[0] === 'r', 'segment: case and spaces are ignored');
    console.assert(s.filter(x => x.ids.length).length === 2, 'segment: a missing quote is skipped');
}
