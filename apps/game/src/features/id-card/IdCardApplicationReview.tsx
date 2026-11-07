import type { ReactNode } from 'react';

interface ReviewField { label: string; value: string }

export function parseIdCardReview(text: string): { heading: string; fields: ReviewField[]; question: string } {
  const [summary = '', question = ''] = text.split(/\n\n/, 2);
  const [heading = '', ...lines] = summary.split('\n');
  const fields = lines.flatMap(line => {
    const match = line.match(/^•\s*([^:]+):\s*(.*)$/);
    return match ? [{ label: match[1]!, value: match[2]! }] : [];
  });
  return { heading, fields, question };
}

export function IdCardApplicationReview({ text, photo }: { text: string; photo: ReactNode }) {
  const review = parseIdCardReview(text);
  return (
    <section aria-label="ID card application review" className="mt-2 min-w-0">
      <p className="font-medium">{review.heading}</p>
      <div className="mt-3 grid min-w-0 grid-cols-[6rem_minmax(0,1fr)] gap-3">
        <div className="justify-self-start">{photo}</div>
        <dl className="grid min-w-0 content-start gap-1">
          {review.fields.map(field => (
            <div key={field.label} className="grid min-w-0 grid-cols-[7rem_minmax(0,1fr)] gap-x-2">
              <dt className="font-medium text-[var(--color-message-strong)]">{field.label}:</dt>
              <dd className="min-w-0 [overflow-wrap:anywhere]">{field.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="mt-3 border-t border-[var(--color-muted-border)] pt-3">{review.question}</p>
    </section>
  );
}
