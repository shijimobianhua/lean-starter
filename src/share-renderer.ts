import QRCode from "qrcode";
import type { ShareCardSnapshot } from "./share-model";
import { phraseLines } from "./share-layout";

export async function renderShareCard(s: ShareCardSnapshot): Promise<Blob> {
  if (document.fonts?.ready) await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1440;
  const c = canvas.getContext("2d");
  if (!c) throw Error("当前浏览器无法生成图片，请换用支持画布的浏览器。");
  const lean = s.template === "lean-lines";
  const dark = s.template === "warm-archive",
    absurd = s.template === "absurd-note";
  const bg = lean
    ? "#f8f5ef"
    : dark
      ? "#2b2924"
      : absurd
        ? "#f4f5e9"
        : "#f7f4eb";
  const ink = lean ? "#272522" : dark ? "#f1e9d5" : "#243c30",
    muted = lean ? "#71685f" : dark ? "#c3b99f" : "#59685e",
    accent = lean
      ? "#ad4c24"
      : dark
        ? "#d8bc79"
        : absurd
          ? "#40612a"
          : "#2f7b5c";
  const text = (
    t: string,
    x: number,
    y: number,
    size: number,
    color = ink,
    weight = 400,
    width = 920,
  ) => {
    c.fillStyle = color;
    c.font = `${lean ? Math.min(weight, 500) : weight} ${size}px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif`;
    while (c.measureText(t).width > width && size > 18) {
      size -= 1;
      c.font = `${weight} ${size}px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif`;
    }
    c.fillText(t, x, y);
  };
  const line = (y: number) => {
    c.strokeStyle = dark ? "#706650" : "#bdc9b9";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(80, y);
    c.lineTo(1000, y);
    c.stroke();
  };
  c.fillStyle = bg;
  c.fillRect(0, 0, 1080, 1440);
  if (lean) {
    c.save();
    c.strokeStyle = accent;
    c.lineWidth = 2;
    c.globalAlpha = 0.5;
    c.beginPath();
    c.moveTo(870, 35);
    c.bezierCurveTo(790, 95, 870, 145, 970, 170);
    c.bezierCurveTo(1040, 190, 1000, 250, 1025, 300);
    c.stroke();
    c.strokeStyle = ink;
    c.globalAlpha = 0.25;
    c.beginPath();
    c.moveTo(800, 25);
    c.bezierCurveTo(790, 110, 730, 110, 735, 175);
    c.bezierCurveTo(738, 220, 895, 235, 910, 330);
    c.stroke();
    c.restore();
  }
  if (dark) {
    c.strokeStyle = "#706650";
    c.lineWidth = 2;
    c.strokeRect(35, 35, 1010, 1370);
  }
  if (absurd) {
    c.fillStyle = "#d4ef83";
    c.fillRect(62, 190, 956, 105);
  }
  text("薄肌 LEAN", 80, 114, 42, ink, 600);
  text(
    lean
      ? "BODY LINES / 薄肌之旅"
      : dark
        ? "LEAN ARCHIVE / 日常档案"
        : absurd
          ? "一点荒诞，一点认真。"
          : "DEGREE / LEAN RECORD",
    80,
    164,
    23,
    muted,
  );
  const title =
    s.kind === "enrollment"
      ? `${s.muscle}学位 · 入学登记`
      : s.kind === "today"
        ? "今天，也有记录"
        : s.kind === "graduation"
          ? `${s.muscle}学位 · 毕业纪念`
          : `${s.muscle}学位修读中`;
  text(title, 80, 267, 52, ink, 700);
  text(
    s.nickname ? `学员 / ${s.nickname}` : "LEAN 日常记录者",
    80,
    328,
    30,
    muted,
  );
  line(370);
  if (s.kind === "enrollment") {
    text("从今天", 80, 535, 104, accent, 800);
    text("开始记录自己。", 80, 660, 82, ink, 700);
    text("参与身份 / LEAN 学员", 80, 770, 34, muted);
    text("尚未授予毕业结果", 80, 827, 29, muted);
  } else if (s.kind === "today") {
    text("TODAY / 实际保存的记录", 80, 442, 28, muted);
    s.metrics.forEach((m, i) => {
      const y = 535 + i * 105;
      text(m.label, 80, y, 36, muted);
      text(m.text, 340, y, 48, ink, 700, 660);
    });
  } else {
    const st = s.streak!;
    text(
      s.kind === "graduation" ? "连续训练100天达标" : "当前连续训练",
      80,
      450,
      36,
      muted,
    );
    text(
      s.kind === "graduation" ? "100" : String(st.current),
      72,
      655,
      184,
      accent,
      800,
      630,
    );
    text(
      s.kind === "graduation" ? "天 · 达标" : "/ 100 天",
      700,
      645,
      42,
      muted,
      400,
      300,
    );
    c.fillStyle = dark ? "#4d493f" : "#dce2d5";
    c.fillRect(80, 715, 920, 14);
    c.fillStyle = accent;
    c.fillRect(
      80,
      715,
      920 * Math.min((s.kind === "graduation" ? 100 : st.current) / 100, 1),
      14,
    );
    text(`历史最长 ${st.best} 天`, 80, 802, 42, ink, 700);
    text(
      s.kind === "graduation"
        ? `当前连续 ${st.current} 天 · 基于现有记录重新计算`
        : st.passed
          ? "历史已达标 · 与当前连续分别统计"
          : st.current
            ? "每一天，都是一次真实记录。"
            : "尚未开始 · 可以从今天记录",
      80,
      862,
      29,
      muted,
    );
  }
  if (absurd) {
    // Original bean/dumbbell line drawing, always local and decorative.
    c.save();
    c.translate(830, 935);
    c.strokeStyle = accent;
    c.lineWidth = 5;
    c.beginPath();
    c.ellipse(30, 22, 38, 48, -0.3, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.moveTo(0, 12);
    c.lineTo(-40, -14);
    c.moveTo(-60, -14);
    c.lineTo(-20, -14);
    c.moveTo(-60, -30);
    c.lineTo(-60, 2);
    c.moveTo(-20, -30);
    c.lineTo(-20, 2);
    c.stroke();
    c.fillStyle = ink;
    c.fillRect(21, 10, 4, 5);
    c.fillRect(37, 10, 4, 5);
    c.restore();
  }
  c.font = '400 32px system-ui, "Microsoft YaHei", "PingFang SC", sans-serif';
  const lines = phraseLines(
    s.phrase,
    (t) => c.measureText(t).width,
    absurd ? 650 : 920,
  );
  if (lines.length > 3) throw Error("短句排版超出可用空间，请调整短句后重试。");
  const baseline = 1000 - (lines.length - 1) * 42;
  lines.forEach((line, i) =>
    text(line, 80, baseline + i * 42, 32, accent, 400, absurd ? 650 : 920),
  );
  line(1040);
  text(
    `${s.kind === "progress" ? "统计截至" : s.kind === "graduation" ? "生成日期" : "记录日期"} / ${s.date}`,
    80,
    1096,
    28,
    muted,
  );
  if (s.kind === "progress" || s.kind === "graduation") {
    text(
      "规则：连续100天实际训练；休息或漏记中断",
      80,
      1150,
      25,
      muted,
      400,
      665,
    );
  } else
    text(
      s.kind === "today"
        ? "记录状态 ≠ 健康目标达成"
        : "每次参与，从如实记录开始",
      80,
      1150,
      26,
      muted,
      400,
      665,
    );
  text("娱乐成就，非真实学历", 80, 1230, 32, ink, 700, 650);
  text("扫码打开学位分享版", 80, 1280, 27, muted, 400, 650);
  text("接收者使用自己的本地记录", 80, 1320, 24, muted, 400, 650);
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, s.productUrl, {
    width: 224,
    margin: 4,
    errorCorrectionLevel: "M",
    color: { dark: "#17261cff", light: "#ffffffff" },
  });
  c.imageSmoothingEnabled = false;
  c.drawImage(qr, 776, 1110, 224, 224);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob?.size ? resolve(blob) : reject(Error("生成图片失败，请重试。")),
      "image/png",
    ),
  );
}
