import { useEffect, useState } from "react";
import { Modal } from "./Modal";
type Request = {
  id: number;
  text: string;
  accept: string;
  resolve: (value: boolean) => void;
};
let sequence = 0,
  send: ((r: Request) => void) | undefined;
const queue: Request[] = [];
export function askConfirm(
  text: string,
  accept = "放弃修改",
): Promise<boolean> {
  return new Promise((resolve) => {
    const r = { id: sequence++, text, accept, resolve };
    if (send) send(r);
    else queue.push(r);
  });
}
export function ConfirmHost() {
  const [requests, setRequests] = useState<Request[]>([]);
  useEffect(() => {
    send = (r) => setRequests((s) => [...s, r]);
    if (queue.length) setRequests(queue.splice(0));
    return () => {
      send = undefined;
    };
  }, []);
  const r = requests[0];
  if (!r) return null;
  return (
    <Confirmation
      key={r.id}
      request={r}
      finish={(yes) => {
        r.resolve(yes);
        setRequests((s) => s.slice(1));
      }}
    />
  );
}
function Confirmation({
  request: r,
  finish,
}: {
  request: Request;
  finish: (yes: boolean) => void;
}) {
  const [choice, setChoice] = useState<boolean>();
  return (
    <Modal
      title="请确认"
      className="confirm-card"
      onClose={() => finish(choice ?? false)}
      closeRequested={choice !== undefined}
    >
      <p>{r.text}</p>
      <div className="confirm-actions">
        <button
          disabled={choice !== undefined}
          onClick={() => setChoice(false)}
        >
          取消
        </button>
        <button
          disabled={choice !== undefined}
          className="text-button danger"
          onClick={() => setChoice(true)}
        >
          {r.accept}
        </button>
      </div>
    </Modal>
  );
}
