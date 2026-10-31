export function ActionFeedback({ success, error }: { success?: string; error?: string }) {
  if (error) return <div className="alert error" role="alert">{error}</div>;
  if (success) return <div className="alert success" role="status">{success}</div>;
  return null;
}
