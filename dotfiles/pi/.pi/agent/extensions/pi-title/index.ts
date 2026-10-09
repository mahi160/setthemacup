import { basename } from "node:path";
import type { ExtensionAPI, ThemeColor } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const LOGO = [
  "███╗   ███╗  █████╗  ██╗  ██╗ ██╗",
  "████╗ ████║ ██╔══██╗ ██║  ██║ ██║",
  "██╔████╔██║ ███████║ ███████║ ██║",
  "██║╚██╔╝██║ ██╔══██║ ██╔══██║ ██║",
  "██║ ╚═╝ ██║ ██║  ██║ ██║  ██║ ██║",
  "╚═╝     ╚═╝ ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝",
];

// syntax tokens: distinct hues in all 3 themes (accent/success collide in everforest)
const ROW_COLORS: ThemeColor[] = ["syntaxKeyword", "syntaxString", "syntaxFunction", "syntaxType", "mdLink", "syntaxNumber"];

const QUOTES = [
  "tokens go brrr",
  "sudo make me a sandwich",
  "it works on my machine™",
  "git push --force and pray",
  "99 bugs in the code, fix one, 127 bugs in the code",
  "semicolons are just emotional crutches",
  "works on my machine. ship my machine.",
  "there is no place like 127.0.0.1",
  "// TODO: actually fix this later",
  "NaN !== NaN and I'm not okay",
  "segfault (core vibes dumped)",
  "the cloud is just someone else's computer",
  "cache invalidation, naming things, and off-by-one errors",
  "async/await? more like async/a-pray",
  "I use vim btw (and I can't exit)",
  "0 errors, 847 warnings — close enough",
  "prod is the final staging environment",
];

const center = (text: string, width: number) =>
  " ".repeat(Math.max(0, Math.floor((width - visibleWidth(text)) / 2))) + text;

export default function (pi: ExtensionAPI): void {
  let model = "";
  let rerender: (() => void) | undefined;
  const quote = QUOTES[Math.floor(Date.now() / 86_400_000) % QUOTES.length];

  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;
    model = ctx.model?.id ?? "";
    const project = basename(ctx.cwd) || "session";
    ctx.ui.setHeader((tui, theme) => {
      rerender = () => tui.requestRender();
      return {
        render(width: number): string[] {
          const subtitle = truncateToWidth(`${model || "—"}  ·  ${project}  ·  "${quote}"`, width - 2);
          return [
            "",
            ...LOGO.map((line, i) => theme.fg(ROW_COLORS[i], center(line, width))),
            "",
            theme.fg("muted", center(subtitle, width)),
            "",
          ].map((line) => truncateToWidth(line, width));
        },
        invalidate() {},
      };
    });
  });

  pi.on("model_select", (event) => {
    model = event.model.id;
    rerender?.();
  });

  pi.on("session_shutdown", () => {
    rerender = undefined;
  });
}
