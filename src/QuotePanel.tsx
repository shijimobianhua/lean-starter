import {askConfirm} from "./confirm";
import { useEffect, useState, useRef, useLayoutEffect } from "react";
import { db, type QuoteContent, type Quote } from "./data";
import {
  builtinQuotes,
  saveQuote,
  removeQuote,
  restoreBuiltinQuotes,
} from "./quotes";
import type { Run } from "./RecordForms";
import { QuoteImport } from "./QuoteImport";
import { clearQuotes } from "./quote-import";
import { Modal } from "./Modal";
export function DailyQuoteCard({
  quote,
  preview = false,
}: {
  quote?: QuoteContent;
  preview?: boolean;
}) {
  const q = quote ?? { text: "", translation: "", source: "", language: "zh" };
  return (
    <section
      className={"daily-quote " + (preview ? "quote-preview" : "")}
      aria-label={preview ? "句子预览" : "每日一句"}
      aria-busy={false}
    >
      <div className="quote-kicker">
        <span>{preview ? "排版预览" : "每日一句"}</span>
      </div>
      {!q.text && !preview && (
        <p className="hint">句库为空，可在“我的 → 每日一句”添加或导入。</p>
      )}
      <blockquote lang={q.language === "en" ? "en" : "zh-CN"}>
        {q.text || (preview ? "在这里预览你的句子" : "")}
      </blockquote>
      {q.language === "en" && q.translation && (
        <p className="quote-translation" lang="zh-CN">
          {q.translation}
        </p>
      )}
      <p className="quote-source">{q.text ? q.source || "我的句子" : ""}</p>
    </section>
  );
}
const blank: QuoteContent = {
  text: "",
  translation: "",
  source: "",
  language: "zh",
};
export function QuotePanel({ quotes, run }: { quotes: Quote[]; run: Run }) {
  const [opened, setOpened] = useState(false);
  return (
    <>
      <button
        className="panel full-button quote-entry"
        onClick={() => setOpened(true)}
      >
        每日一句 <span>管理句库 ›</span>
      </button>
      {opened && (
        <QuoteManager
          quotes={quotes}
          run={run}
          onClose={() => setOpened(false)}
        />
      )}
    </>
  );
}
function QuoteManager({
  quotes,
  run,
  onClose,
}: {
  quotes: Quote[];
  run: Run;
  onClose: () => void;
}) {
  const [importing, setImporting] = useState(false);
  const [draft, setDraft] = useState<QuoteContent>(blank),
    [id, setId] = useState<string>(),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [editing, setEditing] = useState(false),
    [hidden, setHidden] = useState<string[]>([]),
    [notice, setNotice] = useState("");
  useEffect(() => {
    void db.profile.get("local").then((p) => setHidden(p?.hiddenQuotes ?? []));
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  const scrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [editing]);
  const canLeave = () =>
    !busy && (!dirty || askConfirm("还有未保存的句子修改，确定放弃？"));
  const all = [
    ...builtinQuotes
      .map((q, i) => ({ ...q, id: "builtin-" + i }))
      .filter(
        (q) => !hidden.includes(q.id) && !quotes.some((c) => c.id === q.id),
      ),
    ...quotes,
  ];
  const change = (key: keyof QuoteContent, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
    setNotice("");
  };
  return (
    <Modal
      title="每日一句"
      className="quote-manager-modal"
      onClose={onClose}
      canClose={canLeave}
    >
      <div className="quote-manager-scroll" ref={scrollRef}>
        {notice && (
          <p className="feedback" role="status">
            {notice}
          </p>
        )}
        {importing ? (
          <QuoteImport
            existing={all}
            run={run}
            onDirty={setDirty}
            onDone={async (saved) => {
              if (
                saved ||
                !dirty ||
                (await askConfirm("离开导入预览？尚未导入的内容将丢弃。"))
              ) {
                setImporting(false);
                setDirty(false);
              }
            }}
          />
        ) : editing ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              try {
                const ok = await run(() => saveQuote(draft, id), "句子已保存");
                if (ok) {
                  setDraft(blank);
                  setId(undefined);
                  setDirty(false);
                  setEditing(false);
                  setNotice("句子已保存，从次日参与轮换");
                } else setNotice("保存失败，请重试；输入仍保留。");
              } finally {
                setBusy(false);
              }
            }}
          >
            <button
              type="button"
              className="text-button"
              onClick={async () => {
                if (await canLeave()) {
                  setEditing(false);
                  setDirty(false);
                  setDraft(blank);
                }
              }}
            >
              ‹ 返回句库
            </button>
            <label>
              句子语言
              <select
                value={draft.language}
                onChange={(e) => change("language", e.target.value)}
              >
                <option value="zh">中文</option>
                <option value="en">English / 英文</option>
              </select>
            </label>
            <label>
              句子正文
              <textarea
                required
                rows={3}
                maxLength={draft.language === "en" ? 160 : 80}
                value={draft.text}
                onChange={(e) => change("text", e.target.value)}
              />
            </label>
            {draft.language === "en" && (
              <label>
                中文翻译
                <textarea
                  required
                  rows={2}
                  maxLength={80}
                  value={draft.translation}
                  onChange={(e) => change("translation", e.target.value)}
                />
              </label>
            )}
            <label>
              作者或出处（选填）
              <input
                maxLength={60}
                value={draft.source}
                onChange={(e) => change("source", e.target.value)}
              />
            </label>
            <DailyQuoteCard quote={draft} preview />
            <button className="primary quote-save" disabled={busy}>
              {busy ? "保存中…" : id ? "保存修改" : "添加句子"}
            </button>
          </form>
        ) : (
          <>
            <div className="quote-toolbar">
              <span>{all.length} 句</span>
              <button
                className="primary"
                onClick={() => {
                  setDraft(blank);
                  setId(undefined);
                  setEditing(true);
                  setDirty(false);
                  setNotice("");
                }}
              >
                新增句子
              </button>
            </div>
            <div className="quote-tools">
              <button
                className="small-button"
                onClick={() => setImporting(true)}
              >
                批量导入
              </button>
              <button
                className="text-button danger"
                disabled={busy || !all.length}
                onClick={async () => {
                  if (
                    !(await askConfirm(
                      "确定删除全部句子？内置、自定义及当天展示都会清空，其他日常记录保留。","删除全部句子",
                    ))
                  )
                    return;
                  setBusy(true);
                  try {
                    if (await run(clearQuotes, "句库已清空")) {
                      setHidden(builtinQuotes.map((_, i) => "builtin-" + i));
                      setNotice("句库已清空，可添加或导入新句子");
                    }
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                删除所有句子
              </button>
            </div>
            <div className="quote-list">
              {all.map((q) => (
                <article key={q.id}>
                  <p lang={q.language === "en" ? "en" : "zh-CN"}>{q.text}</p>
                  {q.language === "en" && (
                    <p className="quote-translation">{q.translation}</p>
                  )}
                  <small>{q.source || "我的句子"}</small>
                  <div className="action-row">
                    <button
                      className="text-button"
                      onClick={() => {
                        setId(q.id);
                        setDraft(q);
                        setEditing(true);
                        setDirty(false);
                        setNotice("");
                      }}
                    >
                      编辑句子
                    </button>
                    <button
                      className="text-button danger"
                      disabled={busy}
                      onClick={async () => {
                        if (!(await askConfirm("删除这条句子？","删除句子"))) return;
                        setBusy(true);
                        try {
                          const ok = await run(
                            () => removeQuote(q.id),
                            "句子已删除",
                          );
                          if (ok) {
                            if (q.id.startsWith("builtin-"))
                              setHidden((h) => [...h, q.id]);
                            setNotice("句子已删除");
                          } else setNotice("删除失败，请重试。");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      删除句子
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <button
              className="text-button"
              disabled={busy}
              onClick={async () => {
                if (!(await askConfirm("恢复内置60句？自定义句子将保留。","恢复内置句子"))) return;
                setBusy(true);
                try {
                  if (await run(restoreBuiltinQuotes, "已恢复内置句子")) {
                    setHidden([]);
                    setNotice("已恢复内置60句");
                  }
                } finally {
                  setBusy(false);
                }
              }}
            >
              恢复内置60句
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
