type Terminal = {
  write: (data: string) => void;
  writeln: (data: string) => void;
  cols: number;
};

const ASCII_ART = [
  "\x1b[36m         _ _                \x1b[0m",
  "\x1b[36m  __   _(_) |__   ___ _ __  \x1b[0m",
  "\x1b[36m  \\ \\ / / | '_ \\ / _ \\ '_ \\ \x1b[0m",
  "\x1b[36m   \\ V /| | |_) |  __/ | | |\x1b[0m",
  "\x1b[36m    \\_/ |_|_.__/ \\___|_| |_|\x1b[0m",
];

export function showWelcome(term: Terminal) {
  term.writeln("");

  if (term.cols >= 35) {
    for (const line of ASCII_ART) {
      term.writeln(line);
    }
  } else {
    term.writeln("\x1b[1m\x1b[36mViben Console\x1b[0m");
    term.writeln("\x1b[2m=============\x1b[0m");
  }
  term.writeln("");

  term.writeln("\x1b[2mA sandboxed bash environment with AI agent and GUI action support.\x1b[0m");
  term.writeln("");
  term.writeln("\x1b[2mCommands:\x1b[0m \x1b[36magent\x1b[0m, \x1b[36mgui\x1b[0m, \x1b[36mhelp\x1b[0m");
  term.writeln(
    "\x1b[2mTry:\x1b[0m \x1b[36magent hello\x1b[0m, \x1b[36mgui list_actions\x1b[0m, \x1b[36mls\x1b[0m, \x1b[36mecho hello\x1b[0m"
  );
  term.writeln("");
  term.write("$ ");
}
