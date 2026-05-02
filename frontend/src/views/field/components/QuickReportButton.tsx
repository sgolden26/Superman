export interface QuickReportButtonProps {
  onReport: (kind: 'confirm' | 'refute' | 'flag') => void;
}

/** Floating action button group for one-tap field reports. */
export default function QuickReportButton(_props: QuickReportButtonProps) {
  return <div data-component="QuickReportButton" />;
}
