export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export default function Spinner(_props: SpinnerProps) {
  return <div role="status" aria-label="Loading" />;
}
