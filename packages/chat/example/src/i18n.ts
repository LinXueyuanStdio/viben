import i18n from "i18next"
import { initReactI18next } from "react-i18next"

i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        "chat.welcomeTitle": "Session Player Demo",
        "chat.welcomeDescription": "Load a .jsonl session file or use the demo data to play back a conversation.",
        "chat.thinking": "Thinking...",
        "chat.hideSteps": "Hide steps",
        "chat.showSteps": "Show {{count}} steps",
        "chat.scrollToBottom": "Scroll to bottom",
        "chat.activity.executingTask": "Executing task",
        "chat.activity.runningCommand": "Running command...",
        "chat.activity.readingFile": "Reading {{file}}...",
        "chat.activity.writingFile": "Writing {{file}}...",
        "chat.activity.editingFile": "Editing {{file}}...",
        "chat.activity.searching": "Searching...",
        "chat.activity.findingFiles": "Finding files...",
        "chat.activity.searchingWeb": "Searching web...",
        "chat.activity.fetchingPage": "Fetching page...",
        "chat.activity.runningSubtask": "Running subtask...",
        "chat.activity.runningTool": "Running {{name}}...",
        "chat.collapsedGroup.readingFiles": "Reading {{count}} files",
        "chat.collapsedGroup.readFiles": "Read {{count}} files",
        "chat.collapsedGroup.searchingPatterns": "Searching {{count}} patterns",
        "chat.collapsedGroup.searchedPatterns": "Searched {{count}} patterns",
        "chat.collapsedGroup.runningCommands": "Running {{count}} commands",
        "chat.collapsedGroup.ranCommands": "Ran {{count}} commands",
        "chat.collapsedGroup.writingFiles": "Writing {{count}} files",
        "chat.collapsedGroup.wroteFiles": "Wrote {{count}} files",
        "chat.collapsedGroup.editingFiles": "Editing {{count}} files",
        "chat.collapsedGroup.editedFiles": "Edited {{count}} files",
        "chat.collapsedGroup.usingTools": "Using {{count}} tools",
        "chat.collapsedGroup.usedTools": "Used {{count}} tools",
        "chat.toolResult.linesOfOutput": "{{count}} lines of output",
        "chat.toolResult.readLines": "Read {{count}} lines",
        "chat.toolResult.foundMatchesInFiles": "Found matches in {{count}} files",
        "chat.toolResult.foundFiles": "Found {{count}} files",
        "chat.toolResult.fetchedCharacters": "Fetched {{count}} characters",
        "chat.toolResult.lines": "{{count}} lines",
      },
    },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
})

export default i18n
