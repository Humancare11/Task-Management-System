import Button from "../ui/Button.jsx";

export default function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="text-sm text-red-600">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-3">
          Try again
        </Button>
      )}
    </div>
  );
}
