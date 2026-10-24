import { useState } from "react";
import type { QuoteContent } from "./data";
import { parseQuotes, importQuotes } from "./quote-import";
import type { Run } from "./RecordForms";
export function QuoteImport({
  existing,
  run,
  onDone,
  onDirty,
}: {
  existing: QuoteContent[];
  run: Run;
  onDone: (saved?: boolean) => void;
  onDirty?: (dirty: boolean) => void;
}) {
  const [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const rows = parseQuotes(text, existing),
    valid = rows.filter((r) => !r.error && !r.duplicate);
  const template =
    "每天进步一点点\t\t我的收藏\nKeep going.\t继续向前。\t个人收藏";
  return (
    <div className="quote-import">
      <h3>TXT 导入 / 批量粘贴</h3>
      <p className="hint">
        每行一句，正文、翻译、出处用 Tab 或 |
        分隔。英文必须附中文翻译。最多500句、文件不超过2MB。
      </p>
      <div className="action-row">
        <label className="upload-button">
          选择 TXT
          <input
            aria-label="导入TXT句子"
            type="file"
            accept=".txt,text/plain"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 2 * 1024 * 1024)
                  throw Error("TXT文件不能超过2MB");
                const bytes = await file.arrayBuffer();
                let value;
                try {
                  value = new TextDecoder("utf-8", { fatal: true }).decode(
                    bytes,
                  );
                } catch {
                  value = new TextDecoder("gb18030").decode(bytes);
                }
                setText(value);
                onDirty?.(!!value);
                setError("");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                e.target.value = "";
              }
            }}
          />
        </label>
        <button
          onClick={() => {
            const url = URL.createObjectURL(
                new Blob([template], { type: "text/plain;charset=utf-8" }),
              ),
              a = document.createElement("a");
            a.href = url;
            a.download = "每日一句-导入模板.txt";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          下载模板
        </button>
      </div>
      <label>
        批量句子内容
        <textarea
          rows={6}
          value={text}
          maxLength={200000}
          onChange={(e) => {
            setText(e.target.value);
            onDirty?.(!!e.target.value);
          }}
          placeholder="中文句子 | | 出处&#10;English quote | 中文翻译 | 出处"
        />
      </label>
      {rows.length > 0 && (
        <>
          <p className="hint">
            识别 {rows.length} 句 · 可导入 {valid.length} 句 · 重复{" "}
            {rows.filter((r) => r.duplicate).length} 句
          </p>
          <div className="import-preview">
            {rows.slice(0, 500).map((r, i) => (
              <article key={i}>
                <p>{r.value.text}</p>
                {r.value.translation && <small>{r.value.translation}</small>}
                <small>
                  {r.error || (r.duplicate ? "重复，自动跳过" : r.value.source)}
                </small>
              </article>
            ))}
          </div>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="action-row">
        <button onClick={() => onDone()} disabled={busy}>
          返回句库
        </button>
        <button
          className="primary"
          disabled={
            busy ||
            !valid.length ||
            rows.length > 500 ||
            rows.some((r) => !!r.error)
          }
          onClick={async () => {
            setBusy(true);
            if (
              await run(
                () => importQuotes(valid.map((r) => r.value)),
                "句子已导入",
              )
            )
              onDone(true);
            setBusy(false);
          }}
        >
          确认导入 {valid.length} 句
        </button>
      </div>
    </div>
  );
}
